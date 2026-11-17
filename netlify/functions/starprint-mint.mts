import type { Config, Context } from '@netlify/functions'
import { readBody, requestError, response, validateRequest } from '../cozmling/http.mjs'
import { FEE_MICRO } from '../cozmling/mint.mjs'
import { mintServiceFor } from '../cozmling/mint-runtime.mjs'
import { mintPausedNow, previewPool, readConfig } from '../cozmling/runtime.mjs'
import { accountWallet } from '../cozmling/wallet-runtime.mjs'

export const config: Config = { path: '/api/starprint-mint' }

/* Starprint NFTs, for the wallet that owns them. Off unless the mint switch (COZMC_STARPRINT_MINT=1) is on where
   the wallet account runs: previews, and cozmc.us once production is configured (see runtime.mjs). GET: the issuer and this wallet's mints.
   POST { companionId, publicName? }: start minting that hatched Starprint; the reply says what fee to pay.
   POST { companionId, feeTxid }: once the fee payment has confirmed, mint it (or carry on minting it).
   POST { companionId, action: 'deliver' }: send the minted Starprint to the wallet, once it has opted in.
   TestNet unless COZMC_STARPRINT_NETWORK=mainnet AND COZMC_STARPRINT_MAINNET=1 (Mark's switch), with the issuer
   key in COZMC_STARPRINT_ISSUER_MNEMONIC (a Netlify secret) and Mark's manager in COZMC_STARPRINT_MANAGER.
   Limits: COZMC_STARPRINT_DAILY_CAP (default 20), COZMC_STARPRINT_MONTHLY_BUDGET_ALGO (none by default),
   COZMC_STARPRINT_LOW_BALANCE_ALGO (default 2), and the pause COZMC_STARPRINT_PAUSED=1. */
export default async function starprintMint(request: Request, context: Context) {
  try {
    const accountConfig = readConfig(context.deploy.context, process.env, context.site?.id)
    if (!accountConfig || !accountConfig.switches.mint) return response({ error: 'disabled' }, 404)
    const badRequest = validateRequest(request, accountConfig.origin)
    if (badRequest) return badRequest
    // the fast pause (COZMC_STARPRINT_PAUSED=1): nothing new is started, signed or sent; what's queued or paid for
    // is kept and carries on when the pause is lifted
    if (request.method !== 'GET' && accountConfig.switches.mintPaused) return response({ error: 'paused' }, 503)
    const db = await previewPool(accountConfig)
    // the instant pause, set from the database without a redeploy
    const paused = accountConfig.switches.mintPaused || await mintPausedNow(db)
    if (request.method !== 'GET' && paused) return response({ error: 'paused' }, 503)
    const mints = mintServiceFor(accountConfig, db)
    const wallet = await accountWallet(request, accountConfig, db)
    if (request.method === 'GET') return response({ ...(await mints.info()), feeMicro: FEE_MICRO, paused, ...(wallet ? await mints.list(wallet) : { mints: [] }) })
    if (!wallet) return response({ error: 'wallet_required' }, 401)
    const body = await readBody(request)
    if (body.action === 'deliver') return response({ mint: await mints.deliver(wallet, body.companionId) })
    return response({ mint: await mints.mint(wallet, body.companionId, { publicName: body.publicName ?? null, feeTxid: body.feeTxid ?? null }) })
  } catch (error) {
    return requestError(error)
  }
}
