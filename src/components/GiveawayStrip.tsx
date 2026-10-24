import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useChain } from '../lib/data'
import { compact } from '../lib/format'
import { countdownTo, entrants, extraFor, prizeFor, weekEnd, weekOf, weekTickets } from '../lib/giveaway'
import { GIVEAWAY } from '../config'
import { Icon } from './Pixel'

/** This week's tickets (null while loading), re-read every `ms`. */
function useThisWeek(ms: number) {
  const { scores, tickets, pets } = useChain()
  const { activeAddress } = useWallet()
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), ms); return () => clearInterval(t) }, [ms])
  const week = Math.max(1, weekOf())
  const all = scores.data && tickets.data && pets.data ? weekTickets(week, scores.data, tickets.data, pets.data) : null
  const mine = all && activeAddress ? all.filter(t => t.address === activeAddress).length : 0
  return { week, all, mine, connected: !!activeAddress }
}

/* A one-line pitch for the weekly giveaway (Arcade floor): prize, tickets so far, time left. */
export function GiveawayStrip() {
  const { week, all, mine } = useThisWeek(30_000)
  return (
    <a className="gw-strip" href="#/arcade/giveaway">
      <span className="gw-strip__icon"><Icon name="gift" size={18} /></span>
      <span className="gw-strip__text">
        <b>Weekly giveaway: {compact(prizeFor(week))} COZMC.</b> Every score you post is a ticket, plus a free ticket each week and a bonus for Cozmling check-ins.
        <span className="muted"> {all ? `${all.length} ${all.length === 1 ? 'ticket' : 'tickets'} so far` : ''}{mine ? `, ${mine} yours` : ''}. Drawn in {countdownTo(weekEnd(week))}.</span>
      </span>
      <span className="gw-strip__go">Enter →</span>
    </a>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')

/* Home's giveaway banner: the prize, a live countdown to the draw, and every way in. */
export function GiveawayBanner() {
  const { week, all, mine, connected } = useThisWeek(1000)
  const left = Math.max(0, Math.floor((weekEnd(week) - Date.now()) / 1000))
  const clock: [number, string][] = [[Math.floor(left / 86400), 'days'], [Math.floor((left % 86400) / 3600), 'hours'], [Math.floor((left % 3600) / 60), 'min'], [left % 60, 'sec']]
  const players = all ? entrants(all).length : 0
  return (
    <section className="gwb" aria-labelledby="gwb-h">
      <div className="gwb__main">
        <p className="gwb__kicker"><Icon name="gift" size={13} /> Week {week} giveaway</p>
        <h2 id="gwb-h" className="gwb__prize">{compact(prizeFor(week))} <span>COZMC</span></h2>
        {extraFor(week) && <p className="gwb__extra">plus {extraFor(week)}</p>}
        <div className="gwb__clock" role="timer" aria-label={`Drawn in ${countdownTo(weekEnd(week))}`}>
          {clock.map(([v, l]) => <span key={l}><b>{pad(v)}</b><small>{l}</small></span>)}
        </div>
        <p className="gwb__sub">
          {all ? <>{all.length} {all.length === 1 ? 'ticket' : 'tickets'} from {players} {players === 1 ? 'player' : 'players'} so far.</> : 'Counting tickets…'}
          {connected && all && <> You have <b>{mine}</b>.</>} Drawn Monday 00:00 UTC.
        </p>
      </div>
      <ul className="gwb__ways" aria-label="Ways to get tickets">
        <li><span className="gwb__ico"><Icon name="play" size={10} /></span><b>Post a score</b><span>Every run you post in the arcade is a ticket. No limit.</span></li>
        <li><span className="gwb__ico"><Icon name="gift" size={13} /></span><b>Free ticket</b><span>One for every wallet, every week. Just sign a note.</span></li>
        <li><span className="gwb__ico"><Icon name="cozmling" size={13} /></span><b>Cozmling check-ins</b><span>Check in on {GIVEAWAY.checkinDays} days in a week for a bonus ticket.</span></li>
      </ul>
      <div className="gwb__cta">
        <a className="btn btn--gold" href="#/arcade/giveaway">Enter the giveaway</a>
        <a className="btn btn--ghost" href="#/arcade"><Icon name="play" size={10} /> Play a game</a>
      </div>
    </section>
  )
}

/* The small gold giveaway button in the header, on every page. */
export function GiveawayChip() {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30_000); return () => clearInterval(t) }, [])
  const week = Math.max(1, weekOf())
  return (
    <a className="gwchip" href="#/arcade/giveaway" aria-label={`Weekly giveaway: ${compact(prizeFor(week))} COZMC, drawn in ${countdownTo(weekEnd(week))}`}>
      <Icon name="gift" size={13} />
      <span className="gwchip__prize">Win {compact(prizeFor(week))}</span>
      <span className="gwchip__time">{countdownTo(weekEnd(week))}</span>
    </a>
  )
}
