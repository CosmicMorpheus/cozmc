import { useMemo, type ReactNode } from 'react'
import { GAMES } from '../arcade/games'
import { plausible } from '../arcade/types'
import { useChain } from '../lib/data'
import { dailyNo } from '../lib/daily'
import { tierOf } from '../lib/tiers'
import { ago, compact, fmt } from '../lib/format'
import { Addr } from './ui'
import { Flame, Icon } from './Pixel'

/* The live wire under the header: burns, posted runs and new holders, newest first. */
const BLOCK_S = 2.8      // approx. Algorand block time, to date opt-ins (the indexer only gives their round)

type Item = { key: string; round: number; time: number; node: ReactNode }

export function Ticker() {
  const { burns, scores, holders, round } = useChain()

  const items = useMemo(() => {
    const out: Item[] = []
    const now = Date.now() / 1000
    for (const b of burns.data ?? []) if (!b.arcade) out.push({   // arcade burns ride along on their score's line
      key: `b${b.txid}`, round: b.round, time: b.time,
      node: <><Flame size={11} /> <Addr address={b.sender} link={false} /> burned <b className="fire">{compact(b.amount)}</b>{b.wish && <q>{b.wish.length > 48 ? `${b.wish.slice(0, 46).trim()}…` : b.wish}</q>}</>,
    })
    for (const s of scores.data ?? []) {
      const g = GAMES.find(x => x.id === s.game)
      if (!g || !plausible(g, s.score, s.ms)) continue
      out.push({
        key: `s${s.txid}`, round: s.round, time: s.time,
        node: <><Icon name="arcade" size={11} /> <Addr address={s.player} link={false} /> scored <b className="phos">{fmt(s.score)}</b> in {g.title}{s.day != null && <em> · Daily #{dailyNo(s.day)}</em>}{s.burned ? <> · burned <b className="fire">{compact(s.burned)}</b></> : null}</>,
      })
    }
    if (round) for (const h of holders.data ?? []) {
      if (h.excluded || !h.since) continue
      const t = tierOf(h.amount)
      out.push({
        key: `h${h.address}`, round: h.since, time: now - (round - h.since) * BLOCK_S,
        node: <><Icon name="holders" size={11} /> <Addr address={h.address} link={false} /> joined, now <b style={{ color: t.color }}>{t.name}</b></>,
      })
    }
    return out.sort((a, b) => b.round - a.round).slice(0, 24)
  }, [burns.data, scores.data, holders.data, round != null])   // eslint-disable-line react-hooks/exhaustive-deps

  if (items.length < 3) return null
  const row = (dup: boolean) => items.map(i => (
    <li key={i.key + (dup ? '-2' : '')} aria-hidden={dup || undefined}>{i.node}<time>{ago(i.time)}</time></li>
  ))
  return (
    <div className="ticker" aria-label="Recent activity on-chain">
      <span className="ticker__live"><i />Live</span>
      <div className="ticker__view">
        <ul className="ticker__track" style={{ ['--n' as string]: items.length }}>{row(false)}{row(true)}</ul>
      </div>
    </div>
  )
}
