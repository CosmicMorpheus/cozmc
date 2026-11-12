/* The durable repository: IndexedDB, one all-or-nothing transaction per change.
   No library: the four calls it needs are wrapped below. */
import type { Companion, JourneyEvent, SourceRecord } from '../types'
import { refusal, type Repository, type Write, type WriteResult } from './repository'

export const DB_NAME = 'cozmc-cozmling-v2'
const STORES = ['companions', 'sources', 'events', 'meta'] as const

const req = <T,>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('aborted')) })

function open(name: string): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(name, 1)
    r.onupgradeneeded = () => {
      const db = r.result
      db.createObjectStore('companions', { keyPath: 'companionId' })
      db.createObjectStore('sources', { keyPath: 'sourceKey' })
      db.createObjectStore('events', { keyPath: 'eventId' }).createIndex('companionId', 'companionId')
      db.createObjectStore('meta')
    }
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
    r.onblocked = () => rej(new Error('blocked'))
  })
}

/** The IndexedDB repository, or null when this browser won't give us one (the caller then keeps things for the visit only). */
export async function indexedDbRepository(name = DB_NAME): Promise<Repository | null> {
  let db: IDBDatabase
  try {
    if (typeof indexedDB === 'undefined') return null
    db = await open(name)
  } catch { return null }
  db.onversionchange = () => db.close()      // a newer tab upgraded the database: let it
  return {
    durable: true,
    async load() {
      const tx = db.transaction(STORES, 'readonly')
      const [companions, sources, keys, values] = await Promise.all([
        req(tx.objectStore('companions').getAll() as IDBRequest<Companion[]>), req(tx.objectStore('sources').getAll() as IDBRequest<SourceRecord[]>),
        req(tx.objectStore('meta').getAllKeys()), req(tx.objectStore('meta').getAll()),
      ])
      return { companions, sources, meta: Object.fromEntries(keys.map((k, i) => [String(k), values[i]])) }
    },
    async write(w: Write): Promise<WriteResult> {
      try {
        const tx = db.transaction(STORES, 'readwrite'), finished = done(tx)
        finished.catch(() => { /* reported below */ })
        // read what the checks need, all in this same transaction
        const [have, seen] = await Promise.all([
          Promise.all((w.companions ?? []).map(c => req(tx.objectStore('companions').get(c.record.companionId) as IDBRequest<Companion | undefined>))),
          Promise.all((w.events ?? []).map(e => req(tx.objectStore('events').getKey(e.eventId)))),
        ])
        const revs = new Map((w.companions ?? []).map((c, i) => [c.record.companionId, have[i]?.revision ?? null]))
        const dupes = new Set((w.events ?? []).filter((_, i) => seen[i] !== undefined).map(e => e.eventId))
        const no = refusal(w, id => revs.get(id) ?? null, id => dupes.has(id))
        if (no) { tx.abort(); return no }
        for (const c of w.companions ?? []) tx.objectStore('companions').put(c.record)
        for (const s of w.sources ?? []) tx.objectStore('sources').put(s)
        for (const e of w.events ?? []) tx.objectStore('events').add(e)
        for (const [k, v] of Object.entries(w.meta ?? {})) tx.objectStore('meta').put(v, k)
        await finished
        return { ok: true }
      } catch (e: any) {
        return { ok: false, reason: 'failed', detail: String(e?.name ?? e?.message ?? e) }      // quota, a closed database: never reported as saved
      }
    },
    async events(companionId) {
      const s = db.transaction('events', 'readonly').objectStore('events')
      const all = await req((companionId ? s.index('companionId').getAll(companionId) : s.getAll()) as IDBRequest<JourneyEvent[]>)
      return all.sort((a, b) => a.at - b.at)
    },
  }
}
