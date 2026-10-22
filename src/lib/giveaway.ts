/* ============================================================
   THE WEEKLY GIVEAWAY: tickets, weeks and the draw.
   Everything here is a pure function of on-chain data, so anyone
   can recompute the same winner:
     1. Tickets for week N = every valid score posted that week, plus
        each wallet's first free-ticket note for week N, in block
        order (round, then transaction id). Ticket #1 is the earliest.
     2. Draw block = the first Algorand block stamped at or after the
        week's deadline (next Monday 00:00 UTC).
     3. Winning ticket = SHA-256( draw block seed bytes ‖ "cozmc-giveaway-week-N" ),
        first 8 bytes as an unsigned integer, modulo the ticket count.
   ============================================================ */
import { GIVEAWAY, KNOWN_ACCOUNTS } from '../config'
import { GAMES } from '../arcade/games'
import { plausible } from '../arcade/types'
import { DAY_MS } from './daily'
import type { FreeTicket, ScoreTx } from './chain'

export const WEEK_MS = 7 * DAY_MS
const START = Date.parse(`${GIVEAWAY.start}T00:00:00Z`)

export const weekOf = (t = Date.now()) => Math.floor((t - START) / WEEK_MS) + 1
export const weekStart = (n: number) => START + (n - 1) * WEEK_MS
export const weekEnd = (n: number) => weekStart(n) + WEEK_MS
export const prizeFor = (n: number) => GIVEAWAY.prizes[n] ?? GIVEAWAY.prize
export const extraFor = (n: number) => GIVEAWAY.extras[n] ?? ''
const inWeek = (timeSec: number, n: number) => timeSec * 1000 >= weekStart(n) && timeSec * 1000 < weekEnd(n)

export interface Ticket { no: number; address: string; kind: 'score' | 'free'; round: number; txid: string; game?: string; score?: number }

/** Can this wallet win? The giveaway wallet and labelled contracts can't. */
export const eligible = (address: string) => address !== GIVEAWAY.payer && !KNOWN_ACCOUNTS[address]?.exclude

export function weekTickets(n: number, scores: ScoreTx[], free: FreeTicket[]): Ticket[] {
  const fromScores = scores.filter(s => {
    if (s.legacy || !inWeek(s.time, n)) return false
    const g = GAMES.find(x => x.id === s.game)
    return !!g && plausible(g, s.score, s.ms)                 // same rule as the leaderboard
  }).map(s => ({ address: s.player, kind: 'score' as const, round: s.round, txid: s.txid, game: s.game, score: s.score }))
  const seen = new Set<string>()
  const fromFree = free
    .filter(f => f.week === n && inWeek(f.time, n))
    .sort((a, b) => a.round - b.round || (a.txid < b.txid ? -1 : 1))
    .filter(f => (seen.has(f.address) ? false : (seen.add(f.address), true)))   // one free ticket per wallet
    .map(f => ({ address: f.address, kind: 'free' as const, round: f.round, txid: f.txid }))
  return [...fromScores, ...fromFree]
    .filter(t => eligible(t.address))
    .sort((a, b) => a.round - b.round || (a.txid < b.txid ? -1 : a.txid > b.txid ? 1 : 0))
    .map((t, i) => ({ ...t, no: i + 1 }))
}

/** Ticket counts per wallet, most first. */
export function entrants(tickets: Ticket[]) {
  const by = new Map<string, { address: string; tickets: number; free: boolean }>()
  for (const t of tickets) {
    const e = by.get(t.address) ?? { address: t.address, tickets: 0, free: false }
    e.tickets++; if (t.kind === 'free') e.free = true
    by.set(t.address, e)
  }
  return [...by.values()].sort((a, b) => b.tickets - a.tickets)
}

/** The winning ticket index (0-based) for week n, from the draw block's seed. */
export async function winnerIndex(n: number, seedB64: string, count: number) {
  const seed = Uint8Array.from(atob(seedB64), c => c.charCodeAt(0))
  const tag = new TextEncoder().encode(`cozmc-giveaway-week-${n}`)
  const buf = new Uint8Array(seed.length + tag.length); buf.set(seed); buf.set(tag, seed.length)
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', buf))
  let x = 0n
  for (let i = 0; i < 8; i++) x = (x << 8n) | BigInt(h[i])
  return Number(x % BigInt(count))
}

export const countdownTo = (ms: number) => {
  const s = Math.max(0, Math.floor((ms - Date.now()) / 1000)), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`
}
