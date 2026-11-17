/* ============================================================
   CARE in v2 — the first version's rules, unchanged.

   Food, Fun and Energy; needs run down while you're away; sleep restores energy; nothing ever
   dies. A first-version Cozmling already carries its state in the v1 shape. An adventurer's
   care state is shown to the very same v1 functions (src/companion/care.ts) through asPet(),
   so both kinds follow one set of rules and there is no second copy of them to drift.
   ============================================================ */
import * as v1 from '../../companion/care'
import { DEFAULT_LOOK } from '../../companion/look'
import type { AdventurerCompanion, Companion, Pet } from '../types'

export const CARE_RULES = 'v1-care'
export const STAGE_RULES = 'fixture-1'          // adventurer stages have no approved thresholds yet

/** An adventurer's care state as the v1 rules see it. (Look and home are not used by those rules.) */
export function asPet(c: AdventurerCompanion): Pet {
  const k = c.progress.counters
  return {
    v: 1, name: c.name, look: DEFAULT_LOOK.boy, home: 'loft', born: c.createdAt,
    hatched: c.hatch.status === 'hatched' ? c.hatch.hatchedAt ?? c.createdAt : null,
    food: c.care.food, fun: c.care.fun, energy: c.care.energy, at: c.care.settledAt, asleep: c.care.asleepAt,
    fed: k.fed ?? 0, played: k.played ?? 0, pets: k.pets ?? 0, arcade: k.arcade ?? 0, cheered: k.cheered ?? 0, checkins: k.checkins ?? 0,
    ...(k.tallyDay != null ? { tally: { day: k.tallyDay, fed: k.tallyFed ?? 0, played: k.tallyPlayed ?? 0, pets: k.tallyPets ?? 0 } } : {}),
  }
}
/** The adventurer after the v1 rules have changed its care state. */
export function withPet(c: AdventurerCompanion, p: Pet): AdventurerCompanion {
  return {
    ...c,
    care: { ...c.care, food: p.food, fun: p.fun, energy: p.energy, asleepAt: p.asleep, settledAt: p.at },
    progress: { ...c.progress, experience: v1.growthPoints(p), counters: { ...c.progress.counters, fed: p.fed, played: p.played, pets: p.pets, arcade: p.arcade ?? 0, cheered: p.cheered ?? 0, checkins: p.checkins ?? 0,
      ...(p.tally ? { tallyDay: p.tally.day, tallyFed: p.tally.fed, tallyPlayed: p.tally.played, tallyPets: p.tally.pets } : {}) } },
  }
}

/** Any companion's care state in the v1 shape… */
export const petOf = (c: Companion): Pet => (c.kind === 'legacy' ? c.legacy.pet : asPet(c))
/** …and any companion with a new care state. */
export const withPetOf = (c: Companion, p: Pet): Companion => (c.kind === 'legacy' ? { ...c, legacy: { ...c.legacy, pet: p } } : withPet(c, p))
export const nameOf = (c: Companion) => (c.kind === 'legacy' ? c.legacy.pet.name : c.name)

/** Its needs brought up to now, and how it is doing. Nothing is saved by looking. */
export function look(c: Companion, now = Date.now()) {
  const pet = v1.settle(petOf(c), now)
  return { pet, mood: v1.mood(pet), hatched: !!pet.hatched, asleep: !!pet.asleep }
}

export type CareAction = { do: 'feed'; food: string } | { do: 'play' } | { do: 'pat' } | { do: 'rest' }
export interface CareResult { companion: Companion | null; ok: boolean; say: string }

/** One care action by the v1 rules. `companion` is null when nothing changed (asleep, full, too tired). */
export function careFor(c: Companion, a: CareAction, now: number): CareResult {
  const pet = v1.settle(petOf(c), now)
  if (!pet.hatched) return { companion: null, ok: false, say: 'It hasn’t hatched yet.' }
  let out: v1.Outcome
  if (a.do === 'feed') {
    const food = v1.FOODS.find(f => f.id === a.food)
    if (!food) return { companion: null, ok: false, say: '' }
    out = v1.feed(pet, food)
  } else if (a.do === 'play') out = v1.play(pet)
  else if (a.do === 'rest') out = v1.toggleSleep(pet, now)
  else if (pet.asleep) return { companion: null, ok: false, say: `Shh, ${pet.name} is sleeping.` }
  else out = v1.pat(pet)
  return { companion: out.ok ? withPetOf(c, out.pet) : null, ok: out.ok, say: out.say }
}

/** The egg hatches. For an adventurer that makes it a Hatchling; a first-version egg becomes a Sprout by its own rules. */
export function hatch(c: Companion, now: number): Companion | null {
  if (c.hatch.status === 'hatched') return null
  if (c.kind === 'legacy') return { ...c, legacy: { ...c.legacy, pet: { ...c.legacy.pet, hatched: now, at: now } } }
  return { ...c, hatch: { status: 'hatched', hatchedAt: now, provenance: 'known' }, care: { ...c.care, settledAt: now }, progress: { ...c.progress, visualStage: 'hatchling' } }
}

/** A Starprint's first visit of the UTC day: it counts once toward growing up (as a first-version Cozmling's daily
    check-in does). null when it isn't hatched or was already visited today, so a second tab changes nothing. */
export function dailyVisit(c: Companion, now: number): Companion | null {
  if (c.kind !== 'adventurer' || c.hatch.status !== 'hatched') return null
  const day = v1.utcDay(now), k = c.progress.counters
  if (k.visitDay === day) return null
  const pet = asPet(c)
  const next = withPet(c, { ...pet, checkins: (pet.checkins ?? 0) + 1 })
  return { ...next, progress: { ...next.progress, counters: { ...next.progress.counters, visitDay: day } } }
}

/** A finished arcade run cheers up the selected Starprint, by the same rules as a first-version Cozmling. */
export function arcadeCheer(c: Companion, run: v1.RunInfo, now: number): { companion: Companion | null; outcome: v1.RunOutcome } {
  const outcome = v1.arcadeRun(petOf(c), run, now)
  const changed = outcome.pet.arcade !== petOf(c).arcade
  return { companion: changed ? withPetOf(c, outcome.pet) : null, outcome }
}
