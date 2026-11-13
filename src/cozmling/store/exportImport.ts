/* A file the player can keep: every companion on this device, the untouched v1 originals and the
   event history. Importing never overwrites anything by itself: companions that aren't here yet are
   added, and where the file holds a newer copy of one that is here, the player is asked.

   An imported first-version Cozmling is not written into a v1 key (that key may belong to another
   Cozmling on this device), so it is not visible to the old page. */
import type { Companion, JourneyEvent, Snapshot, SourceRecord } from '../types'
import type { Repository, WriteResult } from './repository'
import { companionProblem } from './validators'

export interface ExportFile { format: 'cozmc-cozmling'; version: 1; exportedAt: number; companions: Companion[]; sources: SourceRecord[]; events: JourneyEvent[] }

export async function exportAll(repo: Repository, now: number): Promise<ExportFile> {
  const snap = await repo.load()
  return { format: 'cozmc-cozmling', version: 1, exportedAt: now, companions: snap.companions, sources: snap.sources, events: await repo.events() }
}

export interface ImportPlan {
  /** Not on this device yet: safe to add. */
  add: Companion[]
  /** Already here, the same or newer: nothing to do. */
  same: string[]
  /** Already here, and the file's copy is newer: the player chooses. */
  newer: { incoming: Companion; existing: Companion }[]
  rejected: { id: string; reason: string }[]
  events: JourneyEvent[]
}

export function planImport(file: unknown, snap: Snapshot, haveEvents: Set<string>): { ok: false; reason: string } | { ok: true; plan: ImportPlan } {
  const f = file as Partial<ExportFile> | null
  if (!f || f.format !== 'cozmc-cozmling') return { ok: false, reason: 'This is not a Cozmling save file.' }
  if (f.version !== 1) return { ok: false, reason: 'This save file is from a newer version of the site.' }
  if (!Array.isArray(f.companions)) return { ok: false, reason: 'This save file has no companions in it.' }
  const here = new Map(snap.companions.map(c => [c.companionId, c]))
  const plan: ImportPlan = { add: [], same: [], newer: [], rejected: [], events: [] }
  const seen = new Set<string>()
  for (const raw of f.companions) {
    const why = companionProblem(raw), id = String((raw as any)?.companionId ?? '?')
    if (why) { plan.rejected.push({ id, reason: why }); continue }
    if (seen.has(id)) { plan.rejected.push({ id, reason: 'listed twice in the file' }); continue }
    seen.add(id)
    let c = raw as Companion
    if (c.kind === 'legacy') c = { ...c, legacy: { ...c.legacy, sourceKey: '' } }       // see the note at the top
    const existing = here.get(id)
    if (!existing) plan.add.push(c)
    else if (c.revision > existing.revision) plan.newer.push({ incoming: c, existing })
    else plan.same.push(id)
  }
  const coming = new Set([...plan.add, ...plan.newer.map(n => n.incoming)].map(c => c.companionId))
  for (const e of Array.isArray(f.events) ? f.events : []) {
    if (e && typeof e.eventId === 'string' && typeof e.companionId === 'string' && typeof e.at === 'number' && coming.has(e.companionId) && !haveEvents.has(e.eventId)) plan.events.push(e)
  }
  return { ok: true, plan }
}

/** Add what is new, and replace only the companions whose ids are in `takeNewer` (the player's explicit choice). */
export async function applyImport(repo: Repository, plan: ImportPlan, takeNewer: Set<string> = new Set()): Promise<WriteResult> {
  const chosen = plan.newer.filter(n => takeNewer.has(n.incoming.companionId))
  const ids = new Set([...plan.add, ...chosen.map(n => n.incoming)].map(c => c.companionId))
  return repo.write({
    companions: [...plan.add.map(record => ({ record, expect: null })), ...chosen.map(n => ({ record: n.existing.celestial ? { ...n.incoming, celestial: n.existing.celestial } : n.incoming, expect: n.existing.revision }))],
    events: plan.events.filter(e => ids.has(e.companionId)),
  })
}
