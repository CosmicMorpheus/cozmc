/* ============================================================
   THE DAILY PRIZES: which game is featured, who's winning, who won.
   Everything is a pure function of on-chain data, so the site and the
   payout job (scripts/daily-payout.ts) always agree, and anyone can check:
     1. Each UTC day has one featured game, rotating through DAILY_PRIZES.rotation.
     2. That day's standings = the Daily Challenge board for the featured game:
        each wallet's best paid run posted that day (same filters as the
        leaderboard), ties going to whoever posted first. Team wallets,
        disqualified wallets and voided runs don't count.
     3. The top three win DAILY_PRIZES.prizes. A day closes at 00:00 UTC, is
        announced and reviewed for a day, and is paid at 00:05 UTC the day after.
   ============================================================ */
import { CREATOR, DAILY_PRIZES, KNOWN_ACCOUNTS, GIVEAWAY } from '../config'
import { gameById } from '../arcade/games'
import type { ArcadeGame } from '../arcade/types'
import { gameBoard, type ScoreRow } from './boards'
import { DAY_MS, utcDay } from './daily'
import type { ScoreTx } from './chain'

/** The first prize day, as a UTC day number. */
export const PRIZE_START_DAY = Math.floor(Date.parse(`${DAILY_PRIZES.start}T00:00:00Z`) / DAY_MS)
/** Has the daily competition started (and the weekly giveaway ended)? */
export const dailyLive = (t = Date.now()) => utcDay(t) >= PRIZE_START_DAY
export const PRIZE_TOTAL = DAILY_PRIZES.prizes.reduce((a, b) => a + b, 0)

/** The featured game on a UTC day. */
export function featuredGame(day = utcDay()): ArcadeGame {
  const r = DAILY_PRIZES.rotation, i = ((day - PRIZE_START_DAY) % r.length + r.length) % r.length
  return gameById(r[i])!
}

/** Can this wallet win? Not the prize wallet, the creator, labelled contracts or disqualified wallets. */
export const canWin = (address: string) =>
  address !== DAILY_PRIZES.payer && address !== CREATOR && address !== GIVEAWAY.payer &&
  !KNOWN_ACCOUNTS[address]?.exclude && !DAILY_PRIZES.ineligible[address]

export interface Standing extends ScoreRow { rank: number; prize: number }

/** A day's standings on its featured game: every eligible wallet, best first; the top three carry their prize. */
export function standings(day: number, scores: ScoreTx[]): Standing[] {
  const game = featuredGame(day)
  const counted = scores.filter(s => !s.legacy && !DAILY_PRIZES.voidScores[s.txid] && canWin(s.player))
  return gameBoard(game, counted, day).map((r, i) => ({ ...r, rank: i + 1, prize: DAILY_PRIZES.prizes[i] ?? 0 }))
}

/** A day's winners: the top of its standings that get a prize. */
export const winners = (day: number, scores: ScoreTx[]) => standings(day, scores).filter(s => s.prize > 0)

export type DayState = 'upcoming' | 'live' | 'review' | 'payout'
/** Where a day is: still to come, being played, closed and in review, or due to be paid. */
export function dayState(day: number, today = utcDay()): DayState {
  return day > today ? 'upcoming' : day === today ? 'live' : day === today - 1 ? 'review' : 'payout'
}
/** When a day's prizes are paid: 00:05 UTC, two days after the day starts. */
export const payoutAt = (day: number) => (day + 2) * DAY_MS + 5 * 60_000
/** When a day ends (its scores stop counting). */
export const dayEnd = (day: number) => (day + 1) * DAY_MS

/** The note a payout carries. */
export const payoutNote = (day: number, rank: number, game: string) => ({ d: day, r: rank, g: game })

export interface DailyPayout { txid: string; to: string; day: number; rank: number; game: string; amount: number; round: number; time: number }
