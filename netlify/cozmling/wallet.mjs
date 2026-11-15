import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export const MAINNET = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k'
export const SESSION_AGE_SECONDS = 24 * 60 * 60
const CHALLENGE_AGE_SECONDS = 5 * 60
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const COOKIE_PREFIX = 'cozmc-wallet-v1'
const SESSION_TOKEN = /^[A-Za-z0-9_-]{43}$/
const digest = (bytes) => createHash('sha256').update(bytes).digest()

export class WalletError extends Error {
  constructor(code, status) {
    super(code)
    this.status = status
  }
}

function keyForAddress(address) {
  if (typeof address !== 'string' || !/^[A-Z2-7]{58}$/.test(address)) return null
  const bytes = Buffer.alloc(36)
  let offset = 0
  let bits = 0
  let buffer = 0
  for (const character of address) {
    buffer = (buffer << 5) | ALPHABET.indexOf(character)
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes[offset] = buffer >> bits
      offset += 1
      buffer &= (1 << bits) - 1
    }
  }
  if (offset !== bytes.length || buffer !== 0) return null
  const publicKey = bytes.subarray(0, 32)
  const checksum = createHash('sha512-256').update(publicKey).digest().subarray(-4)
  return timingSafeEqual(checksum, bytes.subarray(32)) ? publicKey : null
}

export const isWalletAddress = (address) => keyForAddress(address) !== null
export const walletScope = (config) => digest(JSON.stringify([config.origin, MAINNET])).toString('hex')
export const sessionHash = (token) => digest(token).toString('hex')
export const newSessionToken = () => randomBytes(32).toString('base64url')

function cookieName(config, purpose) {
  return `${config.secure ? '__Host-' : ''}${COOKIE_PREFIX}-${purpose}`
}

function readCookie(request, config, purpose) {
  const prefix = `${cookieName(config, purpose)}=`
  return request.headers.get('cookie')?.split(';')
    .map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length)
}

function makeCookie(config, purpose, value, age) {
  return `${cookieName(config, purpose)}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${config.secure ? '; Secure' : ''}`
}

export function sessionToken(request, config) {
  const token = readCookie(request, config, 'session')
  return SESSION_TOKEN.test(token ?? '') ? token : null
}

export function sessionCookie(config, token) {
  return makeCookie(config, 'session', token ?? '', token ? SESSION_AGE_SECONDS : 0)
}

function readBase64(value, min, max) {
  if (typeof value !== 'string' || value.length > Math.ceil(max / 3) * 4) return null
  const bytes = Buffer.from(value, 'base64')
  return bytes.length >= min && bytes.length <= max && bytes.toString('base64') === value ? bytes : null
}

export function createWalletProof({ config, resolveSigner, verifySignature, clock = Date.now }) {
  const domain = new URL(config.origin).host
  const domainHash = digest(domain)
  const scope = walletScope(config)

  function challengeMac(encoded) {
    return createHmac('sha256', config.walletSecret).update(JSON.stringify([scope, encoded])).digest('base64url')
  }

  function signingData(challenge) {
    // The field order below is canonical for these ASCII values.
    return Buffer.from(JSON.stringify({
      account_address: challenge.address,
      chain_id: MAINNET,
      domain,
      'expiration-time': new Date(challenge.expiresAt).toISOString(),
      'issued-at': new Date(challenge.issuedAt).toISOString(),
      nonce: challenge.nonce,
      resources: [`${config.origin}/api/cozmling-wallet`],
      statement: 'Sign in to your COZMC Cozmling account.',
      type: 'ed25519',
      uri: config.origin,
      version: '1',
    })).toString('base64')
  }

  function begin(address) {
    if (!isWalletAddress(address)) throw new WalletError('invalid_wallet', 400)
    const issuedAt = clock()
    const challenge = {
      address, issuedAt, expiresAt: issuedAt + CHALLENGE_AGE_SECONDS * 1000, nonce: randomBytes(16).toString('hex'),
    }
    const encoded = Buffer.from(JSON.stringify(challenge)).toString('base64url')
    const cookie = makeCookie(config, 'challenge', `${encoded}.${challengeMac(encoded)}`, CHALLENGE_AGE_SECONDS)
    return { data: signingData(challenge), token: challenge.nonce, cookie }
  }

  function readChallenge(request) {
    const cookie = readCookie(request, config, 'challenge') ?? ''
    const match = /^([A-Za-z0-9_-]{1,512})\.([A-Za-z0-9_-]{43})$/.exec(cookie)
    if (!match) return null
    const [, encoded, mac] = match
    if (!timingSafeEqual(Buffer.from(mac), Buffer.from(challengeMac(encoded)))) return null
    const challenge = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    return challenge.expiresAt > clock() ? challenge : null
  }

  async function verify(request, { data, token, signature, authenticatorData }) {
    const challenge = readChallenge(request)
    if (!challenge || token !== challenge.nonce || data !== signingData(challenge)) {
      throw new WalletError('invalid_challenge', 401)
    }

    const signed = readBase64(signature, 64, 64)
    const authenticator = readBase64(authenticatorData, 32, 1024)
    if (!signed || !authenticator || !timingSafeEqual(authenticator.subarray(0, 32), domainHash)) {
      throw new WalletError('invalid_signature', 401)
    }

    const publicKey = keyForAddress(await resolveSigner(challenge.address))
    if (!publicKey) throw new Error('Could not resolve the Algorand signing address.')
    // TxnLab's ARC-60 AUTH covers the hash of each byte sequence, including any authenticator flags.
    const signedBytes = Buffer.concat([digest(Buffer.from(data, 'base64')), digest(authenticator)])
    if (!await verifySignature(signed, signedBytes, publicKey)) throw new WalletError('invalid_signature', 401)
    if (challenge.expiresAt <= clock()) throw new WalletError('invalid_challenge', 401)
    return { address: challenge.address, nonce: challenge.nonce, expiresAt: challenge.expiresAt }
  }

  return { begin, verify }
}
