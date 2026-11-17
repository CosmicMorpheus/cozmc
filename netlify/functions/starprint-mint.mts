import type { Config, Context } from '@netlify/functions'
import algosdk from 'algosdk'
import { readBody, requestError, response, validateRequest } from '../cozmling/http.mjs'
import { createMintService, TESTNET } from '../cozmling/mint.mjs'
import { previewPool, readConfig } from '../cozmling/runtime.mjs'
import { accountWallet } from '../cozmling/wallet-runtime.mjs'

export const config: Config = { path: '/api/starprint-mint' }

/* Starprint NFTs on TestNet, for the wallet that owns them. Off unless COZMC_STARPRINT_MINT=1, and only
   where the wallet account runs (previews, never cozmc.us). GET: the issuer and this wallet's mints.
   POST { companionId, publicName? }: mint that hatched Starprint (or carry on minting it). */
export default async function starprintMint(request: Request, context: Context) {
  try {
    const accountConfig = readConfig(context.deploy.context, process.env, context.site?.id)
    if (!accountConfig || process.env.COZMC_STARPRINT_MINT !== '1') return response({ error: 'disabled' }, 404)
    const badRequest = validateRequest(request, accountConfig.origin)
    if (badRequest) return badRequest
    const db = await previewPool(accountConfig)
    const cap = Number(process.env.COZMC_STARPRINT_DAILY_CAP ?? 20)
    const mints = createMintService({
      db, origin: accountConfig.origin, dailyCap: Number.isInteger(cap) && cap >= 0 ? cap : 20,
      algod: new algosdk.Algodv2('', TESTNET.algod, ''), indexer: new algosdk.Indexer('', TESTNET.indexer, ''),
    })
    const wallet = await accountWallet(request, accountConfig, db)
    if (request.method === 'GET') return response({ ...(await mints.info()), ...(wallet ? await mints.list(wallet) : { mints: [] }) })
    if (!wallet) return response({ error: 'wallet_required' }, 401)
    const body = await readBody(request)
    return response({ mint: await mints.mint(wallet, body.companionId, { publicName: body.publicName ?? null }) })
  } catch (error) {
    return requestError(error)
  }
}
