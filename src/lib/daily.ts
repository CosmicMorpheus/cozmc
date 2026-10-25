/* The Daily Challenge clock. Days are UTC, so everyone everywhere plays
   the same run and the board resets at the same moment. */
import { DAILY_START } from '../config'

export const DAY_MS = 86_400_000
const START_DAY = Math.floor(Date.parse(`${DAILY_START}T00:00:00Z`) / DAY_MS)

export const utcDay = (t = Date.now()) => Math.floor(t / DAY_MS)
/** Daily #1 is DAILY_START. */
export const dailyNo = (day = utcDay()) => day - START_DAY + 1
export const msToReset = () => DAY_MS - (Date.now() % DAY_MS)
export const countdown = (ms = msToReset()) => {
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000)
  return h ? `${h}h ${m}m` : `${m}m`
}

/** Same seed for the same game on the same day, everywhere. */
export function seedFor(gameId: string, day = utcDay()) {
  let h = 2166136261 ^ day
  for (const c of gameId) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return h >>> 0
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
