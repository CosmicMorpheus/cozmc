import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useChain } from '../lib/data'
import { TIERS, nextTier, rangeLabel, tierOf } from '../lib/tiers'
import { compact, fmt, pct } from '../lib/format'
import { Addr, Failed, Loading } from '../components/ui'
import { TierBadge } from '../components/Pixel'
import { useMe } from '../components/Wallet'
import { ASA_TOTAL, HAYSTACK_INVITE } from '../config'

export function Holders() {
  const { holders, burned, reload } = useChain()
  const { activeAddress } = useWallet()
  const { holding: balance, openConnect } = useMe()
  const [all, setAll] = useState(false)

  if (holders.error && !holders.data) return <><Head /><Failed what="holders" retry={() => reload('holders')} /></>
  if (!holders.data) return <><Head /><Loading what="holders" /></>

  const ranked = holders.data.filter(h => !h.excluded)
  const ranks = new Map(ranked.map((h, i) => [h.address, i + 1]))
  const circulating = ranked.reduce((s, h) => s + h.amount, 0)
  const farmed = holders.data.reduce((s, h) => s + h.farmed, 0)
  const mine = activeAddress ? holders.data.find(h => h.address === activeAddress) : undefined
  const counts = TIERS.map(t => ranked.filter(h => tierOf(h.amount) === t))
  const myRank = activeAddress ? ranks.get(activeAddress) : undefined
  const myTier = balance != null ? tierOf(balance) : null
  const nt = myTier ? nextTier(myTier) : null
  const shown = all ? holders.data : holders.data.slice(0, 50)

  return (
    <>
      <Head />

      {activeAddress ? (
        <section className="me-card">
          {myTier && balance != null ? (
            <>
              <TierBadge tier={myTier} size={56} />
              <div className="me-card__body">
                <p className="me-card__lbl">Your rank</p>
                <p className="me-card__tier" style={{ color: myTier.color }}>{myTier.name}{myRank && <span> · #{myRank} of {ranked.length}</span>}</p>
                <p className="me-card__bal">{fmt(balance, 2)} COZMC</p>
                {mine && (mine.farmed > 0 || mine.lp > 0) && <p className="me-card__sub">{fmt(mine.wallet, 2)} in your wallet{mine.farmed > 0 && `, ${fmt(mine.farmed)} staked in Pact farms`}{mine.lp > 0 && `, ${fmt(mine.lp)} in LP`}</p>}
                {nt && (
                  <div className="xp" aria-label={`Progress to ${nt.name}`}>
                    <div className="xp__bar"><i style={{ width: `${Math.min(100, ((balance - myTier.min) / (nt.min - myTier.min)) * 100)}%`, background: nt.color }} /></div>
                    <p className="xp__txt">{fmt(nt.min - balance)} more to <b style={{ color: nt.color }}>{nt.name}</b></p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="me-card__none">This wallet holds no COZMC yet. <a href={HAYSTACK_INVITE} target="_blank" rel="noopener">Get some on Haystack ↗</a> and you’ll start as Stardust.</p>
          )}
        </section>
      ) : (
        <section className="me-card me-card--cta"><p>Connect a wallet to see your rank.</p><button className="btn btn--phos btn--sm" onClick={openConnect}>Connect</button></section>
      )}

      <ol className="ladder" aria-label="Tiers">
        {TIERS.map((t, i) => (
          <li key={t.id} className={myTier === t ? 'is-me' : ''} style={{ ['--tc' as string]: t.color }}>
            <TierBadge tier={t} size={40} />
            <p className="ladder__name">{t.name}</p>
            <p className="ladder__range">{rangeLabel(t)}</p>
            <p className="ladder__count"><b>{counts[i].length}</b> {counts[i].length === 1 ? 'holder' : 'holders'}</p>
            <p className="ladder__share">{pct(counts[i].reduce((s, h) => s + h.amount, 0), ASA_TOTAL).toFixed(1)}% of supply</p>
          </li>
        ))}
      </ol>

      <div className="stats-row">
        <p><b>{ranked.length}</b> ranked holders</p>
        <p><b>{compact(circulating)}</b> held by holders</p>
        <p><b>{compact(farmed)}</b> staked in Pact farms</p>
        <p><b className="fire">{compact(burned.data ?? 0)}</b> burned</p>
      </div>

      <div className="board-wrap"><table className="board">
        <thead><tr><th>Rank</th><th>Holder</th><th>Tier</th><th className="num">COZMC</th><th className="num hide-sm">Supply</th></tr></thead>
        <tbody>
          {shown.map(h => {
            const t = tierOf(h.amount), r = ranks.get(h.address)
            return (
              <tr key={h.address} className={`${h.excluded ? 'flagged' : ''}${h.address === activeAddress ? ' me' : ''}`}>
                <td className="rank">{r ?? '—'}</td>
                <td><span className="who"><Addr address={h.address} you={h.address === activeAddress} />{h.label && <span className="flag">{h.label}</span>}</span></td>
                <td>{h.excluded ? <span className="muted small">Not ranked</span> : <TierBadge tier={t} size={16} label />}</td>
                <td className="num">{fmt(h.amount)}{(h.farmed > 0 || h.lp > 0) && !h.excluded && <span className="holding-note">incl. {[h.farmed > 0 && `${compact(h.farmed)} farmed`, h.lp > 0 && `${compact(h.lp)} in LP`].filter(Boolean).join(', ')}</span>}</td>
                <td className="num hide-sm muted">{pct(h.amount, ASA_TOTAL).toFixed(2)}%</td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      {holders.data.length > 50 && <button className="btn btn--ghost btn--sm" onClick={() => setAll(a => !a)}>{all ? 'Show top 50' : `Show all ${holders.data.length}`}</button>}
      <p className="fineprint">Read live from Algorand. COZMC staked in Pact farms, and COZMC inside ALGO/COZMC LP tokens (valued at the pool’s current COZMC per LP), counts toward its owner’s rank. Pools, contracts and the Bonfire are listed but not ranked.</p>
    </>
  )
}

function Head() {
  return (
    <header className="page-head">
      <h1>Holders</h1>
      <p>Every wallet holding COZMC, ranked from Stardust to Black Hole by how much it holds, including COZMC in Pact liquidity and farms.</p>
    </header>
  )
}
