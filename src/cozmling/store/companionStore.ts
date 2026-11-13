/* The one shared store behind the Cozmling page, the Home Spotlight and the Arcade Buddy.
   It reads the repository once, brings first-version saves in (migrations.ts), and after that
   every change goes: work out the new record → one all-or-nothing write → only then update what
   the page shows and say "saved". A refused or failed write never looks like a save. */
import { settle, type Pet } from '../../companion/care'
import type { AdventurerCompanion, Companion, JourneyEvent, Snapshot, SourceRecord } from '../types'
import { hatchOf, V1_KEY, v1Text } from '../integrations/legacyAdapter'
import { applyMirror, planSync, type Env, type SyncReport } from './migrations'
import type { Repository, WriteResult } from './repository'
import { INITIAL, type CozState } from './state'
import { companionProblem } from './validators'

export { INITIAL, type CozState } from './state'

export interface Channel { post(msg: unknown): void; listen(cb: (msg: unknown) => void): void }
export type Change = { ok: true; companion: Companion } | { ok: false; reason: 'stale' | 'duplicate' | 'failed' | 'missing'; detail: string }
type EventInput = Omit<JourneyEvent, 'companionId' | 'at'>
export interface UpdateOptions {
  /** Recorded with the change. If an event with this id already exists, the whole change is refused ('duplicate'):
      that is what makes "exactly once" things (a hatch, an arcade run) exactly once. */
  event?: EventInput
  /** A memory worth keeping if it isn't there yet (the first care of a day, say). Never blocks the change. */
  note?: EventInput
}
/** Asks the browser to keep this site's storage (it may clear it otherwise when space runs low). */
export type Persist = { ask(): Promise<boolean>; granted(): Promise<boolean> }

export function createStore(repo: Repository, env: Env, channel?: Channel, persist?: Persist) {
  let state: CozState = { ...INITIAL, durable: repo.durable }
  let sources = new Map<string, SourceRecord>()
  const subs = new Set<() => void>()
  const notes = new Set<string>()          // ids of optional memories known to be recorded already
  const set = (next: Partial<CozState>) => { state = { ...state, ...next }; subs.forEach(f => f()) }
  const byId = (id: string | null) => state.companions.find(c => c.companionId === id)
  const active = (list: Companion[]) => list.filter(c => !c.archived)
  const isGuest = (c: Companion) => c.kind === 'legacy' && c.legacy.sourceKey === V1_KEY
  const touched = (c: Companion) => (c.kind === 'legacy' ? c.legacy.pet.at : c.updatedAt)

  /* One thing at a time. Every change is made to the result of the one before it, so two taps in
     quick succession never both start from the same copy (the second would be refused as out of date). */
  let line: Promise<unknown> = Promise.resolve()
  const inTurn = <T>(job: () => Promise<T>): Promise<T> => { const run = line.then(job, job); line = run.catch(() => {}); return run }

  /** Show what the repository holds. */
  function show(snap: Snapshot, report: SyncReport | null) {
    const good: Companion[] = [], unreadable: CozState['unreadable'] = []
    for (const c of snap.companions) { const why = companionProblem(c); if (why) unreadable.push({ companionId: String((c as any)?.companionId), reason: why }); else good.push(c) }
    good.sort((a, b) => Number(isGuest(b)) - Number(isGuest(a)) || touched(b) - touched(a) || (a.companionId < b.companionId ? -1 : 1))
    sources = new Map(snap.sources.map(s => [s.sourceKey, s]))
    const wanted = typeof snap.meta.selectedId === 'string' ? snap.meta.selectedId : null
    // the player's choice; failing that the guest's (as the old page shows with no wallet), then the one most recently looked after
    const selected = active(good).find(c => c.companionId === wanted) ?? active(good)[0] ?? null
    set({
      status: 'ready', companions: good, unreadable, selectedId: selected?.companionId ?? null, lastSync: report ?? state.lastSync,
      quarantined: report ? report.quarantined : state.quarantined,
    })
    return selected?.companionId ?? null
  }

  /** Look at the v1 saves and bring in whatever is new or changed. Safe to run at any time, any number of times. */
  async function syncNow(): Promise<SyncReport> {
    for (let attempt = 0; ; attempt++) {
      const snap = await repo.load()
      const plan = await planSync(snap, env)
      if (!plan.write) { applyMirror(env.storage, plan.mirror); await remember(show(snap, plan.report), snap); return plan.report }
      const res = await repo.write(plan.write)
      if (res.ok) {
        applyMirror(env.storage, plan.mirror)
        const after = await repo.load()
        await remember(show(after, plan.report), after)
        channel?.post({ type: 'changed' })
        return plan.report
      }
      // another tab got there first (stale or duplicate): read again and plan again. A real failure: show what we have.
      if (res.reason === 'failed' || attempt >= 2) { show(snap, plan.report); set({ saveProblem: res.detail }); return plan.report }
    }
  }
  /** Keep the choice of companion between visits. */
  async function remember(id: string | null, snap: Snapshot) {
    if (id && snap.meta.selectedId !== id) await repo.write({ meta: { selectedId: id } })
  }

  /** Write one companion (expect = the revision it replaces, or null for a brand-new one) and show it once it is safely stored. */
  async function commit(record: Companion, expect: number | null, more: { sources?: SourceRecord[]; events?: JourneyEvent[] } = {}): Promise<WriteResult> {
    const res = await repo.write({ companions: [{ record, expect }], ...more })
    if (res.ok) {
      for (const s of more.sources ?? []) sources.set(s.sourceKey, s)
      const known = state.companions.some(c => c.companionId === record.companionId)
      set({ companions: known ? state.companions.map(c => (c.companionId === record.companionId ? record : c)) : [record, ...state.companions], savedAt: env.now(), saveProblem: null })
      channel?.post({ type: 'changed' })
    } else if (res.reason === 'failed') set({ saveProblem: res.detail })
    else show(await repo.load(), null)          // someone else changed it: show the newer one
    return res
  }

  /** Has this Cozmling's v1 key been written by something other than this store since we last looked at it? */
  async function changedOutside(sourceKey: string, companionId: string): Promise<boolean> {
    const src = sources.get(sourceKey)
    if (!src || src.companionId !== companionId) return false
    let raw: string | null = null
    try { raw = env.storage?.getItem(sourceKey) ?? null } catch { return false }
    return raw != null && (await env.hash(raw)) !== src.lastSeenHash
  }

  /**
   * Change one companion. `change` gets the current record and returns the new one (or null to
   * leave it alone). One call = one all-or-nothing write. For a first-version Cozmling its v1 key
   * is then updated to match, so the old page and a roll-back always find the same Cozmling.
   */
  async function tryUpdate(companionId: string, change: (c: Companion, now: number) => Companion | null, opts: UpdateOptions): Promise<Change> {
    let c = byId(companionId)
    if (!c || c.archived) return { ok: false, reason: 'missing', detail: companionId }
    if (c.kind === 'legacy' && await changedOutside(c.legacy.sourceKey, companionId)) {
      // the first version's own code (the arcade Buddy, an old tab) has saved this Cozmling since we last looked:
      // take that in first, so this change is made to the newest copy and never written over it
      await syncNow()
      c = byId(companionId)
      if (!c || c.archived) return { ok: false, reason: 'missing', detail: companionId }
    }
    const now = env.now(), changed = change(c, now)
    if (!changed) return { ok: true, companion: c }
    const was = c
    let record: Companion = { ...changed, companionId: was.companionId, revision: was.revision + 1, updatedAt: now }
    // a birth sky is permanent: whatever a change says, the one already saved is kept
    if (was.celestial) record = { ...record, celestial: was.celestial }
    let text: string | null = null, src: SourceRecord | undefined
    if (record.kind === 'legacy') {
      record = { ...record, hatch: hatchOf(record.legacy.pet, was.hatch) }
      src = sources.get(record.legacy.sourceKey)
      if (src && src.companionId === companionId) text = v1Text(record.legacy.pet); else src = undefined
    }
    const stamp = (e: EventInput): JourneyEvent => ({ ...e, companionId, at: now })
    const note = opts.note && !notes.has(opts.note.eventId) ? opts.note : undefined
    const mirrored: SourceRecord[] = src && text != null ? [{ ...src, lastSeenHash: await env.hash(text) }] : []
    const write = (withNote: boolean) => commit(record, was.revision, {
      sources: mirrored,
      events: [...(opts.event ? [stamp(opts.event)] : []), ...(withNote && note ? [stamp(note)] : [])],
    })
    let res = await write(true)
    if (!res.ok && res.reason === 'duplicate' && note && res.detail === note.eventId) {       // another tab already kept that memory
      notes.add(note.eventId)
      if (byId(companionId)?.revision === was.revision) res = await write(false)
    }
    if (!res.ok) return res
    if (note) notes.add(note.eventId)
    if (src && text != null) applyMirror(env.storage, [{ key: src.sourceKey, raw: text }])
    return { ok: true, companion: record }
  }

  async function updateNow(companionId: string, change: (c: Companion, now: number) => Companion | null, opts: UpdateOptions): Promise<Change> {
    const res = await tryUpdate(companionId, change, opts)
    // another tab changed it first. Its newer copy is showing by now, so make the same change to that copy (once)
    return !res.ok && res.reason === 'stale' ? tryUpdate(companionId, change, opts) : res
  }
  const update = (companionId: string, change: (c: Companion, now: number) => Companion | null, opts: UpdateOptions = {}): Promise<Change> =>
    inTurn(() => updateNow(companionId, change, opts))
  const sync = (): Promise<SyncReport> => inTurn(syncNow)

  /** Change a first-version Cozmling with the v1 rules: `change` gets its state brought up to now. */
  const updateLegacy = (companionId: string, change: (pet: Pet, now: number) => Pet | null, event?: EventInput): Promise<Change> =>
    update(companionId, (c, now) => {
      if (c.kind !== 'legacy') return null
      const pet = change(settle(c.legacy.pet, now), now)
      return pet ? { ...c, legacy: { ...c.legacy, pet } } : null
    }, { event })

  /** A newly adopted adventurer joins the store and becomes the one that shows. */
  const adopt = (record: AdventurerCompanion): Promise<Change> => inTurn(() => adoptNow(record))
  async function adoptNow(record: AdventurerCompanion): Promise<Change> {
    const now = env.now()
    const res = await commit(record, null, { events: [{ eventId: `adopted:${record.companionId}`, companionId: record.companionId, type: 'adopted', at: now, data: { sign: record.starprint.coreSign } }] })
    if (!res.ok) return res
    await selectNow(record.companionId)
    // the first adoption is the moment to ask the browser to keep our storage. Play never waits on the answer
    if (persist && repo.durable) void persist.ask().then(ok => set({ persisted: ok }), () => {})
    return { ok: true, companion: record }
  }

  const select = (companionId: string): Promise<boolean> => inTurn(() => selectNow(companionId))
  async function selectNow(companionId: string): Promise<boolean> {
    const c = byId(companionId)
    if (!c || c.archived) return false
    const res = await repo.write({ meta: { selectedId: companionId } })
    set({ selectedId: companionId, ...(res.ok ? {} : { saveProblem: res.detail }) })
    if (res.ok) channel?.post({ type: 'changed' })
    return true
  }

  // another tab changed something: show it (in turn, so it can't land on top of a change this tab is in the middle of)
  channel?.listen(() => { inTurn(async () => { show(await repo.load(), null) }).catch(() => {}) })

  /** The first load: read, bring v1 saves in, show. */
  async function hydrate(): Promise<SyncReport> {
    const report = await sync()
    if (persist && repo.durable) void persist.granted().then(ok => set({ persisted: ok }), () => {})
    return report
  }

  return {
    getState: () => state,
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } },
    hydrate,
    sync,
    select,
    update,
    updateLegacy,
    adopt,
    /** What has happened to a companion, oldest first. */
    events: (companionId: string) => repo.events(companionId),
    /** Keep an event once (a day's story, say). The same eventId is never kept twice: if this tab or another
        has kept it already, nothing is written and `kept` is false. */
    keepEvent: (e: JourneyEvent) => inTurn(async (): Promise<{ ok: true; kept: boolean } | { ok: false; detail: string }> => {
      const res = await repo.write({ events: [e] })
      return res.ok ? { ok: true, kept: true } : res.reason === 'duplicate' ? { ok: true, kept: false } : { ok: false, detail: res.detail }
    }),
    /** For the pieces built on top of this (adoption, the arcade bridge, import). */
    commit,
    reload: () => inTurn(async () => { show(await repo.load(), null) }),
    /** Small things kept beside the companions that can always be worked out again (today's sky, say).
        Never exported, never part of a companion. */
    readMeta: async (key: string): Promise<unknown> => (await repo.load()).meta[key],
    writeMeta: (key: string, value: unknown) => inTurn(() => repo.write({ meta: { [key]: value } })),
    source: (key: string) => sources.get(key),
    repo,
  }
}
export type CozStore = ReturnType<typeof createStore>
