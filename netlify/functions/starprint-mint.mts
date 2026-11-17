import type { Config, Context } from '@netlify/functions'
import algosdk from 'algosdk'
import { readBody, requestError, response, validateRequest } from '../cozmling/http.mjs'
import { createMintService, FEE_MICRO, MAINNET, TESTNET } from '../cozmling/mint.mjs'
import { previewPool, readConfig } from '../cozmling/runtime.mjs'
import { accountWallet } from '../cozmling/wallet-runtime.mjs'

export const config: Config = { path: '/api/starprint-mint' }

/* Starprint NFTs on TestNet, for the wallet that owns them. Off unless COZMC_STARPRINT_MINT=1, and only
   where the wallet account runs (previews, never cozmc.us). GET: the issuer and this wallet's mints.
   POST { companionId, publicName? }: start minting that hatched Starprint; the reply says what fee to pay.
   POST { companionId, feeTxid }: once the fee payment has confirmed, mint it (or carry on minting it).
   POST { companionId, action: 'deliver' }: send the minted Starprint to the wallet, once it has opted in.
   TestNet unless COZMC_STARPRINT_NETWORK=mainnet AND COZMC_STARPRINT_MAINNET=1 (Mark's switch), with the issuer
   key in COZMC_STARPRINT_ISSUER_MNEMONIC (a Netlify secret) and Mark's manager in COZMC_STARPRINT_MANAGER. */
export default async function starprintMint(request: Request, context: Context) {
  try {
    const accountConfig = readConfig(context.deploy.context, process.env, context.site?.id)
    if (!accountConfig || process.env.COZMC_STARPRINT_MINT !== '1') return response({ error: 'disabled' }, 404)
    const badRequest = validateRequest(request, accountConfig.origin)
    if (badRequest) return badRequest
    const db = await previewPool(accountConfig)
    const cap = Number(process.env.COZMC_STARPRINT_DAILY_CAP ?? 20)
    const mainnet = process.env.COZMC_STARPRINT_NETWORK === 'mainnet' && process.env.COZMC_STARPRINT_MAINNET === '1'
    const net = mainnet ? MAINNET : TESTNET
    const mints = createMintService({
      db, origin: accountConfig.origin, dailyCap: Number.isInteger(cap) && cap >= 0 ? cap : 20,
      algod: new algosdk.Algodv2('', net.algod, ''), indexer: new algosdk.Indexer('', net.indexer, ''),
      mainnet, issuerMnemonic: process.env.COZMC_STARPRINT_ISSUER_MNEMONIC, managerAddress: process.env.COZMC_STARPRINT_MANAGER,
    })
    const wallet = await accountWallet(request, accountConfig, db)
    if (request.method === 'GET') return response({ ...(await mints.info()), feeMicro: FEE_MICRO, ...(wallet ? await mints.list(wallet) : { mints: [] }) })
    if (!wallet) return response({ error: 'wallet_required' }, 401)
    const body = await readBody(request)
    if (body.action === 'deliver') return response({ mint: await mints.deliver(wallet, body.companionId) })
    return response({ mint: await mints.mint(wallet, body.companionId, { publicName: body.publicName ?? null, feeTxid: body.feeTxid ?? null }) })
  } catch (error) {
    return requestError(error)
  }
}
