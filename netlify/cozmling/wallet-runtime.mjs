import {
  SESSION_AGE_SECONDS, WalletError, createWalletProof, isWalletAddress, newSessionToken,
  sessionCookie, sessionHash, sessionToken, walletScope,
} from './wallet.mjs'

async function strictVerify(signature, bytes, publicKey) {
  const { ed25519 } = await import('@noble/curves/ed25519.js')
  return ed25519.verify(signature, bytes, publicKey, { zip215: false })
}

async function resolveAuthorizedSigner(address, config) {
  const endpoint = new URL(`/v2/accounts/${address}`, config.algodUrl)
  endpoint.searchParams.set('exclude', 'all')
  const result = await fetch(endpoint, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(5000) })
  if (!result.ok) throw new WalletError('wallet_lookup_unavailable', 503)
  const record = await result.json()
  if (record.address !== address) throw new WalletError('wallet_lookup_unavailable', 503)
  const authorized = record['auth-addr']
  if (authorized === undefined || authorized === '') return address
  if (!isWalletAddress(authorized)) throw new WalletError('wallet_lookup_unavailable', 503)
  return authorized
}

async function sessionWallet(request, config, db, expected) {
  const token = sessionToken(request, config)
  if (!token || !isWalletAddress(expected)) return null
  const result = await db.query(
    `SELECT wallet_address FROM cozmc_wallet_session
      WHERE origin_scope = $1 AND token_digest = $2 AND wallet_address = $3
        AND expires_at > clock_timestamp()`,
    [walletScope(config), sessionHash(token), expected],
  )
  return result.rows[0]?.wallet_address ?? null
}

export function accountWallet(request, config, db) {
  return sessionWallet(request, config, db, request.headers.get('X-COZMC-Wallet'))
}

async function startSession(request, config, db, proof) {
  const token = newSessionToken()
  const prior = sessionToken(request, config)
  // Claim the nonce and rotate the session in one statement. A duplicate or an
  // expired proof creates no session. If the write fails, the nonce stays unused.
  const result = await db.query(
    `WITH consumed AS (
        INSERT INTO cozmc_wallet_challenge_use (origin_scope, nonce, expires_at)
        SELECT $1, $2, $3::timestamptz WHERE $3::timestamptz > clock_timestamp()
        ON CONFLICT (origin_scope, nonce) DO NOTHING
        RETURNING origin_scope
      ), rotated AS (
        DELETE FROM cozmc_wallet_session s
        USING consumed c
        WHERE s.origin_scope = c.origin_scope AND s.token_digest = $4
      )
      INSERT INTO cozmc_wallet_session (origin_scope, token_digest, wallet_address, expires_at)
      SELECT origin_scope, $5, $6, clock_timestamp() + $7::integer * interval '1 second'
      FROM consumed
      RETURNING wallet_address`,
    [walletScope(config), proof.nonce, new Date(proof.expiresAt), prior ? sessionHash(prior) : null,
      sessionHash(token), proof.address, SESSION_AGE_SECONDS],
  )
  if (!result.rowCount) throw new WalletError('challenge_used', 409)
  return token
}

async function endSession(request, config, db, address) {
  if (!isWalletAddress(address)) throw new WalletError('invalid_wallet', 400)
  const token = sessionToken(request, config)
  if (!token) return false
  const result = await db.query(
    'DELETE FROM cozmc_wallet_session WHERE origin_scope = $1 AND token_digest = $2 AND wallet_address = $3',
    [walletScope(config), sessionHash(token), address],
  )
  return Boolean(result.rowCount)
}

export function walletResponse(payload, status = 200, extra = {}) {
  return Response.json(payload, { status, headers: {
    'Cache-Control': 'private, no-store',
    'CDN-Cache-Control': 'no-store',
    Vary: 'Cookie, X-COZMC-Wallet',
    ...extra,
  } })
}

async function readAction(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) {
    throw new WalletError('invalid_request', 400)
  }
  const body = await request.text()
  if (body.length > 4096) throw new WalletError('invalid_request', 400)
  try {
    const value = JSON.parse(body)
    if (value && typeof value === 'object' && !Array.isArray(value)) return value
  } catch {
    // Normalize parsing errors before returning a response.
  }
  throw new WalletError('invalid_request', 400)
}

export function createWalletHandler(config, db, options = {}) {
  const proof = createWalletProof({
    config, resolveSigner: options.resolveSigner ?? ((address) => resolveAuthorizedSigner(address, config)),
    verifySignature: options.verifySignature ?? strictVerify, clock: options.clock,
  })
  return async function handle(request) {
    const url = new URL(request.url)
    if (url.origin !== config.origin ||
        (request.method === 'POST' && request.headers.get('origin') !== config.origin)) {
      return walletResponse({ error: 'origin_not_allowed' }, 403)
    }
    try {
      if (request.method === 'GET') {
        const address = await sessionWallet(request, config, db, url.searchParams.get('wallet'))
        return walletResponse({ address })
      }
      if (request.method !== 'POST') return walletResponse({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' })
      const body = await readAction(request)
      if (body.action === 'challenge') {
        const { data, token, cookie } = proof.begin(body.address)
        return walletResponse({ data, token }, 200, { 'Set-Cookie': cookie })
      }
      if (body.action === 'verify') {
        const verified = await proof.verify(request, body)
        const token = await startSession(request, config, db, verified)
        return walletResponse({ address: verified.address }, 200, { 'Set-Cookie': sessionCookie(config, token) })
      }
      if (body.action === 'logout') {
        const revoked = await endSession(request, config, db, body.address)
        return walletResponse({ address: null }, 200, revoked ? { 'Set-Cookie': sessionCookie(config, null) } : {})
      }
      return walletResponse({ error: 'invalid_request' }, 400)
    } catch (error) {
      if (error instanceof WalletError) return walletResponse({ error: error.message }, error.status)
      throw error
    }
  }
}
