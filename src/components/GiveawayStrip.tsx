import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useChain } from '../lib/data'
import { compact } from '../lib/format'
import { countdownTo, prizeFor, weekEnd, weekOf, weekTickets } from '../lib/giveaway'
import { Icon } from './Pixel'

/* A one-line pitch for the weekly giveaway (Home, Arcade): prize, tickets so far, time left. */
export function GiveawayStrip() {
  const { scores, tickets } = useChain()
  const { activeAddress } = useWallet()
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30_000); return () => clearInterval(t) }, [])
  const week = Math.max(1, weekOf())
  const all = scores.data && tickets.data ? weekTickets(week, scores.data, tickets.data) : null
  const mine = all && activeAddress ? all.filter(t => t.address === activeAddress).length : 0
  return (
    <a className="gw-strip" href="#/arcade/giveaway">
      <span className="gw-strip__icon"><Icon name="gift" size={18} /></span>
      <span className="gw-strip__text">
        <b>Weekly giveaway: {compact(prizeFor(week))} COZMC.</b> Every score you post is a ticket, plus one free ticket a week.
        <span className="muted"> {all ? `${all.length} ${all.length === 1 ? 'ticket' : 'tickets'} so far` : ''}{mine ? `, ${mine} yours` : ''}. Drawn in {countdownTo(weekEnd(week))}.</span>
      </span>
      <span className="gw-strip__go">Enter →</span>
    </a>
  )
}
