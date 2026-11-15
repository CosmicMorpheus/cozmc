import type { Config, Context } from '@netlify/functions'
import { companionProblem } from '../../src/cozmling/store/validators'
import { createAccountService } from '../cozmling/account.mjs'
import { readBody, requestError, response, validateRequest } from '../cozmling/http.mjs'
import { previewPool, readConfig } from '../cozmling/runtime.mjs'
import { accountWallet } from '../cozmling/wallet-runtime.mjs'

export const config: Config = { path: '/api/cozmling-account' }

export default async function cozmlingAccount(request: Request, context: Context) {
  try {
    const accountConfig = readConfig(context.deploy.context, process.env, context.site?.id)
    if (!accountConfig) return response({ error: 'disabled' }, 404)
    const badRequest = validateRequest(request, accountConfig.origin)
    if (badRequest) return badRequest

    const db = await previewPool(accountConfig)
    const wallet = await accountWallet(request, accountConfig, db)
    if (!wallet) return response({ error: 'wallet_required' }, 401)
    const account = createAccountService({ db, validateRecord: companionProblem })
    if (request.method === 'GET') return response(await account.list(wallet))

    const body = await readBody(request)
    if (body.action === 'adopt') return response(await account.adopt(wallet, body.snapshot))
    if (body.action === 'save') return response(await account.save(wallet, body))
    return response({ error: 'invalid_action' }, 400)
  } catch (error) {
    return requestError(error)
  }
}
