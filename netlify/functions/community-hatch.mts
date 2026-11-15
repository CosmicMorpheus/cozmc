import type { Config, Context } from '@netlify/functions'
import { createCommunityHatchService, readEventConfig } from '../cozmling/event.mjs'
import { readBody, requestError, response, validateRequest } from '../cozmling/http.mjs'
import { previewPool, readConfig } from '../cozmling/runtime.mjs'
import { accountWallet } from '../cozmling/wallet-runtime.mjs'

export const config: Config = { path: '/api/community-hatch' }

export default async function communityHatch(request: Request, context: Context) {
  try {
    const accountConfig = readConfig(context.deploy.context, process.env, context.site?.id)
    if (!accountConfig) return response({ error: 'disabled' }, 404)
    const badRequest = validateRequest(request, accountConfig.origin)
    if (badRequest) return badRequest
    const hatchConfig = readEventConfig(accountConfig.event)
    if (!hatchConfig) return response({ error: 'disabled' }, 404)

    const db = await previewPool(accountConfig)
    const wallet = await accountWallet(request, accountConfig, db)
    const event = createCommunityHatchService({ db, config: hatchConfig })
    if (request.method === 'GET') return response(await event.get(wallet))
    if (!wallet) return response({ error: 'wallet_required' }, 401)
    const body = await readBody(request)
    return response(await event.act(wallet, body.action))
  } catch (error) {
    return requestError(error)
  }
}
