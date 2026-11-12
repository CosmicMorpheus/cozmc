/* Bringing first-version Cozmlings into v2, and keeping the two in step.

   - Nothing in the v1 keys is ever deleted or renamed, and the first value seen under each key is
     kept untouched, with its checksum, in the `sources` store.
   - It can run any number of times: a key that has already been handled gives the same companion.
   - While v2 is switched on, a legacy Cozmling's care changes are written back to its v1 key in the
     v1 shape ("mirroring"), so switching v2 off again, or an old tab, loses nothing.
   - If the v1 key changed without v2 (an old tab, or a spell with v2 switched off), that is taken
     in by the rules below. Whatever is replaced goes into the source's history first.

   planSync only reads. It returns the one all-or-nothing write to make, and the v1 values to write
   back after that write has succeeded. */
import type { Companion, JourneyEvent, LegacyCompanion, Snapshot, SourceRecord } from '../types'
import { hatchOf, isV1Key, legacyFromPet, onlyTimePassed, takeNewer, v1Text } from '../integrations/legacyAdapter'
import { readV1 } from './validators'
import type { Write } from './repository'

export const MIGRATION_VERSION = 1
const KEEP_HISTORY = 6

export interface StorageLike { readonly length: number; key(i: number): string | null; getItem(k: string): string | null; setItem(k: string, v: string): void }
export interface Env { storage: StorageLike | null; now(): number; newId(): string; hash(s: string): Promise<string> }

export interface SyncReport {
  migrated: string[]                                     // companion ids created from a v1 save
  quarantined: { sourceKey: string; reason: string }[]   // every v1 value that is set aside, old or new
  tookFromV1: string[]                                   // companions updated from a newer v1 save
  replaced: { was: string; now: string }[]               // a different Cozmling now lives under the key
  warnings: { sourceKey: string; text: string }[]
}
export interface SyncPlan { write: Write | null; mirror: { key: string; raw: string }[]; report: SyncReport }

function v1Keys(storage: StorageLike | null): string[] {
  const keys: string[] = []
  try { for (let i = 0; storage && i < storage.length; i++) { const k = storage.key(i); if (k && isV1Key(k)) keys.push(k) } } catch { /* storage is switched off */ }
  return keys
}
const readKey = (storage: StorageLike | null, k: string) => { try { return storage?.getItem(k) ?? null } catch { return null } }

export async function planSync(snap: Snapshot, env: Env): Promise<SyncPlan> {
  const now = env.now()
  const sources = new Map(snap.sources.map(s => [s.sourceKey, s]))
  const byId = new Map(snap.companions.map(c => [c.companionId, c]))
  const out = { companions: [] as { record: Companion; expect: number | null }[], sources: [] as SourceRecord[], events: [] as JourneyEvent[] }
  const mirror: { key: string; raw: string }[] = []
  const report: SyncReport = { migrated: [], quarantined: [], tookFromV1: [], replaced: [], warnings: [] }
  const remember = (s: SourceRecord, raw: string, hash: string, note: string) => [...s.history, { at: now, hash, raw, note }].slice(-KEEP_HISTORY)

  const bringIn = (key: string, pet: Parameters<typeof legacyFromPet>[0], hash: string, tag: string): LegacyCompanion => {
    const c = legacyFromPet(pet, { companionId: env.newId(), sourceKey: key, sourceHash: hash, now })
    out.companions.push({ record: c, expect: null })
    // the id is the same for every tab that sees this value, so two tabs can't both bring it in
    out.events.push({ eventId: `${tag}:${key}:${hash}`, companionId: c.companionId, type: 'migrated', at: now, data: { sourceKey: key } })
    report.migrated.push(c.companionId)
    return c
  }

  for (const key of new Set([...v1Keys(env.storage), ...sources.keys()])) {
    const raw = readKey(env.storage, key), src = sources.get(key)
    const live = src?.companionId ? byId.get(src.companionId) : undefined
    const mine = live?.kind === 'legacy' && !live.archived ? live : undefined

    if (!src) {                                             // a v1 save we have never seen
      if (raw == null) continue
      const hash = await env.hash(raw), r = readV1(raw)
      const base = { sourceKey: key, originalRaw: raw, originalHash: hash, firstSeenAt: now, lastSeenHash: hash, history: [], migrationVersion: MIGRATION_VERSION }
      if (!r.ok) { out.sources.push({ ...base, status: 'quarantined', reason: r.reason }); report.quarantined.push({ sourceKey: key, reason: r.reason }); continue }
      const c = bringIn(key, r.pet, hash, 'migrated')
      out.sources.push({ ...base, status: 'migrated', companionId: c.companionId })
      r.warnings.forEach(text => report.warnings.push({ sourceKey: key, text }))
      continue
    }

    if (raw == null) {                                      // the v1 key is gone (storage cleared, or the old page removed it)
      if (src.status === 'quarantined') report.quarantined.push({ sourceKey: key, reason: src.reason ?? 'unreadable' })
      if (mine) { const want = v1Text(mine.legacy.pet), h = await env.hash(want); mirror.push({ key, raw: want }); if (h !== src.lastSeenHash) out.sources.push({ ...src, lastSeenHash: h }) }
      continue
    }

    const hash = await env.hash(raw)
    if (hash === src.lastSeenHash) {                        // nothing changed outside v2
      if (src.status === 'quarantined') report.quarantined.push({ sourceKey: key, reason: src.reason ?? 'unreadable' })
      continue
    }

    const r = readV1(raw)                                   // the v1 value changed without v2
    if (src.status === 'quarantined' || !mine) {
      if (!r.ok) {
        out.sources.push({ ...src, lastSeenHash: hash, reason: r.reason, history: remember(src, raw, hash, 'another unreadable value found under this key') })
        report.quarantined.push({ sourceKey: key, reason: r.reason })
        continue
      }
      const c = bringIn(key, r.pet, hash, 'migrated')        // it is readable now: bring it in, and keep the unreadable original where it is
      out.sources.push({ ...src, status: 'migrated', companionId: c.companionId, lastSeenHash: hash })
      continue
    }

    const pet = mine.legacy.pet
    if (!r.ok) {                                            // v2 holds a good copy and the key now holds something unreadable: keep both, put the good one back
      const want = v1Text(pet)
      out.sources.push({ ...src, lastSeenHash: await env.hash(want), history: remember(src, raw, hash, 'unreadable value found under the v1 key (kept here); the v2 copy was put back') })
      mirror.push({ key, raw: want })
      report.warnings.push({ sourceKey: key, text: `an unreadable value was found under the v1 key (${r.reason}); it is kept in history` })
    } else if (r.pet.born !== pet.born) {                   // a different Cozmling lives under this key now: keep both
      out.companions.push({ record: { ...mine, revision: mine.revision + 1, updatedAt: now, archived: { at: now, reason: 'another Cozmling was adopted in its place on the old page' } }, expect: mine.revision })
      const c = bringIn(key, r.pet, hash, 'replaced')
      out.sources.push({ ...src, companionId: c.companionId, lastSeenHash: hash, history: remember(src, v1Text(pet), mine.legacy.sourceHash, `the Cozmling that was here before (${mine.companionId})`) })
      report.replaced.push({ was: mine.companionId, now: c.companionId })
    } else if (r.pet.at >= pet.at && onlyTimePassed(pet, r.pet)) {
      out.sources.push({ ...src, lastSeenHash: hash })      // the old page only moved the clock on: nothing to take in, nothing to put back
    } else if (r.pet.at >= pet.at) {                        // the same Cozmling, saved more recently by the old page: take it
      const merged = takeNewer(pet, r.pet), want = v1Text(merged)
      out.companions.push({ record: { ...mine, revision: mine.revision + 1, updatedAt: now, hatch: hatchOf(merged, mine.hatch), legacy: { ...mine.legacy, pet: merged } }, expect: mine.revision })
      out.sources.push({ ...src, lastSeenHash: await env.hash(want), history: remember(src, v1Text(pet), src.lastSeenHash, 'the v2 copy before a newer save from the old page was taken') })
      if (want !== raw) mirror.push({ key, raw: want })
      report.tookFromV1.push(mine.companionId)
    } else {                                                // the same Cozmling, but an older save: keep it in history, put v2's back
      const want = v1Text(pet)
      out.sources.push({ ...src, lastSeenHash: await env.hash(want), history: remember(src, raw, hash, 'an older save from the old page (kept here, not used)') })
      mirror.push({ key, raw: want })
    }
  }

  const nothing = !out.companions.length && !out.sources.length && !out.events.length
  return { write: nothing ? null : out, mirror, report }
}

/** Write v1 values back after a successful v2 write. A failure here is harmless: the next sync puts it right. */
export function applyMirror(storage: StorageLike | null, mirror: { key: string; raw: string }[]): boolean {
  let ok = true
  for (const m of mirror) { try { storage?.setItem(m.key, m.raw) } catch { ok = false } }
  return ok && !!storage
}
