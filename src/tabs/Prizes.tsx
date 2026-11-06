import { useEffect, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { useChain } from '../lib/data'
import { buildOptInTxn, fetchCozmcBalance, signAndSend } from '../lib/chain'
import { fmt } from '../lib/format'
import { friendlyError } from '../lib/errors'
import { DAY_MS, utcDay } from '../lib/daily'
import { dailyLive, dayEnd, featuredGame, payoutAt, PRIZE_START_DAY, PRIZE_TOTAL, standings, winners, type DailyPayout, type Standing } from '../lib/dailyPrize'
import { Addr, Failed, Loading, useToast } from '../components/ui'
import { Icon } from '../components/Pixel'
import { GameThumb } from '../components/GameThumb'
import { gameById } from '../arcade/games'
import { Clock, Ladder, PLACES, playHref, useTick, weekday } from '../components/DailyPrize'
import { useMe } from '../components/Wallet'
import { DAILY_PRIZES, EXPLORER_TX, GIVEAWAY } from '../config'

const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`
const at = (ms: number) => `${weekday(Math.floor(ms / DAY_MS), 'short')} ${new Date(ms).toISOString().slice(11, 16)} UTC`

export function Prizes() {
  useTick(1000)
  const { scores, payouts, reload } = useChain()
  const { activeAddress } = useWallet()
  const { openConnect } = useMe()
  const live = dailyLive(), today = utcDay(), day = live ? today : PRIZE_START_DAY
  const game = featuredGame(day)

  if (!scores.data) return <><Head />{scores.error ? <Failed what="today’s board" retry={() => reload('scores')} /> : <Loading what="today’s board" />}</>
  const board = live ? standings(today, scores.data) : []
  const mine = activeAddress ? board.find(s => s.player === activeAddress) : undefined
  const past = Array.from({ length: Math.max(0, Math.min(14, today - PRIZE_START_DAY)) }, (_, i) => today - 1 - i)
  const upcoming = Array.from({ length: 7 }, (_, i) => day + i)

  return (
    <>
      <Head />
      <section className="gw dp-hero" aria-labelledby="dp-prize">
        <div className="gw__main">
          <p className="gw__kicker">{live ? <>Today · {weekday(today)}</> : <>Starts {weekday(PRIZE_START_DAY)} · 00:00 UTC</>}</p>
          <p className="gw__prize" id="dp-prize">{fmt(PRIZE_TOTAL)} <span>COZMC</span></p>
          <p className="dpb__sub">up for grabs every day</p>
          <Ladder />
          <Clock to={live ? dayEnd(today) : PRIZE_START_DAY * DAY_MS} label={live ? 'Today’s competition ends in' : 'The daily prizes start in'} />
          <p className="gw__draw">{live ? <>Board closes at <b>00:00 UTC</b>. {mine ? <>You’re <b>#{mine.rank}</b> with {fmt(mine.score)}.</> : activeAddress ? 'Post a run to get on the board.' : ''}</> : <>It replaces the weekly 100K giveaway, whose <a href="#/arcade/giveaway">final draw</a> is at the same moment.</>}</p>
        </div>
        <a className="dpb__game" href={playHref(game.id)} aria-label={`Play ${game.title}`}>
          <GameThumb game={game} />
          <span className="dpb__tag">{live ? 'Today’s prize game' : 'First prize game'}</span>
          <span className="dpb__title">{game.title}</span>
        </a>
        <div className="gw__actions">
          <a className="btn btn--gold dpb__play" href={playHref(game.id)}><Icon name="play" size={11} /> Play {game.title} now</a>
          {!activeAddress && <button className="btn btn--ghost" onClick={openConnect}>Connect a wallet to compete</button>}
          <p className="gw__fine">Play today’s <b>Daily Challenge</b> on the prize game, then post your score. Your best run of the day counts. Practice in free play as much as you like.</p>
        </div>
      </section>

      <ol className="dp-steps" aria-label="How it works">
        <li><b>1. Play</b><span>Today’s prize game in Daily mode. It’s the same run for everyone, so it’s pure skill.</span></li>
        <li><b>2. Post</b><span>Connect a wallet and post your score (0.1 ALGO, which buys and burns COZMC). Post as often as you like; your best counts.</span></li>
        <li><b>3. Win</b><span>At 00:00 UTC the board closes. The top three win {DAILY_PRIZES.prizes.map(fmt).join(' / ')} COZMC.</span></li>
        <li><b>4. Get paid</b><span>After a one-day review, prizes go to winners’ wallets automatically at 00:05 UTC.</span></li>
      </ol>

      <section className="split">
        <div className="panel">
          <header className="panel__head"><h2>{live ? 'Today’s leaderboard' : 'Leaderboard'}</h2><span className="muted small">{game.title} · Daily</span></header>
          {!live ? <div className="empty"><p>The first board opens {weekday(PRIZE_START_DAY)} at 00:00 UTC with {game.title}.</p></div>
            : board.length ? <Board rows={board.slice(0, 20)} me={activeAddress} />
            : <div className="empty"><p>No scores yet today. The first run on the board takes 1st place.</p><a className="btn btn--gold btn--sm" href={playHref(game.id)}>Play now</a></div>}
        </div>
        <div className="panel">
          <header className="panel__head"><h2>Coming up</h2><span className="muted small">a new game every day</span></header>
          <ul className="dp-sched">
            {upcoming.map(d => (
              <li key={d} className={d === today ? 'is-today' : ''}>
                <span>{d === today ? 'Today' : d === today + 1 ? 'Tomorrow' : weekday(d, 'short')}</span>
                <b>{featuredGame(d).title}</b>
                <span className="dp-win">{fmt(PRIZE_TOTAL)}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel dp-past" aria-labelledby="dp-past-h">
        <header className="panel__head"><h2 id="dp-past-h">Previous winners</h2>{payouts.error && <span className="muted small">Payouts couldn’t be loaded</span>}</header>
        {past.length ? <ul className="gw__past">{past.map(d => <PastDay key={d} day={d} rows={winners(d, scores.data!)} paid={payouts.data ?? []} me={activeAddress} today={today} />)}</ul>
          : <p className="muted small">The first winners are announced {weekday(PRIZE_START_DAY + 1)} at 00:00 UTC.</p>}
      </section>

      <Rules />
    </>
  )
}

function Board({ rows, me }: { rows: Standing[]; me?: string | null }) {
  return (
    <ol className="mini-board dp-board">
      {rows.map(s => (
        <li key={s.player} className={`${s.player === me ? 'me' : ''}${s.prize ? ' is-prize' : ''}`}>
          <span className="mb__rank">{s.rank}</span>
          <Addr address={s.player} you={s.player === me} />
          <span className="mb__score">{fmt(s.score)}{s.prize > 0 && <small className="dp-win"> {fmt(s.prize)} COZMC</small>}</span>
        </li>
      ))}
    </ol>
  )
}

/** One closed day: its winners, and for each whether the prize is in review, due, waiting on an opt-in, or paid. */
function PastDay({ day, rows, paid, me, today }: { day: number; rows: Standing[]; paid: DailyPayout[]; me?: string | null; today: number }) {
  const review = day === today - 1
  return (
    <li>
      <div className="gw__week"><b>{weekday(day)}</b><span className="muted small">{featuredGame(day).title}</span>
        <span className="gw__amt">{review ? `In review · paid ${at(payoutAt(day))}` : ''}</span></div>
      {!rows.length ? <p className="muted small">Nobody posted a run that day.</p> : (
        <ol className="dp-winners">
          {rows.map(w => {
            const p = paid.find(x => x.day === day && x.rank === w.rank)
            return (
              <li key={w.rank}>
                <span className="dp-place">{PLACES[w.rank - 1]}</span>
                <Addr address={p?.to ?? w.player} you={(p?.to ?? w.player) === me} />
                <span className="muted small">{fmt(w.score)}</span>
                <span className="dp-status">{p ? <a className="gw__paid" href={EXPLORER_TX(p.txid)} target="_blank" rel="noopener">Paid {fmt(p.amount)} ↗</a>
                  : review ? <span className="muted small">{fmt(w.prize)} COZMC</span>
                  : today - day - 1 > DAILY_PRIZES.claimDays ? <span className="muted small">Unclaimed</span>
                  : <Pending winner={w.player} amount={w.prize} me={me} />}</span>
              </li>
            )
          })}
        </ol>
      )}
    </li>
  )
}

/** A prize that's due but not paid yet: usually the winner hasn't opted in to COZMC; let them fix that here. */
function Pending({ winner, amount, me }: { winner: string; amount: number; me?: string | null }) {
  const { algodClient, signTransactions } = useWallet()
  const { reload } = useChain()
  const toast = useToast()
  const [optedIn, setOptedIn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { fetchCozmcBalance(winner).then(b => setOptedIn(b != null), () => {}) }, [winner])
  if (optedIn === false && me === winner) return (
    <button className="btn btn--sm btn--gold" disabled={busy} onClick={async () => {
      setBusy(true)
      try { await signAndSend(algodClient, signTransactions, [await buildOptInTxn(algodClient, winner)]); setOptedIn(true); toast('Opted in. Your prize goes out at the next daily payout (00:05 UTC).'); setTimeout(() => reload('giveaway'), 2500) }
      catch (e) { toast(friendlyError(e, { cancelled: 'Signature cancelled.', lowAlgo: 'This wallet needs a little ALGO (about 0.1) to opt in.' })) }
      finally { setBusy(false) }
    }}>Opt in to get {fmt(amount)} COZMC</button>
  )
  return <span className="muted small">{optedIn === false ? 'Waiting for the winner to opt in to COZMC' : `${fmt(amount)} COZMC · paying at the next 00:05 UTC run`}</span>
}

function Rules() {
  return (
    <details className="gw__rules" open>
      <summary>Rules, eligibility and payouts<span className="pm" aria-hidden="true" /></summary>
      <ul>
        <li><b>The competition.</b> Each UTC day (00:00 to 00:00 UTC) has one prize game, rotating {DAILY_PRIZES.rotation.map(id => gameById(id)?.title).join(' → ')}. Only that game’s <b>Daily Challenge</b> runs count, and only when posted on-chain that same day (a run that ends right at midnight has 15 minutes to be posted). Free-play runs and other games don’t count.</li>
        <li><b>Prizes.</b> 1st {fmt(DAILY_PRIZES.prizes[0])}, 2nd {fmt(DAILY_PRIZES.prizes[1])} and 3rd {fmt(DAILY_PRIZES.prizes[2])} COZMC, every day. If fewer than three wallets post, only those places are paid.</li>
        <li><b>One entry per wallet.</b> Each wallet’s best run of the day is its entry; posting more runs only helps if you beat your score. Ties go to whoever posted the score first. Using several wallets to take more than one place is against the rules and can be disqualified.</li>
        <li><b>Fair play.</b> Everyone gets the same seeded run each day. Scores that are impossible for the game (too high, or too fast for the time played) are left off automatically. Every day’s final standings are reviewed for a full day before payout; runs or wallets found cheating are disqualified, and the next player moves up. Each post costs 0.1 ALGO (it buys and burns COZMC), which keeps spam off the board.</li>
        <li><b>Who can win.</b> Anyone with an Algorand wallet, except the prize wallet ({short(DAILY_PRIZES.payer)}), the team’s wallets ({short(GIVEAWAY.payer)}) and pool or contract accounts.</li>
        <li><b>Payouts are automatic.</b> At 00:05 UTC each day, the final standings of the day that just ended are announced, and the winners from the day before are paid from the prize wallet {short(DAILY_PRIZES.payer)}. Each payout is an on-chain transfer you can check from this page. To receive COZMC your wallet must be opted in to it; if it isn’t, the prize waits and is retried daily for {DAILY_PRIZES.claimDays} days.</li>
        <li><b>Changes.</b> Prizes, games and rules can change; changes are announced on this page and in our Discord before they apply. Void where prohibited; it’s on you to check that taking part is allowed where you live.</li>
      </ul>
    </details>
  )
}

function Head() {
  return (
    <header className="page-head">
      <h1>Daily prizes</h1>
      <p>{fmt(PRIZE_TOTAL)} COZMC up for grabs every day. One prize game, one board, the top three win. A new game and a fresh pot every day at 00:00 UTC.</p>
    </header>
  )
}
