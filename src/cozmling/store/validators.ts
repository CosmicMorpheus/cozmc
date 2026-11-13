/* Checks on everything that comes in from outside the running page: a v1 save in localStorage,
   a v1 wallet note, a v2 record in an import file. A record that fails is set aside as it is
   (quarantined). It is never repaired on the quiet and never deleted. */
import { fromNote, HOMES, type Pet, type Saved } from '../../companion/care'
import { BODIES, DEFAULT_LOOK, EYES, GLOWS, STAGES } from '../../companion/look'
import type { Companion } from '../types'
import { celestialProblem } from '../celestial/validate'
import { placeShapeProblem } from '../celestial/birthplace'

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const count = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const need = (v: unknown) => num(v) && v >= 0 && v <= 100
const index = (v: unknown, size: number) => Number.isInteger(v) && (v as number) >= 0 && (v as number) < size
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']

export type V1Result = { ok: true; pet: Pet; warnings: string[] } | { ok: false; reason: string }

/** Read one v1 localStorage value. A good one comes back exactly as the first version's own reader
    returns it. The first version's reader also lets incomplete records through; this one does not. */
export function readV1(raw: string): V1Result {
  let p: any
  try { p = JSON.parse(raw) } catch { return { ok: false, reason: 'not readable (broken JSON)' } }
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, reason: 'not a saved Cozmling' }
  if (p.v !== 1) return { ok: false, reason: 'not a version 1 save' }
  if (!p.look || typeof p.look !== 'object') return { ok: false, reason: 'missing: look' }
  const warnings: string[] = []
  // the two adjustments the v1 reader makes, so it is shown exactly as the old page shows it
  if (!('body' in p.look)) { p.look = { ...DEFAULT_LOOK[p.look.form === 'girl' ? 'girl' : 'boy'] }; warnings.push('saved before the alien redesign: shown with the default look, as the old page does') }
  delete p.preview

  const missing: string[] = []
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 64) missing.push('name')
  if (!(p.home in HOMES)) missing.push('home')
  if (!num(p.born) || p.born <= 0) missing.push('born')
  if (p.hatched !== null && !num(p.hatched)) missing.push('hatched')
  for (const k of ['food', 'fun', 'energy'] as const) if (!need(p[k])) missing.push(k)
  if (!num(p.at)) missing.push('at')
  if (p.asleep !== null && !num(p.asleep)) missing.push('asleep')
  for (const k of ['fed', 'played', 'pets'] as const) if (!count(p[k])) missing.push(k)
  for (const k of ['arcade', 'cheered', 'checkins'] as const) if (p[k] !== undefined && !count(p[k])) missing.push(k)
  if (p.owner !== undefined && typeof p.owner !== 'string') missing.push('owner')
  if (p.txid !== undefined && typeof p.txid !== 'string') missing.push('txid')
  if (p.round !== undefined && !count(p.round)) missing.push('round')
  if (missing.length) return { ok: false, reason: `missing or invalid: ${missing.join(', ')}` }

  if (p.look.form !== 'boy' && p.look.form !== 'girl') return { ok: false, reason: 'unknown form' }
  if (!index(p.look.body, BODIES.length) || !index(p.look.glow, GLOWS.length) || !index(p.look.eyes, EYES.length)) return { ok: false, reason: 'a colour that does not exist' }
  return { ok: true, pet: p as Pet, warnings }
}

export type NoteResult = { ok: true; saved: Saved; warnings: string[] } | { ok: false; reason: string }

/** Read the JSON of a v1 wallet note. The first version accepts colour numbers that don't exist
    (and then draws the first colour); here that is made explicit and written down as a warning. */
export function readNote(j: unknown): NoteResult {
  const saved = fromNote(j)
  if (!saved) return { ok: false, reason: 'not a Cozmling note' }
  const warnings: string[] = []
  const fix = (k: 'body' | 'glow' | 'eyes', size: number) => { if (saved.look[k] >= size) { warnings.push(`${k} colour ${saved.look[k]} does not exist: shown as the first colour`); saved.look[k] = 0 } }
  fix('body', BODIES.length); fix('glow', GLOWS.length); fix('eyes', EYES.length)
  return { ok: true, saved, warnings }
}

/** Is this a v2 record we can safely take in (from an import file, or read back from storage)? Returns why not, or null. */
export function companionProblem(c: any): string | null {
  if (!c || typeof c !== 'object') return 'not a companion'
  if (c.schemaVersion !== 2) return 'not a version 2 record'
  if (typeof c.companionId !== 'string' || c.companionId.length < 8 || c.companionId.length > 64) return 'no companion id'
  if (!count(c.revision) || !num(c.createdAt) || !num(c.updatedAt)) return 'missing revision or dates'
  const h = c.hatch
  if (!h || (h.status !== 'egg' && h.status !== 'hatched') || (h.hatchedAt !== null && !num(h.hatchedAt)) || (h.provenance !== 'known' && h.provenance !== 'legacy-unknown')) return 'invalid hatch record'
  if (!Array.isArray(c.walletLinks) || c.walletLinks.some((l: any) => typeof l?.address !== 'string' || !num(l.linkedAt) || (l.status !== 'linked' && l.status !== 'recovery-candidate'))) return 'invalid wallet links'
  if (c.archived !== undefined && (!num(c.archived?.at) || typeof c.archived?.reason !== 'string')) return 'invalid archive note'
  if (c.celestial !== undefined) { const why = celestialProblem(c.celestial, c.companionId); if (why) return `invalid birth sky: ${why}` }
  if (c.kind === 'legacy') {
    const l = c.legacy
    if (!l || typeof l.sourceKey !== 'string' || typeof l.sourceHash !== 'string' || !num(l.migratedAt) || !STAGES.includes(l.stageFloor) || !count(l.growthFloor)) return 'invalid legacy record'
    const pet = readV1(JSON.stringify(l.pet ?? null))
    return pet.ok ? null : `its v1 state is ${pet.reason}`
  }
  if (c.kind === 'adventurer') {
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.length > 64) return 'no name'
    const s = c.starprint, a = c.appearance, k = c.care, p = c.progress
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s.chosenBirthday) || !SIGNS.includes(s.coreSign) || !['fire', 'earth', 'air', 'water'].includes(s.element) || typeof s.archetype !== 'string' || !['fixture', 'partial', 'calculated'].includes(s.status) || typeof s.engineVersion !== 'string') return 'invalid Starprint'
    if (s.birthplace !== undefined && placeShapeProblem(s.birthplace)) return 'invalid birthplace'
    if (!a || (a.appearanceOption !== 'a' && a.appearanceOption !== 'b') || typeof a.skin !== 'string' || typeof a.outfit !== 'string' || typeof a.home !== 'string' || !Array.isArray(a.decor) || typeof a.rendererVersion !== 'string') return 'invalid appearance'
    if (!k || !need(k.food) || !need(k.fun) || !need(k.energy) || (k.asleepAt !== null && !num(k.asleepAt)) || !num(k.settledAt) || typeof k.ruleVersion !== 'string') return 'invalid care state'
    if (!p || !count(p.experience) || !(p.visualStage === null || ['hatchling', 'adolescent', 'ascended'].includes(p.visualStage)) || typeof p.visualStageVersion !== 'string' || !p.counters || typeof p.counters !== 'object') return 'invalid progress'
    return null
  }
  return 'unknown kind of companion'
}
export const isCompanion = (c: unknown): c is Companion => companionProblem(c) === null
