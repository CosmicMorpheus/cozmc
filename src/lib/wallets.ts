import { NetworkConfigBuilder, NetworkId, WalletManager } from '@txnlab/use-wallet-react'
import { pera } from '@txnlab/use-wallet-pera'
import { defly } from '@txnlab/use-wallet-defly'
import { exodus } from '@txnlab/use-wallet-exodus'
import { lute } from '@galaxypay/use-wallet-lute'
import { ALGOD } from '../config'

export const manager = new WalletManager({
  wallets: [pera(), defly(), lute({ siteName: 'COZMC' }), exodus()],
  networks: new NetworkConfigBuilder().mainnet({ algod: { baseServer: ALGOD, port: '', token: '' } }).build(),
  defaultNetwork: NetworkId.MAINNET,
})

/* Pera's first connect is slow: after the click it downloads its SDK, then fetches its bridge
   config (uncached, 1–2 s from Pera's server), and only then shows the QR. Both start here as
   soon as the wallet list opens, so the QR is ready almost as soon as Pera is picked. */
const PERA_CONFIG = 'https://wc.perawallet.app/config.json'
const FRESH_MS = 60_000
let early: { at: number; res: Promise<Response> } | null = null
let shimmed = false

export function prewarmWallets() {
  // build the WalletConnect clients now (loads their SDKs); connect() reuses them
  for (const key of ['pera', 'defly']) {
    const w = manager.getWallet(key) as unknown as { client: unknown; initializeClient?: () => Promise<unknown> } | undefined
    if (w && !w.client) w.initializeClient?.().catch(() => { /* connect() will retry */ })
  }
  if (early && Date.now() - early.at < FRESH_MS) return
  early = { at: Date.now(), res: fetch(PERA_CONFIG, { cache: 'no-store' }) }
  early.res.catch(() => { /* Pera falls back to fetching it itself */ })
  if (shimmed) return
  shimmed = true
  // hand Pera the response we already have the first time it asks (once, and only while fresh)
  const real = window.fetch
  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === PERA_CONFIG && early && Date.now() - early.at < FRESH_MS) {
      const { res } = early
      early = null
      return res.catch(() => real.call(window, input, init))
    }
    return real.call(window, input, init)
  }
}
