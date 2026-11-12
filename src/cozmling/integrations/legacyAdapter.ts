/* First-version Cozmlings inside v2. A legacy companion carries its v1 state whole, in the v1
   shape, so the v1 care rules keep working on it and the old page can always read it back. */
import { growthPoints, stageOf, type Pet } from '../../companion/care'
import { STAGES } from '../../companion/look'
import type { Hatch, LegacyCompanion, LegacyStage } from '../types'

/** Where the first version keeps Cozmlings in localStorage: this key for a guest, `${V1_KEY}:${wallet}` for a wallet's. */
export const V1_KEY = 'cozmc-cozmling-v1'
export const isV1Key = (k: string) => k === V1_KEY || (k.startsWith(`${V1_KEY}:`) && k !== `${V1_KEY}:probe`)
/** The wallet a v1 key belongs to, or null for the guest key. */
export const ownerOfKey = (sourceKey: string) => (sourceKey.startsWith(`${V1_KEY}:`) ? sourceKey.slice(V1_KEY.length + 1) : null)
/** Exactly what the first version writes for this Cozmling. */
export const v1Text = (pet: Pet) => JSON.stringify(pet)

/** What we can honestly say about its hatch. A Cozmling brought back from a wallet note has
    `hatched` set equal to `born` by the old restore code (the note never recorded a hatch), so
    for those the time is unknown, not invented. Once unknown, it stays unknown. */
export function hatchOf(pet: Pet, before?: Hatch): Hatch {
  if (!pet.hatched) return { status: 'egg', hatchedAt: null, provenance: 'known' }
  if (before?.status === 'hatched') return before
  return pet.hatched === pet.born ? { status: 'hatched', hatchedAt: null, provenance: 'legacy-unknown' } : { status: 'hatched', hatchedAt: pet.hatched, provenance: 'known' }
}

export function legacyFromPet(pet: Pet, o: { companionId: string; sourceKey: string; sourceHash: string; now: number }): LegacyCompanion {
  const owner = ownerOfKey(o.sourceKey) ?? pet.owner
  return {
    schemaVersion: 2, kind: 'legacy', companionId: o.companionId, revision: 0, createdAt: pet.born, updatedAt: o.now,
    hatch: hatchOf(pet),
    walletLinks: owner ? [{ address: owner, linkedAt: o.now, status: 'linked' }] : [],
    legacy: { sourceKey: o.sourceKey, sourceHash: o.sourceHash, migratedAt: o.now, stageFloor: stageOf(pet), growthFloor: growthPoints(pet), pet },
  }
}

/** A stage, never lower than a floor (an egg is always an egg). */
export function stageWithFloor(pet: Pet, floor: LegacyStage): LegacyStage {
  const now = stageOf(pet)
  if (now === 'egg') return 'egg'
  return STAGES.indexOf(now) >= STAGES.indexOf(floor) ? now : floor
}
/** Its stage: what the v1 rules say now, and never lower than the stage it was brought in at. */
export const legacyStage = (c: LegacyCompanion): LegacyStage => stageWithFloor(c.legacy.pet, c.legacy.stageFloor)
export const legacyGrowth = (c: LegacyCompanion) => Math.max(growthPoints(c.legacy.pet), c.legacy.growthFloor)

/** The same Cozmling, saved twice (v2's copy and a newer one the old page wrote). The newer one's
    state is taken; lifetime counts only ever go up, so the larger of each is kept. */
export function takeNewer(mine: Pet, theirs: Pet): Pet {
  const top = (a?: number, b?: number) => (a == null && b == null ? undefined : Math.max(a ?? 0, b ?? 0))
  const out: Pet = { ...theirs, fed: Math.max(mine.fed, theirs.fed), played: Math.max(mine.played, theirs.played), pets: Math.max(mine.pets, theirs.pets) }
  for (const k of ['arcade', 'cheered', 'checkins'] as const) { const v = top(mine[k], theirs[k]); if (v !== undefined) out[k] = v }
  if (mine.hatched && !theirs.hatched) out.hatched = mine.hatched      // a hatch is never undone
  return out
}

/** Are these the same Cozmling in the same state, apart from time passing (needs drifting, the clock moving on)?
    The old page rewrites its save every few seconds while it is open; that alone is nothing to take in. */
export function onlyTimePassed(a: Pet, b: Pet): boolean {
  const still = (p: Pet) => v1Text({ ...p, food: 0, fun: 0, energy: 0, at: 0 })
  return still(a) === still(b)
}
