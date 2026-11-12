/* The one shared store behind the Cozmling page, the Home Spotlight and the Arcade Buddy.
   It reads the repository once, brings first-version saves in (migrations.ts), and after that
   every change goes: work out the new record → one all-or-nothing write → only then update what
   the page shows and say "saved". A refused or failed write never looks like a save. */
import { settle, type Pet } from '../../companion/care'
import type { Companion, JourneyEvent, LegacyCompanion, Snapshot, SourceRecord } from '../types'
import { hatchOf, V1_KEY, v1Text } from '../integrations/legacyAdapter'
import { applyMirror, planSync, type Env, type SyncReport } from './migrations'
import type { Repository, WriteResult } from './repository'
import { INITIAL, type CozState } from './state'
import { companionProblem } from './validators'

export { INITIAL, type CozState } from './state'

export interface Channel { post(msg: unknown): void; listen(cb: (msg: unknown) => void): void }
export type Change = { ok: true; companion: Companion } | { ok: false; reason: 'stale' | 'duplicate' | 'failed' | 'missing'; detail: string }

export function createStore(repo: Repository, env: Env, channel?: Channel) {
  let state: CozState = { ...INITIAL, durable: repo.durable }
  let sources = new Map<string, SourceRecord>()
  const subs = new Set<() => void>()
  const set = (next: Partial<CozState>) => { state = { ...state, ...next }; subs.forEach(f => f()) }
  const byId = (id: string | null) => state.companions.find(c => c.companionId === id)
  const active = (list: Companion[]) => list.filter(c => !c.archived)
  const isGuest = (c: Companion) => c.kind === 'legacy' && c.legacy.sourceKey === V1_KEY
  const touched = (c: Companion) => (c.kind === 'legacy' ? c.legacy.pet.at : c.updatedAt)

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
  async function sync(): Promise<SyncReport> {
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

  /**
   * Change a first-version Cozmling with the v1 rules. `change` gets its state brought up to now
   * and returns the new state (or null to leave it alone). One call = one write, and the v1 key
   * is then updated to match, so the old page and a roll-back always find the same Cozmling.
   */
  async function updateLegacy(companionId: string, change: (pet: Pet, now: number) => Pet | null, event?: Omit<JourneyEvent, 'companionId' | 'at'>): Promise<Change> {
    const c = byId(companionId)
    if (!c || c.kind !== 'legacy' || c.archived) return { ok: false, reason: 'missing', detail: companionId }
    const now = env.now(), pet = change(settle(c.legacy.pet, now), now)
    if (!pet) return { ok: true, companion: c }
    const record: LegacyCompanion = { ...c, revision: c.revision + 1, updatedAt: now, hatch: hatchOf(pet, c.hatch), legacy: { ...c.legacy, pet } }
    const text = v1Text(pet), src = sources.get(c.legacy.sourceKey)
    const res = await commit(record, c.revision, {
      sources: src && src.companionId === companionId ? [{ ...src, lastSeenHash: await env.hash(text) }] : [],
      events: event ? [{ ...event, companionId, at: now }] : [],
    })
    if (!res.ok) return res
    if (src && src.companionId === companionId) applyMirror(env.storage, [{ key: c.legacy.sourceKey, raw: text }])
    return { ok: true, companion: record }
  }

  async function select(companionId: string): Promise<boolean> {
    const c = byId(companionId)
    if (!c || c.archived) return false
    const res = await repo.write({ meta: { selectedId: companionId } })
    set({ selectedId: companionId, ...(res.ok ? {} : { saveProblem: res.detail }) })
    if (res.ok) channel?.post({ type: 'changed' })
    return true
  }

  // another tab changed something: show it
  channel?.listen(() => { repo.load().then(snap => show(snap, null), () => {}) })

  return {
    getState: () => state,
    subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f) } },
    /** The first load: read, bring v1 saves in, show. */
    hydrate: sync,
    sync,
    select,
    updateLegacy,
    /** For the pieces built on top of this (adoption, the arcade bridge, import). */
    commit,
    reload: async () => { show(await repo.load(), null) },
    source: (key: string) => sources.get(key),
    repo,
  }
}
export type CozStore = ReturnType<typeof createStore>
