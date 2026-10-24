import { useWallet } from '@txnlab/use-wallet-react'
import { useChain } from '../lib/data'
import { GoalMeter, WishFeed } from '../components/Burn'
import { burnerBoard } from '../lib/boards'
import { compact, fmt } from '../lib/format'
import { Addr, Loading } from '../components/ui'
import { Flame } from '../components/Pixel'
import { BONFIRE_ADDRESS, EXPLORER_ACCOUNT } from '../config'

/* Community › Bonfire: everything burned, the community goal, and the wishes people left. */
export function Bonfire({ onBurn }: { onBurn: () => void }) {
  const { burned, burns } = useChain()
  const { activeAddress } = useWallet()
  const top = burns.data ? burnerBoard(burns.data).slice(0, 10) : null
  const wallets = burns.data ? new Set(burns.data.map(b => b.sender)).size : null

  return (
    <>
      <header className="page-head">
        <h1>The Bonfire</h1>
        <p>COZMC sent to the Bonfire is gone for good. Every burn can carry a wish, and every one is written on Algorand. Each score posted in the arcade feeds it too.</p>
      </header>

      <section className="bf" aria-label="Burned so far">
        <div>
          <p className="bf__num">{burned.data != null ? compact(burned.data) : '…'}</p>
          <p className="bf__lbl">COZMC burned{wallets != null && <> by {fmt(wallets)} {wallets === 1 ? 'wallet' : 'wallets'}</>}</p>
        </div>
        {burned.data != null && <GoalMeter burned={burned.data} full />}
        <div className="row">
          <button className="btn btn--fire" onClick={onBurn}><Flame size={14} /> Burn COZMC</button>
          <a className="link" href={EXPLORER_ACCOUNT(BONFIRE_ADDRESS)} target="_blank" rel="noopener">See the Bonfire on-chain ↗</a>
        </div>
      </section>

      <section className="split">
        <div className="panel">
          <header className="panel__head"><h2>Latest wishes</h2></header>
          <WishFeed limit={12} onBurn={onBurn} />
        </div>
        <div className="panel">
          <header className="panel__head"><h2>Top burners</h2></header>
          {!top ? <Loading what="the Bonfire" /> : top.length ? (
            <ol className="mini-board">
              {top.map((r, i) => (
                <li key={r.sender} className={r.sender === activeAddress ? 'me' : ''}>
                  <span className="mb__rank">{i + 1}</span>
                  <Addr address={r.sender} you={r.sender === activeAddress} />
                  <span className="mb__score fire">{compact(r.total)}</span>
                </li>
              ))}
            </ol>
          ) : <div className="empty"><p>Nobody has burned yet. Be the first name on this list.</p></div>}
        </div>
      </section>
    </>
  )
}
