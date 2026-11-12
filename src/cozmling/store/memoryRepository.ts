/* A repository that lives in memory: for tests, and for a browser that won't store anything
   (some private modes). Progress kept here lasts for the visit, and the page says so. */
import type { Companion, JourneyEvent, SourceRecord } from '../types'
import { refusal, type Repository, type Write, type WriteResult } from './repository'

const copy = <T,>(v: T): T => structuredClone(v)

export function memoryRepository(): Repository {
  const companions = new Map<string, Companion>(), sources = new Map<string, SourceRecord>(), events = new Map<string, JourneyEvent>(), meta = new Map<string, unknown>()
  return {
    durable: false,
    async load() { return copy({ companions: [...companions.values()], sources: [...sources.values()], meta: Object.fromEntries(meta) }) },
    async write(w: Write): Promise<WriteResult> {
      const no = refusal(w, id => companions.get(id)?.revision ?? null, id => events.has(id))
      if (no) return no
      for (const c of w.companions ?? []) companions.set(c.record.companionId, copy(c.record))
      for (const s of w.sources ?? []) sources.set(s.sourceKey, copy(s))
      for (const e of w.events ?? []) events.set(e.eventId, copy(e))
      for (const [k, v] of Object.entries(w.meta ?? {})) meta.set(k, copy(v))
      return { ok: true }
    },
    async events(companionId) { return copy([...events.values()].filter(e => !companionId || e.companionId === companionId).sort((a, b) => a.at - b.at)) },
  }
}
