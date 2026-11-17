import type { Config, Context } from '@netlify/functions'
import { response } from '../cozmling/http.mjs'
import { findPublicRecord, publicMetadata } from '../cozmling/mint.mjs'
import { previewPool, readConfig } from '../cozmling/runtime.mjs'

export const config: Config = { path: '/api/starprint-meta/:serial' }

/** A minted Starprint's public description (ARC-3 JSON), as its asset's URL points to. Nothing private. */
export default async function starprintMeta(request: Request, context: Context) {
  try {
    const accountConfig = readConfig(context.deploy.context, process.env, context.site?.id)
    if (!accountConfig || process.env.COZMC_STARPRINT_MINT !== '1') return response({ error: 'disabled' }, 404)
    const serial = Number(context.params?.serial)
    if (!Number.isSafeInteger(serial) || serial < 1) return response({ error: 'not_found' }, 404)
    const db = await previewPool(accountConfig)
    const row = await findPublicRecord(db, serial)
    if (!row) return response({ error: 'not_found' }, 404)
    return response(publicMetadata(row, accountConfig.origin), 200, { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' })
  } catch {
    return response({ error: 'unavailable' }, 503)
  }
}
