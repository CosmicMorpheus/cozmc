export class CozmlingRequestError extends Error {
  constructor(code, status, fields = {}) {
    super(code)
    this.status = status
    this.fields = fields
  }
}

export function response(payload, status = 200, headers = {}) {
  return Response.json(payload, { status, headers: {
    'Cache-Control': 'private, no-store',
    'CDN-Cache-Control': 'no-store',
    Vary: 'Cookie, X-COZMC-Wallet',
    ...headers,
  } })
}

export function validateRequest(request, origin) {
  const method = request.method
  if (method !== 'GET' && method !== 'POST') {
    return response({ error: 'method_not_allowed' }, 405, { Allow: 'GET, POST' })
  }
  if (new URL(request.url).origin !== origin || (method === 'POST' && request.headers.get('origin') !== origin)) {
    return response({ error: 'origin_not_allowed' }, 403)
  }
  return null
}

const MAX_BODY_BYTES = 512 * 1024

export async function readBody(request) {
  const type = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') throw new CozmlingRequestError('invalid_request', 400)
  const body = await request.arrayBuffer()
  if (body.byteLength > MAX_BODY_BYTES) throw new CozmlingRequestError('snapshot_too_large', 413)
  try {
    const parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
  } catch {
    // Malformed JSON and malformed UTF-8 share the same response.
  }
  throw new CozmlingRequestError('invalid_request', 400)
}

export function requestError(error) {
  if (error instanceof CozmlingRequestError) return response({ error: error.message, ...error.fields }, error.status)
  console.error('Cozmling wallet preview could not serve the request. Check preview configuration and storage.')
  return response({ error: 'temporarily_unavailable' }, 503)
}

export async function bindPreviewOrigin(db, origin) {
  await db.query(`INSERT INTO cozmling_preview_scope (singleton, origin) VALUES (TRUE, $1)
    ON CONFLICT (singleton) DO NOTHING`, [origin])
  // Issue a separate statement so a racing initializer is visible after it commits.
  const { rows: [scope] } = await db.query('SELECT origin FROM cozmling_preview_scope WHERE singleton = TRUE')
  if (scope?.origin !== origin) throw new CozmlingRequestError('preview_database_mismatch', 503)
}

export async function transaction(pool, run) {
  const client = await pool.connect()
  let broken
  try {
    await client.query('BEGIN')
    const result = await run(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try { await client.query('ROLLBACK') } catch (rollbackError) { broken = rollbackError }
    throw error
  } finally {
    client.release(broken)
  }
}
