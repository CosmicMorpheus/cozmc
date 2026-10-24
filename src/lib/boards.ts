import type { Burn, ScoreTx } from './chain'
import type { ArcadeGame } from '../arcade/types'
import { plausible } from '../arcade/types'

export interface ScoreRow { player: string; score: number; time: number; txid: string; runs: number }

/** One row per wallet: its best believable run for this game. Pass `day` for that day's Daily Challenge board. */
export function gameBoard(game: ArcadeGame, scores: ScoreTx[], day?: number): ScoreRow[] {
  const best = new Map<string, ScoreRow>()
  for (const s of scores) {
    if (s.game !== game.id || !plausible(game, s.score, s.ms)) continue
    if (day != null && s.day !== day) continue
    const cur = best.get(s.player)
    if (!cur) best.set(s.player, { player: s.player, score: s.score, time: s.time, txid: s.txid, runs: 1 })
    else {
      cur.runs++
      if (s.score > cur.score || (s.score === cur.score && s.time < cur.time)) Object.assign(cur, { score: s.score, time: s.time, txid: s.txid })
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || a.time - b.time)
}

export interface BurnerRow { sender: string; total: number; count: number; last: number; lastWish: string; lastTx: string }

export function burnerBoard(burns: Burn[]): BurnerRow[] {
  const by = new Map<string, BurnerRow>()
  for (const b of burns) {           // burns arrive newest-first
    const cur = by.get(b.sender)
    if (!cur) by.set(b.sender, { sender: b.sender, total: b.amount, count: 1, last: b.time, lastWish: b.wish, lastTx: b.txid })
    else { cur.total += b.amount; cur.count++ }
  }
  return [...by.values()].sort((a, b) => b.total - a.total)
}

export const rankLabel = (i: number) => (i === 0 ? '1ST' : i === 1 ? '2ND' : i === 2 ? '3RD' : `${i + 1}TH`)
