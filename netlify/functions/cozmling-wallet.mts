import type { Config, Context } from '@netlify/functions'
import { requestError, validateRequest } from '../cozmling/http.mjs'
import { previewPool, readConfig } from '../cozmling/runtime.mjs'
import { createWalletHandler, walletResponse } from '../cozmling/wallet-runtime.mjs'

export const config: Config = { path: '/api/cozmling-wallet' }

export default async (request: Request, context: Context) => {
  try {
    const settings = readConfig(context.deploy.context)
    if (!settings) return walletResponse({ error: 'disabled' }, 404)
    const badRequest = validateRequest(request, settings.origin)
    if (badRequest) return badRequest
    return await createWalletHandler(settings, await previewPool(settings))(request)
  } catch (error) {
    return requestError(error)
  }
}
