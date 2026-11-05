/* ============================================================
   ADRIFT: the daily word rescue (rules engine).
   One shared word per UTC day; 90 seconds and six missed letters to
   find it. A session is saved in this browser and tied to the day it
   started, so a mission that crosses midnight finishes on its word.
   No wallet, rewards or on-chain scores: it's just for fun. The daily
   limit lives in browser storage, so clearing it or switching browsers
   gets around it; don't attach rewards without a server-side check.
   ============================================================ */
import { rng } from '../lib/daily'

export const CONFIG = { seconds: 90, misses: 6 }
export const DAY = 86_400_000
export const dayAt = (now = Date.now()) => Math.floor(now / DAY)

export const WORDS = [...new Set(
  'APPLE BEACH BREAD BRAVE BRIDGE BRIGHT CANDLE CHAIR CHERRY CLOUD COFFEE COOKIE DANCE DREAM EARTH FAMILY FIELD FLOWER FOREST FRIEND FROZEN GARDEN GENTLE GRAPE GREEN HAPPY HEART HONEY HOUSE ISLAND JACKET JUICE KITTEN LEMON LIGHT LITTLE MAGIC MARKET MEADOW MELON MONKEY MORNING MOTHER ORANGE OCEAN PANDA PAPER PEACH PENCIL PEOPLE PICNIC PILLOW PIZZA PLANET POCKET PURPLE RABBIT RAINBOW RIVER ROCKET SCHOOL SHADOW SHELL SILVER SMILE SNOW SPARK SPRING STAR STONE STREET SUMMER SUNNY SWEET TABLE TIGER TOAST TRAVEL TURTLE VALLEY VIOLET WATER WINDOW WINTER WONDER YELLOW'
    .split(' ').filter(w => w.length >= 4 && w.length <= 7),
)]

/* The word rotation: the list is shuffled into a fresh order every cycle (one cycle =
   one day per word), so no word comes back until every word has been used, and a cycle
   never starts with the word the previous one ended on, so two days in a row always differ.
   Counted from EPOCH, the first public day. Don't change WORDS or EPOCH once players
   have seen it: that would change the word of days already played. */
const EPOCH = Math.floor(Date.UTC(2026, 10, 9) / DAY)
const orders = new Map<number, string[]>()
function shuffled(cycle: number): string[] {
  const r = rng((0xad1f7 ^ Math.imul(cycle, 0x9e3779b1)) >>> 0), a = [...WORDS]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}
function order(cycle: number): string[] {
  let o = orders.get(cycle)
  if (!o) {
    o = shuffled(cycle)
    if (o[0] === shuffled(cycle - 1).at(-1)) [o[0], o[1]] = [o[1], o[0]]      // only swaps the first two, so the last word is unchanged
    orders.set(cycle, o)
  }
  return o
}
export function wordFor(day: number): string {
  const n = WORDS.length, i = day - EPOCH, cycle = Math.floor(i / n)
  return order(cycle)[i - cycle * n]
}

export type Status = 'playing' | 'won' | 'lost'
export interface Session { version: 1; day: number; started: number; deadline: number; guesses: string[]; status: Status; ended: number | null }

export const createSession = (now: number): Session =>
  ({ version: 1, day: dayAt(now), started: now, deadline: now + CONFIG.seconds * 1000, guesses: [], status: 'playing', ended: null })

/** Is this a well-formed saved session (and not tampered into a longer deadline or repeated guesses)? */
export function valid(s: any): s is Session {
  return !!s && s.version === 1 && Number.isInteger(s.day) && Number.isFinite(s.started) && dayAt(s.started) === s.day &&
    s.deadline === s.started + CONFIG.seconds * 1000 && Array.isArray(s.guesses) && s.guesses.every((x: unknown) => typeof x === 'string' && /^[A-Z]$/.test(x)) &&
    new Set(s.guesses).size === s.guesses.length && ['playing', 'won', 'lost'].includes(s.status)
}

/** Move a session on to `now`, optionally guessing a letter. Finished sessions never change. */
export function advance(s0: Session, now: number, letter?: string): Session {
  const s: Session = structuredClone(s0)
  if (s.status !== 'playing') return s
  const word = wordFor(s.day)
  if (now >= s.deadline) { s.status = 'lost'; s.ended = s.deadline; return s }
  if (letter && /^[A-Z]$/.test(letter) && !s.guesses.includes(letter)) s.guesses.push(letter)
  if ([...word].every(c => s.guesses.includes(c))) s.status = 'won'
  else if (s.guesses.filter(c => !word.includes(c)).length >= CONFIG.misses) s.status = 'lost'
  if (s.status !== 'playing') s.ended = now
  return s
}

export const missesOf = (s: Session | null, word: string) => (s?.guesses ?? []).filter(c => !word.includes(c)).length
