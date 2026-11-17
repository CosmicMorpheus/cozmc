import type { Config } from '@netlify/functions'
import { mintServiceFor } from '../cozmling/mint-runtime.mjs'
import { previewPool, readConfig } from '../cozmling/runtime.mjs'

/* Every hour, while minting is switched on: is the Starprint minting account running low? If its spendable ALGO is
   under COZMC_STARPRINT_LOW_BALANCE_ALGO (default 2), it says so in the site's function logs and, if Mark has set
   COZMC_ALERT_WEBHOOK_URL (for example a private Discord channel's webhook, kept as a Netlify secret), posts a
   one-line alert there. It only reads; it never signs, sends or changes anything. The webhook URL is never logged. */
export const config: Config = { schedule: '@hourly' }

export default async function starprintWatch() {
  const accountConfig = readConfig(process.env.CONTEXT ?? 'production', process.env, process.env.SITE_ID)
  if (!accountConfig?.switches.mint) return
  const db = await previewPool(accountConfig)
  const info = await mintServiceFor(accountConfig, db).info()
  if (info.lowBalance !== true) return
  const text = `COZMC Starprints: the ${info.network} minting account ${info.issuer} has ${info.spendableAlgo?.toFixed(3)} ALGO spendable, `
    + `under the ${process.env.COZMC_STARPRINT_LOW_BALANCE_ALGO ?? 2} ALGO alert level. Top it up (see STARPRINT-NFT-REVIEW.md).`
  console.error(text)
  const hook = process.env.COZMC_ALERT_WEBHOOK_URL
  if (hook) {
    try {
      await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: text }) })
    } catch {
      console.error('The low-balance alert could not be posted to the alert webhook.')
    }
  }
}
