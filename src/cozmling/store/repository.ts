/* Where companions are kept. The rules of the game (care, migration, the arcade bridge) only ever
   talk to this small interface, so they can be tested against the in-memory version and run in the
   browser on IndexedDB. */
import type { Companion, JourneyEvent, Snapshot, SourceRecord } from '../types'

/** One all-or-nothing change. */
export interface Write {
  /** Each record replaces the stored one only if the stored revision is `expect` (null = it must not exist yet).
      That is what stops a slow or stale tab from overwriting something newer. */
  companions?: { record: Companion; expect: number | null }[]
  sources?: SourceRecord[]
  /** New events. If any of their ids is already stored, nothing in this write is applied. */
  events?: JourneyEvent[]
  meta?: Record<string, unknown>
}
export type WriteResult = { ok: true } | { ok: false; reason: 'stale' | 'duplicate' | 'failed'; detail: string }

export interface Repository {
  /** true = it survives closing the browser; false = it lasts for this visit only. */
  readonly durable: boolean
  load(): Promise<Snapshot>
  write(w: Write): Promise<WriteResult>
  events(companionId?: string): Promise<JourneyEvent[]>
}

/** Why a write can't go ahead, or null. Shared by both repositories so they refuse the same things. */
export function refusal(w: Write, storedRevision: (id: string) => number | null, hasEvent: (id: string) => boolean): Exclude<WriteResult, { ok: true }> | null {
  for (const e of w.events ?? []) if (hasEvent(e.eventId)) return { ok: false, reason: 'duplicate', detail: e.eventId }
  for (const c of w.companions ?? []) {
    const have = storedRevision(c.record.companionId)
    if (have !== c.expect) return { ok: false, reason: 'stale', detail: `${c.record.companionId}: stored revision ${have}, expected ${c.expect}` }
  }
  return null
}
