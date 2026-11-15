/* Wallet-backed Cozmlings end to end on a real PostgreSQL database, with real Ed25519 signatures in the
   ARC-60 form a wallet returns. Skipped unless COZMLING_TEST_DATABASE_URL names a disposable database:
   each run works in a schema of its own and drops it afterwards.
     COZMLING_TEST_DATABASE_URL=postgres://… npx tsx --test tests/cozmling-wallet-postgres.test.ts        */
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, randomUUID, sign, type KeyObject } from 'node:crypto'
import { test } from 'node:test'
import { hatchWithSky, provisionalStarprint } from '../src/cozmling/celestial/chart'
import { newAdventurer } from '../src/cozmling/domain/adventurer'
import { companionProblem } from '../src/cozmling/store/validators'

const testDb = process.env.COZMLING_TEST_DATABASE_URL
const origin = 'https://cozmc-preview.netlify.app'
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest()
type Status = { status: number; body: any; cookie: string | null }

function makeWallet(): { key: KeyObject; address: string } {
  const keys = generateKeyPairSync('ed25519')
  const publicKey = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
  const checksum = createHash('sha512-256').update(publicKey).digest().subarray(-4)
  const bits = [...Buffer.concat([publicKey, checksum])].map(byte => byte.toString(2).padStart(8, '0')).join('') + '00'
  return { key: keys.privateKey, address: bits.match(/.{5}/g)!.map(chunk => BASE32[parseInt(chunk, 2)]).join('') }
}

test('real PostgreSQL: sign-in, both adoption paths, a second device, another wallet, duplicate claims and sign-out', { skip: !testDb }, async () => {
  const { default: pg } = await import('pg')
  const namespace = `cozmling_e2e_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Pool({ connectionString: testDb })
  await admin.query(`CREATE SCHEMA ${namespace}`)
  const url = new URL(testDb!)
  url.searchParams.set('options', `-c search_path=${namespace}`)
  process.env.DATABASE_URL = url.toString()
  try {
    const { readConfig, previewAccount } = await import('../netlify/cozmling/runtime.mjs')
    const { createWalletHandler, accountWallet } = await import('../netlify/cozmling/wallet-runtime.mjs')
    const { createAccountService } = await import('../netlify/cozmling/account.mjs')
    const { createCommunityHatchService, readEventConfig } = await import('../netlify/cozmling/event.mjs')

    // the separate preview site, by its id; no secret set, so the database makes and keeps one
    const site = 'f4ead5e2-a563-4527-b2e9-08a4d41c2874'
    const settings = readConfig('production', { COZMC_ACCOUNT_ENABLED: '1', COZMC_ACCOUNT_ORIGIN: origin, COZMC_ACCOUNT_SITE_ID: site }, site)
    assert.ok(settings)
    const { db, config } = await previewAccount(settings)
    const { rows: [secret] } = await db.query('SELECT octet_length(secret) AS bytes FROM cozmc_wallet_secret')
    assert.equal(Number(secret.bytes), 32, 'the session key lives in the database')
    assert.equal((await previewAccount(settings)).config.walletSecret.equals(config.walletSecret), true, 'and stays the same')
    // the real Algorand lookup isn't reachable from tests: these keys were never rekeyed
    const handle = createWalletHandler(config, db, { resolveSigner: async (address: string) => address })

    const call = async (body: object, cookie?: string): Promise<Status> => {
      const response = await handle(new Request(`${origin}/api/cozmling-wallet`, {
        method: 'POST', body: JSON.stringify(body),
        headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      }))
      return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] ?? null }
    }
    async function signIn(wallet: ReturnType<typeof makeWallet>) {
      const challenge = await call({ action: 'challenge', address: wallet.address })
      const authenticatorData = sha(new URL(origin).host)
      const message = Buffer.concat([sha(Buffer.from(challenge.body.data, 'base64')), sha(authenticatorData)])
      const proof = { action: 'verify', ...challenge.body, authenticatorData: authenticatorData.toString('base64'), signature: sign(null, message, wallet.key).toString('base64') }
      const verified = await call(proof, challenge.cookie!)
      return { verified, replay: () => call(proof, challenge.cookie!) }
    }
    const asWallet = async (cookie: string, address: string) => accountWallet(new Request(`${origin}/api/cozmling-account`, { headers: { Cookie: cookie, 'X-COZMC-Wallet': address } }), config, db)

    const alice = makeWallet(), bob = makeWallet()
    const a = await signIn(alice)
    assert.equal(a.verified.status, 200)
    const aliceSession = a.verified.cookie!
    assert.equal(await asWallet(aliceSession, alice.address), alice.address)
    assert.equal(await asWallet(aliceSession, bob.address), null, 'a session answers only for its own wallet')
    assert.equal((await a.replay()).status, 409, 'a signed challenge can’t be used twice')
    const b = await signIn(bob)
    const bobSession = b.verified.cookie!

    // ordinary adoption: a starter egg, one per wallet, the same answer to a repeat
    const account = createAccountService({ db, validateRecord: companionProblem })
    const now = Date.now()
    const egg = (companionId: string, look: 'a' | 'b' = 'a', skin = 'teal') => {
      const choices = { name: 'Orbi', birthday: '2026-05-05', look, skin }
      return newAdventurer(choices, { companionId, now, starprint: provisionalStarprint(choices.birthday, now) ?? undefined })
    }
    const ordinaryId = randomUUID()
    const adopted = await account.adopt(alice.address, { record: egg(ordinaryId), events: [] })
    assert.deepEqual(await account.adopt(alice.address, { record: egg(ordinaryId), events: [] }), adopted)
    const another = await account.adopt(alice.address, { record: egg(randomUUID()), events: [] })
    assert.equal(another.companion.snapshot.record.companionId, ordinaryId, 'a second ordinary adoption returns the first')

    // play on the first device: hatch, and a save the second device must see
    const hatched = hatchWithSky(adopted.companion.snapshot.record, now + 60_000, 'America/New_York')
    assert.ok(hatched?.kind === 'adventurer')
    const saved = await account.save(alice.address, {
      expectedRevision: 0, opId: randomUUID(),
      snapshot: { record: { ...hatched, revision: 1, updatedAt: now + 60_000 }, events: [...adopted.companion.snapshot.events, { eventId: `hatched:${ordinaryId}`, companionId: ordinaryId, type: 'hatched', at: now + 60_000 }] },
    })
    assert.equal(saved.companion.revision, 1)
    await assert.rejects(account.save(alice.address, { expectedRevision: 0, opId: randomUUID(), snapshot: saved.companion.snapshot }), /stale_save/, 'a stale write is refused')

    // a second device, the same wallet: the same companion, id and progress
    const secondDevice = await account.list(alice.address)
    assert.deepEqual(secondDevice.companions.map((c: any) => [c.snapshot.record.companionId, c.snapshot.record.hatch.status, c.revision]), [[ordinaryId, 'hatched', 1]])
    // another wallet sees none of it and can't write to it
    assert.deepEqual(await account.list(bob.address), { companions: [] })
    await assert.rejects(account.save(bob.address, { expectedRevision: 1, opId: randomUUID(), snapshot: saved.companion.snapshot }), /companion_missing/)

    // the Community Hatch: a lantern a day, a stable draw, and an event egg alongside the ordinary one
    let clock = Date.parse('2030-03-01T12:00:00Z')
    const hatchConfig = readEventConfig(JSON.stringify({ eventId: 'e2e-grove', title: 'Light the Grove', opensAt: '2030-03-01T00:00:00Z', endsAt: '2030-03-03T00:00:00Z', claimUntil: '2030-03-05T00:00:00Z', goal: 5 }))
    const grove = createCommunityHatchService({ db, config: hatchConfig, clock: () => clock })
    await grove.act(alice.address, 'contribute')
    const twice = await grove.act(alice.address, 'contribute')
    assert.deepEqual([twice.total, twice.contributedToday], [1, true], 'once a day per wallet')
    clock = Date.parse('2030-03-03T12:00:00Z')
    const [one, two] = await Promise.all([grove.act(alice.address, 'claim'), grove.act(alice.address, 'claim')])
    assert.deepEqual(one.receipt, two.receipt, 'two claims at once: one egg, one look')
    assert.deepEqual((await grove.act(alice.address, 'claim')).receipt, one.receipt, 'and a later retry gets the same')
    assert.equal(one.lanternEligible, false, 'the goal was missed: no lantern, but the egg is still earned')
    await assert.rejects(grove.act(bob.address, 'claim'), /not_eligible/)
    const look = { 'grove-green': ['a', 'moss'], 'grove-violet': ['b', 'lilac'], 'grove-cyan': ['a', 'sky'] }[one.receipt.lookId as string] as ['a' | 'b', string]
    const eventEgg = egg(one.receipt.companionId, ...look)
    await assert.rejects(account.adopt(bob.address, { record: eventEgg, events: [] }), /invalid_hatch_claim/, 'another wallet can’t use the receipt')
    await account.adopt(alice.address, { record: eventEgg, events: [] })
    assert.deepEqual((await account.list(alice.address)).companions.map((c: any) => c.snapshot.record.companionId).sort(), [ordinaryId, one.receipt.companionId].sort())

    // sign-out ends the session at the server
    const out = await call({ action: 'logout' }, aliceSession)
    assert.deepEqual([out.status, out.body.revoked], [200, true])
    assert.equal(await asWallet(aliceSession, alice.address), null)
    assert.equal(await asWallet(bobSession, bob.address), bob.address, 'other sessions are untouched')
    await db.end?.()
  } finally {
    await admin.query(`DROP SCHEMA ${namespace} CASCADE`)
    await admin.end()
  }
})
