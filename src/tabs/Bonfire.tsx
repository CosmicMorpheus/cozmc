import { useWallet } from '@txnlab/use-wallet-react'
import { useChain } from '../lib/data'
import { BonfireStats, WishFeed } from '../components/Burn'
import { burnerBoard } from '../lib/boards'
import { compact } from '../lib/format'
import { Addr, Failed, Loading } from '../components/ui'

/* Community › Bonfire: everything burned, the community goal, and the wishes people left. */
export function Bonfire({ onBurn }: { onBurn: () => void }) {
  const { burns, reload } = useChain()
  const { activeAddress } = useWallet()
  const top = burns.data ? burnerBoard(burns.data).slice(0, 10) : null

  return (
    <>
      <header className="page-head">
        <h1>The Bonfire</h1>
        <p>COZMC sent to the Bonfire is gone for good. Every burn can carry a wish, and every one is written on Algorand. Each score posted in the arcade feeds it too.</p>
      </header>

      <section className="bf" aria-label="Burned so far">
        <BonfireStats onBurn={onBurn} />
      </section>

      <section className="split">
        <div className="panel">
          <header className="panel__head"><h2>Latest wishes</h2></header>
          <WishFeed limit={12} onBurn={onBurn} />
        </div>
        <div className="panel">
          <header className="panel__head"><h2>Top burners</h2></header>
          {!top ? (burns.error ? <Failed what="the Bonfire" retry={() => reload('burns')} /> : <Loading what="the Bonfire" />) : top.length ? (
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
