/* ============================================================
   COZMLING CARE — local-first. Needs drain in real time while the
   page is closed; it never dies, it only gets hungry, bored or sleepy.
   ============================================================ */
import { DEFAULT_LOOK, type Look, type Stage } from './look'

export type HomeId = 'moonbase' | 'grove'
export const HOMES: Record<HomeId, { name: string; blurb: string }> = {
  moonbase: { name: 'Moon Base', blurb: 'A cosy dome on the Moon with a window on the Earth.' },
  grove: { name: 'Cosmic Grove', blurb: 'A glowing forest clearing under a big moon.' },
}

export type Need = 'food' | 'fun' | 'energy'
export interface Pet {
  v: 1
  name: string
  look: Look
  home: HomeId
  born: number                 // adopted, ms
  hatched: number | null       // the egg hatched, ms
  food: number; fun: number; energy: number   // 0..100, as of `at`
  at: number
  asleep: number | null        // fell asleep at, ms
  fed: number; played: number; pets: number   // lifetime care counts
  owner?: string               // the wallet it belongs to
  txid?: string                // its latest save on Algorand
  round?: number               // …and the round it landed in
  preview?: Stage              // prototype only: show a later stage
}

const KEY = 'cozmc-cozmling-v1'
const H = 3_600_000
/* awake: full → empty in about a day; asleep: hunger and boredom slow down, energy refills in 6 hours */
const AWAKE = { food: 100 / (24 * H), fun: 100 / (20 * H), energy: 100 / (18 * H) }
const ASLEEP = { food: 100 / (48 * H), fun: 100 / (80 * H) }
const REFILL = 100 / (6 * H)

export const clamp = (v: number) => Math.max(0, Math.min(100, v))

/* ---- this browser's copy: one Cozmling per wallet ---- */
function read(key: string): Pet | null {
  try {
    const p = JSON.parse(localStorage.getItem(key) || 'null')
    if (p?.v !== 1) return null
    if (!('body' in p.look)) p.look = { ...DEFAULT_LOOK[p.look?.form === 'girl' ? 'girl' : 'boy'] }   // saved before the alien redesign
    return p
  } catch { return null }
}
export const load = (owner: string) => read(`${KEY}:${owner}`)
export function save(owner: string, p: Pet | null) {
  try { p ? localStorage.setItem(`${KEY}:${owner}`, JSON.stringify(p)) : localStorage.removeItem(`${KEY}:${owner}`) } catch { /* private mode */ }
}
/** The first prototype kept one Cozmling with no wallet; it can be saved to a wallet once. */
export const loadUnclaimed = () => read(KEY)
export const clearUnclaimed = () => { try { localStorage.removeItem(KEY) } catch { /* private mode */ } }

export function adopt(name: string, look: Look, home: HomeId, now = Date.now()): Pet {
  return { v: 1, name, look, home, born: now, hatched: null, food: 80, fun: 80, energy: 90, at: now, asleep: null, fed: 0, played: 0, pets: 0 }
}

export const cleanName = (s: string) => s.replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').slice(0, 14)

/* ---- the copy saved on Algorand ----
   A 0-ALGO payment from the wallet to itself, with the note cozmc:pet:v1:{…}.
   The newest one wins, so changing the look just saves a new note. */
export interface Saved { name: string; look: Look; home: HomeId; born: number }

export const toNote = (p: Pet) => ({
  n: p.name, f: p.look.form === 'girl' ? 'g' : 'b', b: p.look.body, g: p.look.glow, e: p.look.eyes,
  h: p.home === 'grove' ? 'g' : 'm', s: Math.floor(p.born / 1000),
})

export function fromNote(j: any): Saved | null {
  const int = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 64 ? (v as number) : 0)
  if (!j || typeof j.n !== 'string' || (j.f !== 'b' && j.f !== 'g')) return null
  const name = cleanName(j.n).trim()
  if (!name) return null
  return {
    name,
    look: { form: j.f === 'g' ? 'girl' : 'boy', body: int(j.b), glow: int(j.g), eyes: int(j.e) },
    home: j.h === 'g' ? 'grove' : 'moonbase',
    born: Number.isInteger(j.s) && j.s > 1_600_000_000 ? j.s * 1000 : Date.now(),
  }
}

/** Bring a Cozmling back from its saved note (this browser had no copy). */
export function restore(owner: string, s: Saved, txid: string, round: number, now = Date.now()): Pet {
  return { v: 1, name: s.name, look: s.look, home: s.home, born: s.born, hatched: s.born, food: 65, fun: 65, energy: 75, at: now, asleep: null, fed: 0, played: 0, pets: 0, owner, txid, round }
}

/**
 * Bring the needs up to `now`. A Cozmling that runs out of energy dozes off by
 * itself and wakes up when it is rested, so a long absence plays out naturally.
 * Eggs don't need anything.
 */
export function settle(p: Pet, now = Date.now()): Pet {
  if (!p.hatched) return { ...p, at: now }
  let { food, fun, energy, asleep } = p
  let at = p.at
  for (let i = 0; at < now && i < 400; i++) {
    const left = now - at
    if (asleep == null) {
      const toEmpty = energy / AWAKE.energy
      const dt = Math.min(left, toEmpty)
      food -= dt * AWAKE.food; fun -= dt * AWAKE.fun; energy -= dt * AWAKE.energy
      at += dt
      if (dt === toEmpty) asleep = at                    // ran out of steam: naps
    } else {
      const toFull = (100 - energy) / REFILL
      const dt = Math.min(left, toFull)
      food -= dt * ASLEEP.food; fun -= dt * ASLEEP.fun; energy += dt * REFILL
      at += dt
      if (dt === toFull) asleep = null                   // rested: wakes up on its own
    }
    food = clamp(food); fun = clamp(fun); energy = clamp(energy)
  }
  return { ...p, food, fun, energy, asleep, at: now }
}

/* ---- things you can do ---- */
export interface Food { id: string; name: string; food: number; fun: number }
export const FOODS: Food[] = [
  { id: 'cheese', name: 'Moon cheese', food: 32, fun: 0 },
  { id: 'starfruit', name: 'Star fruit', food: 22, fun: 6 },
  { id: 'cookie', name: 'Comet cookie', food: 12, fun: 14 },
]

export type Outcome = { pet: Pet; ok: boolean; say: string }

export function feed(p: Pet, f: Food): Outcome {
  if (p.asleep) return { pet: p, ok: false, say: `${p.name} is asleep.` }
  if (p.food >= 94) return { pet: p, ok: false, say: `${p.name} is full.` }
  return { pet: { ...p, food: clamp(p.food + f.food), fun: clamp(p.fun + f.fun), fed: p.fed + 1 }, ok: true, say: f.fun > 10 ? 'A treat!' : 'Yum.' }
}

export function play(p: Pet): Outcome {
  if (p.asleep) return { pet: p, ok: false, say: `${p.name} is asleep.` }
  if (p.energy < 12) return { pet: p, ok: false, say: `${p.name} is too sleepy to play.` }
  return { pet: { ...p, fun: clamp(p.fun + 26), energy: clamp(p.energy - 8), food: clamp(p.food - 4), played: p.played + 1 }, ok: true, say: 'Again, again!' }
}

export function toggleSleep(p: Pet, now = Date.now()): Outcome {
  if (p.asleep && p.energy < 6) return { pet: p, ok: false, say: `${p.name} is too tired to wake up.` }
  if (p.asleep) return { pet: { ...p, asleep: null }, ok: true, say: p.energy < 40 ? `${p.name} wakes up a bit groggy.` : `${p.name} is up and ready.` }
  if (p.energy > 92) return { pet: p, ok: false, say: `${p.name} isn’t tired yet.` }
  return { pet: { ...p, asleep: now }, ok: true, say: 'Goodnight.' }
}

export function pat(p: Pet): Outcome {
  return { pet: { ...p, fun: clamp(p.fun + 3), pets: p.pets + 1 }, ok: true, say: '' }
}

/* ---- how it's doing ---- */
export type Mood = 'great' | 'good' | 'low'
export function mood(p: Pet): { mood: Mood; need: Need | null; line: string } {
  const n = p.name
  if (!p.hatched) return { mood: 'good', need: null, line: 'Something is moving inside. Tap the egg.' }
  if (p.asleep) return { mood: 'good', need: null, line: p.energy > 85 ? `${n} is about to wake up.` : `${n} is fast asleep.` }
  const needs: [Need, number][] = [['food', p.food], ['fun', p.fun], ['energy', p.energy]]
  const [need, low] = needs.reduce((a, b) => (b[1] < a[1] ? b : a))
  if (low < 25) return { mood: 'low', need, line: need === 'food' ? `${n} is hungry.` : need === 'fun' ? `${n} is bored. Play together?` : `${n} can barely keep their eyes open.` }
  if (low < 55) return { mood: 'good', need, line: need === 'food' ? `${n} could eat something.` : need === 'fun' ? `${n} wants to play.` : `${n} is getting tired.` }
  return { mood: 'great', need: null, line: `${n} is over the moon.` }
}

/** The stage the prototype shows. In the full launch, stages come from on-chain levels. */
export const stageOf = (p: Pet): Stage => (!p.hatched ? 'egg' : p.preview ?? 'sprout')

export const ageText = (p: Pet, now = Date.now()) => {
  const d = Math.floor((now - (p.hatched ?? p.born)) / 86_400_000)
  return !p.hatched ? 'Not hatched yet' : d < 1 ? 'Hatched today' : d === 1 ? '1 day old' : `${d} days old`
}
