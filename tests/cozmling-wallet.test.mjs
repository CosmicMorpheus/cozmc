import assert from 'node:assert/strict'
import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto'
import { test } from 'node:test'
import { MAINNET } from '../netlify/cozmling/wallet.mjs'
import { accountWallet, createWalletHandler } from '../netlify/cozmling/wallet-runtime.mjs'

const origin = 'https://cozmc-wallet.example'
const config = { origin, secure: true, walletSecret: Buffer.alloc(32, 4) }
const digest = (bytes) => createHash('sha256').update(bytes).digest()
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const SPKI = Buffer.from('302a300506032b6570032100', 'hex')

function wallet() {
  const keys = generateKeyPairSync('ed25519')
  const publicKey = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
  const checksum = createHash('sha512-256').update(publicKey).digest().subarray(-4)
  const bits = [...Buffer.concat([publicKey, checksum])].map((byte) => byte.toString(2).padStart(8, '0')).join('') + '00'
  return { key: keys.privateKey, address: bits.match(/.{5}/g).map((chunk) => BASE32[parseInt(chunk, 2)]).join('') }
}

function userRequest({ body, cookie, address, source = origin } = {}) {
  const endpoint = new URL('/api/cozmling-wallet', origin)
  if (!body && address) endpoint.searchParams.set('wallet', address)
  const headers = new Headers()
  if (address) headers.set('X-COZMC-Wallet', address)
  if (cookie) headers.set('Cookie', cookie)
  if (!body) return new Request(endpoint, { headers })
  headers.set('Origin', source)
  headers.set('Content-Type', 'application/json')
  return new Request(endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
}

function signProof(challenge, key, domain = new URL(origin).host) {
  const authenticatorData = digest(domain)
  const message = Buffer.concat([digest(Buffer.from(challenge.data, 'base64')), digest(authenticatorData)])
  return {
    action: 'verify', ...challenge, authenticatorData: authenticatorData.toString('base64'),
    signature: sign(null, message, key).toString('base64'),
  }
}

function fixture(resolveSigner = async (address) => address) {
  let now = Date.parse('2030-01-02T00:00:00Z')
  const used = new Set()
  const sessions = new Map()
  const db = {
    query: async (sql, values) => {
      const [scope, key] = values
      const id = `${scope}/${key}`
      if (sql.startsWith('WITH consumed AS')) {
        const [, , expires, prior, next, owner, seconds] = values
        if (used.has(id) || expires.getTime() <= now) return { rowCount: 0, rows: [] }
        used.add(id)
        if (prior) sessions.delete(`${scope}/${prior}`)
        sessions.set(`${scope}/${next}`, { wallet_address: owner, expires: now + seconds * 1000 })
        return { rowCount: 1, rows: [{ wallet_address: owner }] }
      }
      const session = sessions.get(id)
      const owner = values[2]
      if (sql.startsWith('SELECT wallet_address')) {
        const found = session?.wallet_address === owner && session.expires > now
        return { rowCount: Number(found), rows: found ? [session] : [] }
      }
      if (sql.startsWith('DELETE FROM cozmc_wallet_session')) {
        const removed = session?.wallet_address === owner && sessions.delete(id)
        return { rowCount: Number(removed), rows: [] }
      }
      throw new Error('Unexpected wallet store query')
    },
  }
  const verifySignature = (signature, message, rawKey) => {
    const publicKey = createPublicKey({ key: Buffer.concat([SPKI, rawKey]), format: 'der', type: 'spki' })
    return verify(null, message, publicKey, signature)
  }
  const request = createWalletHandler(config, db, { clock: () => now, resolveSigner, verifySignature })
  return { request, db, advance: (ms) => { now += ms } }
}

const cookieValue = (response) => response.headers.get('set-cookie')?.split(';')[0]
const withCookies = (...cookies) => cookies.filter(Boolean).join('; ')

async function challengeFor(request, address) {
  const response = await request(userRequest({ body: { action: 'challenge', address } }))
  assert.equal(response.status, 200)
  const challenge = await response.json()
  return { challenge, cookie: cookieValue(response) }
}

test('sign-in proves ownership and binds the server session to the active wallet and origin', async () => {
  const owner = wallet()
  const other = wallet()
  const { request, db, advance } = fixture()
  const initial = await request(userRequest({ address: owner.address }))
  assert.deepEqual(await initial.json(), { address: null })
  const { challenge, cookie } = await challengeFor(request, owner.address)
  const signedFields = JSON.parse(Buffer.from(challenge.data, 'base64').toString())
  assert.equal(signedFields.account_address, owner.address)
  assert.equal(signedFields.chain_id, MAINNET)
  assert.equal(signedFields.uri, origin)
  assert.equal(signedFields.nonce, challenge.token)
  assert.match(cookie, /^__Host-cozmc-wallet-v1-challenge=/)

  const response = await request(userRequest({ body: signProof(challenge, owner.key), cookie }))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
  assert.match(response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Max-Age=86400; Secure$/)
  assert.deepEqual(await response.json(), { address: owner.address })
  const session = cookieValue(response)
  assert.equal(await accountWallet(userRequest({ cookie: session, address: owner.address }), config, db), owner.address)
  assert.equal(await accountWallet(userRequest({ cookie: session, address: other.address }), config, db), null)
  assert.equal(await accountWallet(userRequest({ cookie: session, address: owner.address }), { ...config, origin: 'https://elsewhere.example' }, db), null)
  advance(24 * 60 * 60_000)
  assert.equal(await accountWallet(userRequest({ cookie: session, address: owner.address }), config, db), null)
})

test('one challenge creates one session; rotated and logged-out sessions stop granting access', async () => {
  const owner = wallet()
  const { request, db } = fixture()
  const { challenge, cookie } = await challengeFor(request, owner.address)
  const body = signProof(challenge, owner.key)
  const responses = await Promise.all([
    request(userRequest({ body, cookie })),
    request(userRequest({ body, cookie })),
  ])
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409])
  const previous = cookieValue(responses.find((response) => response.ok))
  const fresh = await challengeFor(request, owner.address)
  const rotated = await request(userRequest({ body: signProof(fresh.challenge, owner.key), cookie: withCookies(fresh.cookie, previous) }))
  const current = cookieValue(rotated)
  assert.equal(rotated.status, 200)
  assert.equal(await accountWallet(userRequest({ cookie: previous, address: owner.address }), config, db), null)
  assert.equal(await accountWallet(userRequest({ cookie: current, address: owner.address }), config, db), owner.address)

  const loggedOut = await request(userRequest({ body: { action: 'logout', address: owner.address }, cookie: current }))
  assert.equal(loggedOut.status, 200)
  assert.match(loggedOut.headers.get('set-cookie'), /Max-Age=0/)
  assert.equal(await accountWallet(userRequest({ cookie: current, address: owner.address }), config, db), null)
})

test('rekeyed wallet proof must use its current authorized signing key', async () => {
  const account = wallet()
  const signer = wallet()
  const { request } = fixture(async (address) => {
    assert.equal(address, account.address)
    return signer.address
  })
  const { challenge, cookie } = await challengeFor(request, account.address)
  const old = await request(userRequest({ body: signProof(challenge, account.key), cookie }))
  assert.equal(old.status, 401)
  const current = await request(userRequest({ body: signProof(challenge, signer.key), cookie }))
  assert.equal(current.status, 200)
  assert.deepEqual(await current.json(), { address: account.address })
})

test('foreign, altered, detached and stale proofs fail before a session is written', async () => {
  const owner = wallet()
  const { request, advance } = fixture()
  const wrongAddress = `${owner.address[0] === 'A' ? 'B' : 'A'}${owner.address.slice(1)}`
  assert.equal((await request(userRequest({ body: { action: 'challenge', address: wrongAddress } }))).status, 400)
  assert.equal((await request(userRequest({ source: 'https://foreign.example', body: { action: 'challenge', address: owner.address } }))).status, 403)
  const { challenge, cookie } = await challengeFor(request, owner.address)
  assert.equal((await request(userRequest({ body: signProof(challenge, owner.key) }))).status, 401)
  assert.equal((await request(userRequest({ body: signProof({ ...challenge, token: 'different' }, owner.key), cookie }))).status, 401)
  assert.equal((await request(userRequest({ body: signProof(challenge, owner.key, 'different.example'), cookie }))).status, 401)
  advance(5 * 60_000)
  assert.equal((await request(userRequest({ body: signProof(challenge, owner.key), cookie }))).status, 401)
})
