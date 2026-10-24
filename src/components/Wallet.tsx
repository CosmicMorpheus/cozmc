import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { Modal, useToast } from './ui'
import { TierBadge } from './Pixel'
import { useNfd } from '../lib/nfd'
import { fetchCozmcBalance } from '../lib/chain'
import { fmt, short } from '../lib/format'
import { tierOf } from '../lib/tiers'
import { EXPLORER_ACCOUNT } from '../config'
import { prewarmWallets } from '../lib/wallets'
import { useChain } from '../lib/data'

/* ---------- the connected wallet's COZMC, shared app-wide ----------
   balance = spendable COZMC in the wallet (burns, max buttons)
   holding = balance + COZMC in ALGO/COZMC LP + COZMC staked in Pact farms (tiers, ranks, skins) */
interface Me { balance: number | null; holding: number | null; loading: boolean; refresh: () => void; openConnect: () => void }
const MeCtx = createContext<Me>({ balance: null, holding: null, loading: false, refresh: () => {}, openConnect: () => {} })
export const useMe = () => useContext(MeCtx)

export function MeProvider({ children }: { children: ReactNode }) {
  const { activeAddress } = useWallet()
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const refresh = useCallback(() => {
    if (!activeAddress) { setBalance(null); return }
    setLoading(true)
    fetchCozmcBalance(activeAddress).then(b => setBalance(b), () => setBalance(null)).finally(() => setLoading(false))
  }, [activeAddress])
  useEffect(refresh, [refresh])
  const { holders } = useChain()
  const row = activeAddress ? holders.data?.find(h => h.address === activeAddress) : undefined
  const holding = row ? row.amount : balance
  return (
    <MeCtx.Provider value={{ balance, holding, loading, refresh, openConnect: () => setConnectOpen(true) }}>
      {children}
      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </MeCtx.Provider>
  )
}

/** Resolves once a wallet's own pop-up (Pera's or Defly's QR) has been shown and then removed. */
function walletPopupClosed(cancel: { done: boolean }) {
  return new Promise<void>(resolve => {
    let seen = false
    const t = setInterval(() => {
      if (cancel.done) { clearInterval(t); return }
      if (document.querySelector('[id$="-wallet-connect-modal-wrapper"]')) seen = true
      else if (seen) { clearInterval(t); resolve() }
    }, 250)
  })
}

/* ---------- wallet picker ---------- */
function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallets, activeAddress } = useWallet()
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const pending = useRef<{ from: string | null } | null>(null)
  useEffect(() => { if (open) { setErr(null); setBusy(null); pending.current = null; prewarmWallets() } }, [open])
  // however the connection lands, a newly active account means we're done
  useEffect(() => { if (open && pending.current && activeAddress && activeAddress !== pending.current.from) onClose() }, [open, activeAddress, onClose])
  return (
    <Modal open={open} onClose={onClose} labelledBy="connect-title" className="modal__box--narrow">
      <h2 id="connect-title" className="modal__title">Connect a wallet</h2>
      <p className="modal__lede">Games are free to play. A wallet lets you post scores and burn COZMC. Nothing is signed without your approval.</p>
      <ul className="wallets">
        {wallets.map(w => (
          <li key={w.walletKey}>
            <button className="wallet-opt" disabled={!!busy} onClick={async () => {
              setErr(null); setBusy(w.walletKey)
              pending.current = { from: activeAddress }
              const cancel = { done: false }
              try {
                if (!w.isConnected) {
                  // Pera/Defly can close their QR without ever settling connect() (e.g. the phone
                  // declines the session), so stop waiting once their pop-up is gone
                  const outcome = await Promise.race([
                    w.connect().then(() => 'connected' as const),
                    walletPopupClosed(cancel).then(() => new Promise(r => setTimeout(r, 1500))).then(() => 'closed' as const),
                  ])
                  if (outcome === 'closed') {
                    setErr(`${w.metadata.name} closed before the connection finished. If you approved it on your phone, try again: the request may have expired or been declined.`)
                    return
                  }
                }
                w.setActive()
                onClose()
              } catch (e: any) {
                setErr(e?.message?.includes('closed') || e?.message?.includes('rejected') ? 'Connection cancelled.' : `Couldn't connect to ${w.metadata.name}. ${w.metadata.name === 'Lute' || w.metadata.name === 'Exodus' ? 'Is the browser extension installed?' : 'Try again.'}`)
              } finally { cancel.done = true; setBusy(null) }
            }}>
              <img src={w.metadata.icon} alt="" width={32} height={32} />
              <span>{w.metadata.name}</span>
              <em>{busy === w.walletKey ? 'Waiting…' : w.isConnected ? 'Connected' : ''}</em>
            </button>
          </li>
        ))}
      </ul>
      {err && <p className="state state--err">{err}</p>}
    </Modal>
  )
}

/* ---------- header button + account menu ---------- */
export function WalletButton() {
  const { activeAddress, activeWallet } = useWallet()
  const { balance, holding, openConnect } = useMe()
  const nfd = useNfd(activeAddress)
  const toast = useToast()
  const [menu, setMenu] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const off = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setMenu(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false) }
    addEventListener('mousedown', off); addEventListener('keydown', esc)
    return () => { removeEventListener('mousedown', off); removeEventListener('keydown', esc) }
  }, [menu])

  if (!activeAddress) return <button className="btn btn--sm btn--phos" onClick={openConnect}>Connect</button>
  const tier = holding != null ? tierOf(holding) : null
  return (
    <div className="acct" ref={wrap}>
      <button className="acct__btn" onClick={() => setMenu(m => !m)} aria-expanded={menu} aria-haspopup="menu">
        {tier && <TierBadge tier={tier} size={16} />}
        <span>{nfd ?? short(activeAddress)}</span>
      </button>
      {menu && (
        <div className="acct__menu" role="menu">
          <p className="acct__bal">{holding == null ? 'No COZMC yet' : <><b>{fmt(holding, 2)}</b> COZMC{tier && <> · {tier.name}</>}{holding !== balance && <span className="acct__sub">{fmt(balance ?? 0, 2)} in wallet, the rest in Pact LP and farms</span>}</>}</p>
          {activeWallet && activeWallet.accounts.length > 1 && activeWallet.accounts.map(a => (
            <button key={a.address} role="menuitem" className={a.address === activeAddress ? 'on' : ''} onClick={() => { activeWallet.setActiveAccount(a.address); setMenu(false) }}>{a.name || short(a.address)}</button>
          ))}
          <button role="menuitem" onClick={async () => { try { await navigator.clipboard.writeText(activeAddress); toast('Address copied') } catch { toast('Copy failed') } setMenu(false) }}>Copy address</button>
          <a role="menuitem" href={EXPLORER_ACCOUNT(activeAddress)} target="_blank" rel="noopener">View on explorer ↗</a>
          <button role="menuitem" onClick={() => { activeWallet?.disconnect(); setMenu(false) }}>Disconnect</button>
        </div>
      )}
    </div>
  )
}
