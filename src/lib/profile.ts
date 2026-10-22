/* ============================================================
   THE PLAYER PROFILE — kept in this browser (localStorage).
   Bests, daily results, streak, achievements, counters, chosen skins.
   Wallet-backed facts (tier, burns, posted scores) come from the chain
   and are merged in by the Card tab.
   ============================================================ */
import { useSyncExternalStore } from 'react'
import { utcDay } from './daily'

export interface Profile {
  best: Record<string, number>
  daily: Record<string, { day: number; score: number }>
  streak: { last: number; count: number; best: number }
  achievements: Record<string, number>
  counters: Record<string, number>
  skins: Record<string, string>
}

const KEY = 'cozmc-profile-v1'
const empty = (): Profile => ({ best: {}, daily: {}, streak: { last: -1, count: 0, best: 0 }, achievements: {}, counters: {}, skins: {} })

function load(): Profile {
  try {
    const p = { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }
    // carry over bests saved by the first arcade build
    for (const id of ['moon-bounce', 'brick-by-brick']) {
      const old = Number(localStorage.getItem(`cozmc-best-${id}`)) || 0
      if (old > (p.best[id] ?? 0)) p.best[id] = old
    }
    return p
  } catch { return empty() }
}

let state = load()
const subs = new Set<() => void>()
const unlockSubs = new Set<(id: string) => void>()
function commit(next: Profile) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* private mode: keep it in memory */ }
  subs.forEach(f => f())
}

export const getProfile = () => state
export function useProfile() {
  return useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, () => state, () => state)
}
export const onUnlock = (f: (id: string) => void) => { unlockSubs.add(f); return () => { unlockSubs.delete(f) } }

/** Award an achievement once. Returns true the first time. */
export function unlock(id: string) {
  if (state.achievements[id]) return false
  commit({ ...state, achievements: { ...state.achievements, [id]: Date.now() } })
  unlockSubs.forEach(f => f(id))
  return true
}

export function bump(counter: string, n = 1) {
  const v = (state.counters[counter] ?? 0) + n
  commit({ ...state, counters: { ...state.counters, [counter]: v } })
  return v
}

export function setSkin(game: string, skin: string) {
  commit({ ...state, skins: { ...state.skins, [game]: skin } })
}

/** Record a finished run. `day` is set for a Daily Challenge run (the day it started); those extend the streak. */
export function recordRun(game: string, score: number, day: number | null) {
  const next: Profile = { ...state, best: { ...state.best }, daily: { ...state.daily }, streak: { ...state.streak } }
  const newBest = score > (next.best[game] ?? 0)
  if (newBest) next.best[game] = score
  let newDailyBest = false
  if (day != null) {
    const d = next.daily[game]
    if (!d || d.day !== day || score > d.score) { next.daily[game] = { day, score }; newDailyBest = true }
    if (next.streak.last !== day) {
      next.streak.count = next.streak.last === day - 1 ? next.streak.count + 1 : 1
      next.streak.last = day
      next.streak.best = Math.max(next.streak.best, next.streak.count)
    }
  }
  commit(next)
  return { newBest, newDailyBest, streak: next.streak.count }
}

/** The streak only counts if it reaches today or yesterday. */
export const liveStreak = (p = state) => (p.streak.last >= utcDay() - 1 ? p.streak.count : 0)
export const todaysDaily = (game: string, p = state) => (p.daily[game]?.day === utcDay() ? p.daily[game].score : null)

/* ---------------- achievements ---------------- */
export type AchKind = 'arcade' | 'chain' | 'daily' | 'fire' | 'holder' | 'wisdom'
/** `secret` badges show as ??? until earned. */
export interface Ach { id: string; name: string; desc: string; kind: AchKind; secret?: boolean }

export const ACHIEVEMENTS: Ach[] = [
  { id: 'first-stomp', name: 'First Stomp', desc: 'Stomp an alien in Moon Bounce', kind: 'arcade' },
  { id: 'chain-5', name: 'Nice Chain', desc: 'Chain 5 stomps without landing', kind: 'chain' },
  { id: 'chain-10', name: 'Cosmic', desc: 'Chain 10 stomps without landing', kind: 'chain' },
  { id: 'chain-15', name: 'Legendary', desc: 'Chain 15 stomps without landing', kind: 'chain' },
  { id: 'wave-5', name: 'Wave Rider', desc: 'Reach wave 5 in Moon Bounce', kind: 'arcade' },
  { id: 'first-line', name: 'First Brick', desc: 'Clear a line in Brick by Brick', kind: 'arcade' },
  { id: 'quad', name: 'Brick by Brick', desc: 'Clear four lines at once', kind: 'chain' },
  { id: 'combo-4', name: 'Chain Builder', desc: 'Clear lines on four pieces in a row', kind: 'chain' },
  { id: 'level-5', name: 'Level 5', desc: 'Reach level 5 in Brick by Brick', kind: 'arcade' },
  { id: 'lines-100', name: 'Mason', desc: 'Clear 100 lines in total', kind: 'arcade' },
  { id: 'first-flight', name: 'First Flight', desc: 'Fire the cannon in Moonshot', kind: 'arcade' },
  { id: 'km-club', name: '1 km Club', desc: 'Fly 1,000 m in Moonshot', kind: 'arcade' },
  { id: 'slingshot', name: 'Slingshot', desc: 'Skim a black hole and get flung', kind: 'chain' },
  { id: 'chain-reaction', name: 'Chain Reaction', desc: 'Hit 3 fuel cans in one flight', kind: 'chain' },
  { id: 'daily-1', name: 'Daily Debut', desc: 'Finish a Daily Challenge', kind: 'daily' },
  { id: 'streak-3', name: 'On a Roll', desc: 'Play the daily 3 days in a row', kind: 'daily' },
  { id: 'streak-7', name: 'Devoted', desc: 'Play the daily 7 days in a row', kind: 'daily' },
  { id: 'posted', name: 'On the Board', desc: 'Post a score on-chain', kind: 'arcade' },
  { id: 'burner', name: 'Fire Starter', desc: 'Burn COZMC in the Bonfire', kind: 'fire' },
  { id: 'holder', name: 'Holder', desc: 'Hold COZMC in your wallet', kind: 'holder' },
  { id: 'planet', name: 'Planetary', desc: 'Reach Planet tier (1M COZMC)', kind: 'holder' },
  { id: 'blackhole', name: 'Event Horizon', desc: 'Reach Black Hole tier (50M COZMC)', kind: 'holder' },
  { id: 'seeker', name: 'Seeker', desc: 'Read 10 lines of Daily Wisdom', kind: 'wisdom' },
  { id: 'show-off', name: 'Show-Off', desc: 'Share your player card', kind: 'wisdom' },
  { id: 'konami', name: 'Old School', desc: 'You entered the code. Respect.', kind: 'arcade', secret: true },
]
export const achById = (id: string) => ACHIEVEMENTS.find(a => a.id === id)

/** Gameplay events from a cabinet (see GameHooks.onEvent) → achievements. */
export function gameEvent(type: string, v: number) {
  if (type === 'stomp') { unlock('first-stomp'); if (v >= 5) unlock('chain-5'); if (v >= 10) unlock('chain-10'); if (v >= 15) unlock('chain-15') }
  if (type === 'wave' && v >= 5) unlock('wave-5')
  if (type === 'clear') { unlock('first-line'); if (v === 4) unlock('quad'); if (bump('lines', v) >= 100) unlock('lines-100') }
  if (type === 'combo' && v >= 4) unlock('combo-4')
  if (type === 'level' && v >= 5) unlock('level-5')
  if (type === 'launch') unlock('first-flight')
  if (type === 'distance' && v >= 1000) unlock('km-club')
  if (type === 'slingshot') unlock('slingshot')
  if (type === 'boom' && v >= 3) unlock('chain-reaction')
}

/** After a run is recorded: daily badges. */
export function runBadges(daily: boolean, streak: number) {
  if (!daily) return
  unlock('daily-1')
  if (streak >= 3) unlock('streak-3')
  if (streak >= 7) unlock('streak-7')
}

/** Facts read from the chain for the connected wallet. */
export function walletBadges(o: { balance: number | null; burned: boolean; posted: boolean }) {
  if (o.balance && o.balance > 0) unlock('holder')
  if ((o.balance ?? 0) >= 1_000_000) unlock('planet')
  if ((o.balance ?? 0) >= 50_000_000) unlock('blackhole')
  if (o.burned) unlock('burner')
  if (o.posted) unlock('posted')
}

/** Daily Wisdom: count distinct lines read; ten earns Seeker. */
export function sawQuote(pos: number) {
  const k = `q${pos}`
  if (state.counters[k]) return
  commit({ ...state, counters: { ...state.counters, [k]: 1, quotesSeen: (state.counters.quotesSeen ?? 0) + 1 } })
  if ((state.counters.quotesSeen ?? 0) >= 10) unlock('seeker')
}
