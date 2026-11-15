import type { Config, Context } from '@netlify/functions'
import { requestError, validateRequest } from '../cozmling/http.mjs'
import { previewAccount, readConfig } from '../cozmling/runtime.mjs'
import { createWalletHandler, walletResponse } from '../cozmling/wallet-runtime.mjs'

export const config: Config = { path: '/api/cozmling-wallet' }

export default async (request: Request, context: Context) => {
  try {
    const settings = readConfig(context.deploy.context, process.env, context.site?.id)
    if (!settings) return walletResponse({ error: 'disabled' }, 404)
    const badRequest = validateRequest(request, settings.origin)
    if (badRequest) return badRequest
    const { db, config } = await previewAccount(settings)
    return await createWalletHandler(config, db)(request)
  } catch (error) {
    return requestError(error)
  }
}
