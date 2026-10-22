import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useChain } from '../lib/data'
import { buildOptInTxn, buildPrizeTxn, buildTicketTxn, fetchCozmcBalance, fetchDrawBlock, signAndSend } from '../lib/chain'
import { countdownTo, entrants, eligible, extraFor, prizeFor, weekEnd, weekOf, weekStart, weekTickets, winnerIndex, type Ticket } from '../lib/giveaway'
import { compact, fmt } from '../lib/format'
import { Addr, Loading, useToast } from '../components/ui'
import { Icon } from '../components/Pixel'
import { useMe } from '../components/Wallet'
import { EXPLORER_TX, GIVEAWAY } from '../config'
import type { TabId } from '../App'

const day = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const errText = (e: any) => { const m = String(e?.message ?? e); return /reject|cancel|closed|denied/i.test(m) ? 'Signature cancelled.' : /overspend|below min/i.test(m) ? 'This wallet needs a little ALGO for the network fee.' : m.slice(0, 160) }

/** The draw block for a finished week, cached forever once known (blocks never change). */
function useDraw(n: number) {
  const key = `cozmc-draw-v1-${GIVEAWAY.start}-${n}`
  const [draw, setDraw] = useState<{ round: number; time: number; seed: string } | null | undefined>(() => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? undefined } catch { return undefined } })
  useEffect(() => {
    if (draw) return
    let alive = true
    const look = () => fetchDrawBlock(weekEnd(n)).then(b => { if (!alive) return; setDraw(b); if (b) try { localStorage.setItem(key, JSON.stringify(b)) } catch { /* private mode */ } }, () => alive && setDraw(null))
    look()
    const t = setInterval(look, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [n, draw, key])
  return draw
}

export function Giveaway({ go }: { go: (t: TabId, sub?: string) => void }) {
  const { scores, tickets, pets, prizes, reload } = useChain()
  const { activeAddress, algodClient, signTransactions } = useWallet()
  const { openConnect } = useMe()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 30_000); return () => clearInterval(t) }, [])

  if (!scores.data || !tickets.data || !pets.data) return <><Head /><Loading what="this week’s tickets" /></>

  const week = Math.max(1, weekOf())
  const all = weekTickets(week, scores.data, tickets.data, pets.data)
  const people = entrants(all)
  const mine = activeAddress ? all.filter(t => t.address === activeAddress) : []
  const claimed = mine.some(t => t.kind === 'free') || (!!activeAddress && tickets.data.some(t => t.address === activeAddress && t.week === week))
  const chance = (n: number) => (all.length ? (n / all.length) * 100 : 0)
  const past = Array.from({ length: week - 1 }, (_, i) => week - 1 - i)

  async function claim() {
    if (!activeAddress) return openConnect()
    setBusy(true)
    try {
      const txn = await buildTicketTxn(algodClient, activeAddress, week)
      await signAndSend(algodClient, signTransactions, [txn])
      toast('Free ticket claimed. Good luck!')
      setTimeout(() => reload('giveaway'), 2500)
    } catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }

  return (
    <>
      <Head />
      <section className="gw" aria-labelledby="gw-prize">
        <div className="gw__main">
          <p className="gw__kicker">Week {week} prize</p>
          <p className="gw__prize" id="gw-prize">{compact(prizeFor(week))} <span>COZMC</span></p>
          {extraFor(week) && <p className="gw__extra">plus {extraFor(week)}</p>}
          <p className="gw__draw">Drawn in <b>{countdownTo(weekEnd(week))}</b> <span className="muted">(Monday 00:00 UTC)</span></p>
        </div>
        <dl className="gw__stats">
          <div><dt>Tickets</dt><dd>{fmt(all.length)}</dd></div>
          <div><dt>Players</dt><dd>{fmt(people.length)}</dd></div>
          <div><dt>Your tickets</dt><dd>{activeAddress ? <>{mine.length}{mine.length > 0 && <small> {chance(mine.length).toFixed(chance(mine.length) < 10 ? 1 : 0)}% chance</small>}</> : '—'}</dd></div>
        </dl>
        <div className="gw__actions">
          <button className="btn btn--phos" onClick={() => go('arcade')}><Icon name="play" size={10} /> Play and post a score</button>
          <a className="btn btn--ghost" href="#/cozmling"><Icon name="cozmling" size={12} /> Check in with your Cozmling</a>
          {!activeAddress ? <button className="btn btn--ghost" onClick={openConnect}>Connect to claim a free ticket</button>
            : !eligible(activeAddress) ? <span className="muted small">The giveaway wallet can’t enter.</span>
            : claimed ? <span className="gw__claimed">Free ticket claimed for week {week}</span>
            : <button className="btn btn--gold" disabled={busy} onClick={claim}>{busy ? 'Claiming…' : 'Claim your free ticket'}</button>}
          <p className="gw__fine">Every score you post is one ticket. Check in with your Cozmling on {GIVEAWAY.checkinDays} different days in a week for a bonus ticket. No purchase necessary: every wallet also gets one free ticket each week (network fee only).</p>
        </div>
      </section>

      <section className="split">
        <div className="panel">
          <header className="panel__head"><h2>This week’s entries</h2><span className="muted small">{day(weekStart(week))} to {day(weekEnd(week))}</span></header>
          {people.length ? (
            <ol className="mini-board gw__list">
              {people.slice(0, 25).map((p, i) => (
                <li key={p.address} className={p.address === activeAddress ? 'me' : ''}>
                  <span className="mb__rank">{i + 1}</span>
                  <Addr address={p.address} you={p.address === activeAddress} />
                  <span className="mb__score">{p.tickets} <small>{p.tickets === 1 ? 'ticket' : 'tickets'}</small></span>
                </li>
              ))}
            </ol>
          ) : <div className="empty"><p>No tickets yet this week. Post a score or claim your free ticket and you’re in.</p></div>}
        </div>
        <div className="panel">
          <header className="panel__head"><h2>Past winners</h2></header>
          {past.length ? <ul className="gw__past">{past.map(n => <PastWeek key={n} n={n} all={weekTickets(n, scores.data!, tickets.data!, pets.data!)} />)}</ul>
            : <p className="muted small">The first winner is drawn on {day(weekEnd(week))}.</p>}
        </div>
      </section>

      <details className="gw__rules">
        <summary>How it works and the rules<span className="pm" aria-hidden="true" /></summary>
        <ul>
          <li><b>Tickets.</b> Each score you post in the arcade during the week is one ticket (posting costs 0.1 ALGO, which buys and burns COZMC). Every wallet can also claim one free ticket per week by signing a 0-ALGO note; you only pay the 0.001 ALGO network fee.</li>
          <li><b>Cozmling bonus.</b> If your wallet’s Cozmling checks in on {GIVEAWAY.checkinDays} different days (UTC) in a week, you get one bonus ticket for that week. Each check-in is a 0-ALGO note from your wallet to itself; days count by the time of the block it lands in.</li>
          <li><b>Weeks</b> run Monday 00:00 UTC to the next Monday 00:00 UTC. Tickets reset each week.</li>
          <li><b>The draw</b> uses the first Algorand block stamped at or after the deadline. Tickets are numbered in block order, and the winning number is SHA-256 of that block’s seed plus “cozmc-giveaway-week-N”, taken modulo the ticket count. Nobody can pick or predict it, and anyone can check it.</li>
          <li><b>The prize</b> is sent by the COZMC team from {GIVEAWAY.payer.slice(0, 5)}…{GIVEAWAY.payer.slice(-4)} and shows here as paid. Winners need COZMC opted in to receive it. The prize can change from week to week.</li>
          <li>The team’s giveaway wallet and pool or contract accounts can’t win. Void where prohibited; it’s on you to check that entering is allowed where you live.</li>
        </ul>
      </details>
    </>
  )
}

function PastWeek({ n, all }: { n: number; all: Ticket[] }) {
  const { prizes, reload } = useChain()
  const { activeAddress, algodClient, signTransactions } = useWallet()
  const toast = useToast()
  const draw = useDraw(n)
  const [win, setWin] = useState<Ticket | null>(null)
  const [optedIn, setOptedIn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!draw || !all.length) return
    winnerIndex(n, draw.seed, all.length).then(i => setWin(all[i]))
  }, [n, draw, all.length])   // eslint-disable-line react-hooks/exhaustive-deps
  const paid = win ? prizes.data?.find(p => p.week === n && p.to === win.address) : undefined
  useEffect(() => { if (win && !paid) fetchCozmcBalance(win.address).then(b => setOptedIn(b != null), () => {}) }, [win, paid])

  const send = async (build: () => Promise<any>, ok: string) => {
    setBusy(true)
    try { await signAndSend(algodClient, signTransactions, [await build()]); toast(ok); setTimeout(() => reload('giveaway'), 2500); if (win) fetchCozmcBalance(win.address).then(b => setOptedIn(b != null)) }
    catch (e) { toast(errText(e)) } finally { setBusy(false) }
  }

  return (
    <li>
      <div className="gw__week"><b>Week {n}</b><span className="muted small">{day(weekStart(n))} to {day(weekEnd(n))}</span><span className="gw__amt">{compact(prizeFor(n))} COZMC</span></div>
      {!all.length ? <p className="muted small">No tickets that week.</p>
        : draw === null || draw === undefined ? <p className="muted small"><span className="blink">▮</span> Drawing… waiting for the first block after the deadline.</p>
        : !win ? <p className="muted small">Picking the winner…</p>
        : (
          <>
            <p className="gw__winner"><Icon name="trophy" size={12} /> <Addr address={win.address} you={win.address === activeAddress} /> <span className="muted small">with ticket #{win.no} of {all.length}</span></p>
            {paid ? <p className="gw__paid">Paid <a href={EXPLORER_TX(paid.txid)} target="_blank" rel="noopener">{fmt(paid.amount)} COZMC ↗</a></p>
              : activeAddress === GIVEAWAY.payer ? (
                optedIn === false ? <p className="small muted">Winner hasn’t opted in to COZMC yet, so the prize can’t be sent.</p>
                  : <button className="btn btn--sm btn--gold" disabled={busy || optedIn !== true} onClick={() => send(() => buildPrizeTxn(algodClient, GIVEAWAY.payer, win.address, n, prizeFor(n)), 'Prize sent')}>Send {compact(prizeFor(n))} COZMC</button>
              )
              : activeAddress === win.address && optedIn === false ? <button className="btn btn--sm btn--gold" disabled={busy} onClick={() => send(() => buildOptInTxn(algodClient, win.address), 'Opted in. Your prize is on its way.')}>Opt in to receive your prize</button>
              : <p className="small muted">Prize on its way.</p>}
            <details className="gw__proof">
              <summary>Verify the draw</summary>
              <p>Draw block <a href={`https://allo.info/block/${draw.round}`} target="_blank" rel="noopener">#{fmt(draw.round)} ↗</a>, stamped {new Date(draw.time * 1000).toISOString().replace('T', ' ').slice(0, 19)} UTC</p>
              <p>Seed <code>{draw.seed}</code></p>
              <p>SHA-256(seed ‖ “cozmc-giveaway-week-{n}”) mod {all.length} = ticket #{win.no}, <a href={EXPLORER_TX(win.txid)} target="_blank" rel="noopener">{win.kind === 'free' ? 'a free ticket' : win.kind === 'checkin' ? 'a Cozmling check-in bonus' : 'a posted score'} ↗</a></p>
            </details>
          </>
        )}
    </li>
  )
}

function Head() {
  return (
    <header className="page-head">
      <h1>Weekly giveaway</h1>
      <p>Every score you post is a ticket, every wallet gets a free one, and Cozmling check-ins earn a bonus. One winner every Monday, drawn in the open on Algorand.</p>
    </header>
  )
}
