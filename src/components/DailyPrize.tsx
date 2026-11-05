import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useChain } from '../lib/data'
import { fmt } from '../lib/format'
import { DAY_MS, utcDay } from '../lib/daily'
import { dailyLive, dayEnd, featuredGame, PRIZE_START_DAY, PRIZE_TOTAL, standings } from '../lib/dailyPrize'
import { DAILY_PRIZES } from '../config'
import { Addr } from './ui'
import { GameThumb } from './GameThumb'
import { Icon } from './Pixel'

const pad = (n: number) => String(n).padStart(2, '0')
export const PLACES = ['1st', '2nd', '3rd']
export const playHref = (gameId: string) => `#/arcade/${gameId}/daily`
export const weekday = (day: number, style: 'long' | 'short' = 'long') => new Date(day * DAY_MS).toLocaleDateString('en-US', { weekday: style, month: 'short', day: 'numeric', timeZone: 'UTC' })

/** Re-render every `ms` so clocks stay live. */
export function useTick(ms: number) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), ms); return () => clearInterval(t) }, [ms])
}

/** A big hh:mm:ss clock counting down to `to`. */
export function Clock({ to, label }: { to: number; label: string }) {
  const s = Math.max(0, Math.floor((to - Date.now()) / 1000))
  const parts: [number, string][] = s >= 86400
    ? [[Math.floor(s / 86400), 'days'], [Math.floor((s % 86400) / 3600), 'hours'], [Math.floor((s % 3600) / 60), 'min']]
    : [[Math.floor(s / 3600), 'hours'], [Math.floor((s % 3600) / 60), 'min'], [s % 60, 'sec']]
  return (
    <div className="gwb__clock" role="timer" aria-label={label}>
      {parts.map(([v, l]) => <span key={l}><b>{pad(v)}</b><small>{l}</small></span>)}
    </div>
  )
}

/** The prize ladder: 5,000 · 3,000 · 1,000. */
export function Ladder() {
  return (
    <ol className="dp-ladder" aria-label="Daily prizes">
      {DAILY_PRIZES.prizes.map((p, i) => <li key={i} className={`dp-ladder__p${i + 1}`}><small>{PLACES[i]}</small><b>{fmt(p)}</b></li>)}
    </ol>
  )
}

/* Home's headline feature: 9,000 COZMC every day, today's game, the clock, the live top three and Play Now. */
export function DailyBanner() {
  useTick(1000)
  const { scores } = useChain()
  const { activeAddress } = useWallet()
  const live = dailyLive(), today = utcDay(), day = live ? today : PRIZE_START_DAY
  const game = featuredGame(day)
  const top = live && scores.data ? standings(today, scores.data) : null
  const mine = top && activeAddress ? top.find(s => s.player === activeAddress) : undefined
  return (
    <section className="gwb dpb" aria-labelledby="dpb-h">
      <div className="gwb__main">
        <p className="gwb__kicker"><Icon name="trophy" size={13} /> {live ? 'Daily high-score prizes' : `Starts ${weekday(PRIZE_START_DAY)}`}</p>
        <h2 id="dpb-h" className="gwb__prize dpb__prize">{fmt(PRIZE_TOTAL)} <span>COZMC</span></h2>
        <p className="dpb__sub">up for grabs every day</p>
        <Ladder />
        {live
          ? <Clock to={dayEnd(today)} label={`Today’s competition ends in ${Math.ceil((dayEnd(today) - Date.now()) / 60000)} minutes`} />
          : <Clock to={PRIZE_START_DAY * DAY_MS} label="Time until the first prize day" />}
        <p className="gwb__sub">{live ? <>Today’s game ends at <b>00:00 UTC</b>. Top three on the board win.{mine && <> You’re <b>#{mine.rank}</b>.</>}</> : <>The first prize game is <b>{game.title}</b>. Every day after, a new game and a fresh 9,000 COZMC.</>}</p>
        <div className="gwb__cta">
          <a className="btn btn--gold dpb__play" href={playHref(game.id)}><Icon name="play" size={11} /> Play now</a>
          <a className="btn btn--ghost" href="#/arcade/prizes">How it works</a>
        </div>
      </div>
      <div className="dpb__side">
        <a className="dpb__game" href={playHref(game.id)} aria-label={`Play ${game.title}`}>
          <GameThumb game={game} />
          <span className="dpb__tag">{live ? 'Today’s prize game' : 'First prize game'}</span>
          <span className="dpb__title">{game.title}</span>
        </a>
        {live && (
          <ol className="mini-board dpb__board" aria-label="Today’s top three">
            {[0, 1, 2].map(i => {
              const s = top?.[i]
              return (
                <li key={i} className={s && s.player === activeAddress ? 'me' : ''}>
                  <span className="mb__rank">{i + 1}</span>
                  {s ? <Addr address={s.player} you={s.player === activeAddress} /> : <span className="muted">{top ? 'Open: take it' : '…'}</span>}
                  <span className="mb__score">{s ? fmt(s.score) : ''} <small className="dp-win">{fmt(DAILY_PRIZES.prizes[i])}</small></span>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}

/* The small gold header button: today's prize and time left, on every page. */
export function DailyChip() {
  useTick(30_000)
  const left = Math.max(0, dayEnd(utcDay()) - Date.now()), h = Math.floor(left / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000)
  return (
    <a className="gwchip" href="#/arcade/prizes" aria-label={`Daily prizes: ${fmt(PRIZE_TOTAL)} COZMC today, ends in ${h} hours ${m} minutes`}>
      <Icon name="trophy" size={13} />
      <span className="gwchip__prize">{fmt(PRIZE_TOTAL / 1000)}K daily</span>
      <span className="gwchip__time">{h ? `${h}h ${m}m` : `${m}m`}</span>
    </a>
  )
}

/* One line on the Arcade floor: today's prize game, the pot and time left. */
export function DailyStrip() {
  useTick(30_000)
  const live = dailyLive(), day = live ? utcDay() : PRIZE_START_DAY, game = featuredGame(day)
  const left = Math.max(0, dayEnd(utcDay()) - Date.now()), h = Math.floor(left / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000)
  return (
    <a className="gw-strip" href={live ? playHref(game.id) : '#/arcade/prizes'}>
      <span className="gw-strip__icon"><Icon name="trophy" size={18} /></span>
      <span className="gw-strip__text">
        {live
          ? <><b>Today’s prize game: {game.title}.</b> Top three on today’s Daily board win {DAILY_PRIZES.prizes.map(fmt).join(' / ')} COZMC. <span className="muted">Ends in {h}h {m}m (00:00 UTC).</span></>
          : <><b>New: {fmt(PRIZE_TOTAL)} COZMC up for grabs every day</b>, from {weekday(PRIZE_START_DAY)} at 00:00 UTC. It replaces the weekly 100K giveaway, which ends at the same moment. The first prize game is {game.title}.</>}
      </span>
      <span className="gw-strip__go">{live ? 'Play now →' : 'See how →'}</span>
    </a>
  )
}
