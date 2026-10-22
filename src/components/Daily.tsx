import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { GAMES } from '../arcade/games'
import { useChain } from '../lib/data'
import { gameBoard } from '../lib/boards'
import { countdown, dailyNo, msToReset, utcDay } from '../lib/daily'
import { liveStreak, todaysDaily, useProfile } from '../lib/profile'
import { fmt } from '../lib/format'
import { Addr } from './ui'
import { Icon } from './Pixel'
import type { TabId } from '../App'
import { GameThumb } from './GameThumb'

/* Home's Daily Challenge panel: one row per game, today's leader, your run, a way in. */
export function DailyPanel({ go }: { go: (t: TabId, sub?: string) => void }) {
  const { scores } = useChain()
  const { activeAddress } = useWallet()
  const profile = useProfile()
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30_000); return () => clearInterval(t) }, [])
  const day = utcDay(), streak = liveStreak(profile)

  return (
    <section className="panel daily" aria-labelledby="daily-title">
      <header className="daily__head">
        <h2 id="daily-title"><span className="daily__no">Daily #{dailyNo(day)}</span> Same run for everyone</h2>
        <p className="small muted">Resets in {countdown(msToReset())}{streak > 0 && <> · your streak <b className="phos">{streak}</b></>}</p>
      </header>
      <ul className="daily__rows">
        {GAMES.map(g => {
          const lead = gameBoard(g, scores.data ?? [], day)[0]
          const mine = todaysDaily(g.id, profile)
          return (
            <li key={g.id}>
              <span className="daily__game"><GameThumb game={g} className="thumb--xs" />{g.title}</span>
              <span className="daily__lead">{lead ? <><b>{fmt(lead.score)}</b> <Addr address={lead.player} you={lead.player === activeAddress} /></> : <span className="muted">No one yet today</span>}</span>
              <span className="daily__mine">{mine != null ? <>You <b>{fmt(mine)}</b></> : <span className="muted">Not played</span>}</span>
              <button className="btn btn--sm btn--phos" onClick={() => go('arcade', `${g.id}/daily`)}><Icon name="play" size={8} /> {mine != null ? 'Again' : 'Play'}</button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
