import type { AdventurerCompanion, JourneyEvent } from '../types'
import type { Repository, Write } from '../store/repository'
import { AccountRequestError, accountCompanions, accountWrite, type AccountCompanion, type AccountOperation, type AccountSnapshot } from './accountClient'

const OWNER_PREFIX = 'wallet-companion:'
const ownerKey = (id: string) => OWNER_PREFIX + id
type AccountRecord = AccountSnapshot['record']
/* What this device knows about a wallet-owned companion's last sync with the account. `base` is the
   account's record as of then: the common starting point when this device and the account have both
   moved on, so each change can be kept on the side that made it. */
type Tracked = { stamp: string; wallet: string; serverRevision: number; fingerprint: string; base?: AccountRecord; pending?: AccountOperation; conflict?: boolean }
type Draft = { stamp: string; snapshot: AccountSnapshot }
type Outcome = 'current' | 'changed' | 'retry' | 'conflict'
const walletAddress = /^[A-Z2-7]{58}$/

export function accountOwners(meta: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(meta).flatMap(([key, value]) => {
    if (!key.startsWith(OWNER_PREFIX) || !value || typeof value !== 'object'
      || !('wallet' in value) || typeof value.wallet !== 'string' || !walletAddress.test(value.wallet)) return []
    return [[key.slice(OWNER_PREFIX.length), value.wallet]]
  }))
}

function tracked(value: unknown): Tracked | null {
  if (!value || typeof value !== 'object' || !('stamp' in value) || typeof value.stamp !== 'string'
    || !('wallet' in value) || typeof value.wallet !== 'string'
    || !('serverRevision' in value) || typeof value.serverRevision !== 'number'
    || !('fingerprint' in value) || typeof value.fingerprint !== 'string') return null
  return value as Tracked
}

const cloudKinds = new Set<JourneyEvent['type']>(['adopted', 'hatched', 'care', 'customized', 'sky-read', 'story', 'choice-story', 'story-mode'])
const cloudEvent = (event: JourneyEvent) => cloudKinds.has(event.type)
  && (event.type !== 'story-mode' || event.data?.run === 'main')

function privateSnapshot(record: AdventurerCompanion, events: JourneyEvent[]): AccountSnapshot {
  const { schemaVersion, companionId, revision, createdAt, updatedAt, hatch, name, starprint, appearance, care, progress, celestial } = record
  return {
    record: { kind: 'adventurer', schemaVersion, companionId, revision, createdAt, updatedAt, hatch, name, starprint, appearance, care, progress, walletLinks: [], ...(celestial ? { celestial } : {}) },
    events: events.filter(cloudEvent).map(({ eventId, companionId, type, at, data }) => ({ eventId, companionId, type, at, ...(data ? { data } : {}) }))
      .sort((a, b) => a.at - b.at || a.eventId.localeCompare(b.eventId)),
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, data]) => data !== undefined)
    entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    return '{' + entries.map(([key, data]) => JSON.stringify(key) + ':' + canonical(data)).join(',') + '}'
  }
  return JSON.stringify(value ?? null)
}
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b)

async function fingerprint(snapshot: AccountSnapshot) {
  const clean = privateSnapshot(snapshot.record, snapshot.events)
  // An IndexedDB revision guards writes on this device. It is independent of the cloud save revision.
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical({ ...clean, record: { ...clean.record, revision: 0 } })))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

const STAGES = ['hatchling', 'adolescent', 'ascended'] as const
const stageRank = (stage: AccountRecord['progress']['visualStage']) => (stage ? STAGES.indexOf(stage) : -1)
type Birth = Pick<AccountRecord, 'hatch' | 'starprint' | 'celestial'>
const birthOf = (record: AccountRecord): Birth => ({ hatch: record.hatch, starprint: record.starprint, celestial: record.celestial })

/* Both this device and the account changed the same companion since they last agreed (`base`).
   The history keeps everything either side recorded, with the account's copy of anything both did
   (a day's first care, a hatch, a Story Mode promise kept: the same id, written on each device).
   Each part of the record comes from the side that changed it; where both did:
   - hatching can't be undone: the hatched side's birth (hatch, Starprint, chart), or the account's if both hatched;
   - care is a moment in time: the most recently settled;
   - progress only grows: the larger of each figure, and the further visual stage;
   - name and look: the account's, which was saved first. */
export function mergeSnapshots(base: AccountRecord | undefined, local: AccountSnapshot, remote: AccountSnapshot): AccountSnapshot {
  const theirs = new Set(remote.events.map(event => event.eventId))
  const events = [...remote.events, ...local.events.filter(event => !theirs.has(event.eventId))]
  const mine = local.record, account = remote.record
  const part = <T,>(of: (record: AccountRecord) => T, both: () => T): T => {
    const here = !base || !same(of(mine), of(base)), there = !base || !same(of(account), of(base))
    if (here && there && !same(of(mine), of(account))) return both()
    return here && !there ? of(mine) : of(account)
  }
  const birth = part(birthOf, () => (mine.hatch.status === 'hatched' && account.hatch.status !== 'hatched' ? birthOf(mine) : birthOf(account)))
  const care = part(r => r.care, () => (mine.care.settledAt > account.care.settledAt ? mine.care : account.care))
  const progress = part(r => r.progress, () => {
    const counters = { ...account.progress.counters }
    for (const [key, value] of Object.entries(mine.progress.counters)) counters[key] = Math.max(value, counters[key] ?? 0)
    const visualStage = stageRank(mine.progress.visualStage) > stageRank(account.progress.visualStage) ? mine.progress.visualStage : account.progress.visualStage
    return { ...account.progress, experience: Math.max(mine.progress.experience, account.progress.experience), counters, visualStage }
  })
  const appearance = part(r => r.appearance, () => account.appearance)
  const name = part(r => r.name, () => account.name)
  const { celestial: _drop, ...rest } = account
  const record: AccountRecord = {
    ...rest, hatch: birth.hatch, starprint: birth.starprint, ...(birth.celestial ? { celestial: birth.celestial } : {}),
    name, appearance, care, progress,
    revision: Math.max(mine.revision, account.revision) + 1,
    updatedAt: Math.max(mine.updatedAt, account.updatedAt),
  }
  return privateSnapshot(record, events)
}

async function readLocal(repo: Repository, id: string) {
  const saved = await repo.load()
  const found = saved.companions.find(item => item.companionId === id)
  const allEvents = await repo.events(id)
  const metadata = tracked(saved.meta[ownerKey(id)])
  return { found, allEvents, metadata, snapshot: found?.kind === 'adventurer' ? privateSnapshot(found, allEvents) : null }
}

type Local = Awaited<ReturnType<typeof readLocal>>
const keep = (wallet: string, serverRevision: number, hash: string, base: AccountRecord): Tracked => ({ stamp: crypto.randomUUID(), wallet, serverRevision, fingerprint: hash, base })
const metaGuard = (key: string, stamp: string | null) => ({ key, stamp })
const errorCode = (error: AccountRequestError) => {
  const payload = error.payload
  return payload && typeof payload === 'object' && 'error' in payload ? String(payload.error) : ''
}

async function setTracking(repo: Repository, id: string, previous: Tracked | null, next: Tracked, changes?: Omit<Write, 'meta' | 'check'>, ids?: string[]) {
  const key = ownerKey(id)
  const result = await repo.write({
    ...changes, meta: { [key]: next },
    check: { meta: metaGuard(key, previous?.stamp ?? null), ...(ids ? { events: { companionId: id, ids } } : {}) },
  })
  if (!result.ok && result.reason === 'failed') throw new Error('The account copy could not be recorded on this device.')
  return result.ok
}

async function conflict(repo: Repository, id: string, mark: Tracked) {
  if (!mark.conflict) await setTracking(repo, id, mark, { ...mark, stamp: crypto.randomUUID(), pending: undefined, conflict: true })
  return 'conflict' as const
}

/* Keep `target` (the account's copy, or a merge of it with this device's) here: its record, every event
   this device is missing, and the account's version of any event both recorded. Events only this device
   has stay. Afterwards the device is in step with `remote`: anything else here is a change still to send. */
async function applyHere(repo: Repository, wallet: string, remote: AccountCompanion, local: Local, target: AccountSnapshot, signal: AbortSignal): Promise<Outcome> {
  const account = privateSnapshot(remote.snapshot.record, remote.snapshot.events)
  const id = account.record.companionId
  const existing = new Map(local.allEvents.map(event => [event.eventId, event]))
  const add = target.events.filter(event => !existing.has(event.eventId))
  const replace = target.events.filter(event => existing.has(event.eventId) && !same(event, existing.get(event.eventId)))
  const record = { ...target.record, revision: Math.max(target.record.revision, (local.found?.revision ?? -1) + 1) }
  const hash = await fingerprint(account)
  signal.throwIfAborted()
  const good = await setTracking(repo, id, local.metadata, keep(wallet, remote.revision, hash, account.record), {
    companions: [{ record, expect: local.found?.revision ?? null }],
    events: add,
    ...(replace.length ? { replaceEvents: replace } : {}),
  }, local.allEvents.map(event => event.eventId))
  return good ? 'changed' : 'retry'
}

async function installRemote(repo: Repository, wallet: string, remote: AccountCompanion, local: Local, signal: AbortSignal): Promise<Outcome> {
  if (local.found && (!local.metadata || local.metadata.wallet !== wallet)) {
    // An imported file is not proof it belongs to this account. Never replace it automatically.
    return 'conflict'
  }
  return applyHere(repo, wallet, remote, local, privateSnapshot(remote.snapshot.record, remote.snapshot.events), signal)
}

async function stageSave(repo: Repository, wallet: string, local: Local, mark: Tracked, snapshot: AccountSnapshot, expectedRevision: number, signal: AbortSignal): Promise<Outcome> {
  const id = snapshot.record.companionId
  const pending: AccountOperation = { action: 'save', expectedRevision, opId: crypto.randomUUID(), snapshot }
  const staged = { ...mark, stamp: crypto.randomUUID(), pending }
  if (!await setTracking(repo, id, mark, staged)) return 'retry'
  return savePending(repo, wallet, { ...local, metadata: staged }, signal)
}

async function savePending(repo: Repository, wallet: string, local: Local, signal: AbortSignal): Promise<Outcome> {
  const mark = local.metadata
  if (!mark?.pending || !local.snapshot) return 'current'
  const operation = mark.pending
  const id = operation.snapshot.record.companionId
  let remote: AccountCompanion
  try {
    remote = await accountWrite(wallet, operation, signal)
  } catch (error) {
    if (error instanceof AccountRequestError && (error.status === 409 || error.status === 400)) {
      signal.throwIfAborted()
      // Another device saved first: drop this attempt and merge with its copy on the next pass, from the same starting point.
      if (errorCode(error) === 'stale_save') {
        await setTracking(repo, id, mark, { ...mark, stamp: crypto.randomUUID(), pending: undefined })
        return 'retry'
      }
      return conflict(repo, id, mark)
    }
    throw error
  }
  if (remote.snapshot.record.companionId !== id) throw new Error('The account returned an unexpected companion.')
  const sent = privateSnapshot(operation.snapshot.record, operation.snapshot.events)
  const account = privateSnapshot(remote.snapshot.record, remote.snapshot.events)
  const [sentHash, serverHash] = [await fingerprint(sent), await fingerprint(account)]
  signal.throwIfAborted()
  if (serverHash === sentHash) await setTracking(repo, id, mark, keep(wallet, remote.revision, serverHash, account.record))
  // Saved before (a lost reply), and the account has moved on since: count the save as the last point both
  // agreed on, so the next pass takes the account's copy, or merges with any change made here since.
  else await setTracking(repo, id, mark, keep(wallet, operation.expectedRevision + 1, sentHash, sent.record))
  return 'retry'
}

async function reconcile(repo: Repository, wallet: string, remote: AccountCompanion, signal: AbortSignal): Promise<Outcome> {
  const id = remote.snapshot.record.companionId
  const local = await readLocal(repo, id)
  const mark = local.metadata
  if (!local.found || !mark || mark.wallet !== wallet || !local.snapshot) return installRemote(repo, wallet, remote, local, signal)
  if (mark.conflict) return 'conflict'
  if (mark.pending) return savePending(repo, wallet, local, signal)
  const hash = await fingerprint(local.snapshot)
  signal.throwIfAborted()
  const account = privateSnapshot(remote.snapshot.record, remote.snapshot.events)
  // nothing changed here since the last sync: take the account's copy if it moved on
  if (hash === mark.fingerprint) return remote.revision === mark.serverRevision ? 'current' : applyHere(repo, wallet, remote, local, account, signal)
  // changed here only: send it
  if (remote.revision === mark.serverRevision) return stageSave(repo, wallet, local, mark, local.snapshot, mark.serverRevision, signal)
  // changed on both: merge, keep the result here, then send it
  const merged = mergeSnapshots(mark.base, local.snapshot, account)
  const applied = await applyHere(repo, wallet, remote, local, merged, signal)
  if (applied !== 'changed' || await fingerprint(merged) === await fingerprint(account)) return applied
  const fresh = await readLocal(repo, id)
  if (!fresh.metadata || !fresh.snapshot) return 'retry'
  return stageSave(repo, wallet, fresh, fresh.metadata, fresh.snapshot, remote.revision, signal)
}

/* The player chose the wallet account's copy for a companion this device couldn't sync on its own (a copy
   imported from a file, or a save the account refused). The account's record replaces this device's; the
   history keeps every event either side has, and any events only this device had are sent to the account. */
export async function resolveWithAccount(repo: Repository, wallet: string, companionId: string, signal: AbortSignal) {
  const remote = (await accountCompanions(wallet, signal)).find(item => item.snapshot.record.companionId === companionId)
  if (!remote) throw new Error('The wallet account doesn’t have this Cozmling.')
  const local = await readLocal(repo, companionId)
  if (local.found && !local.snapshot) throw new Error('A different kind of Cozmling here has the same id. It hasn’t been changed.')
  const account = privateSnapshot(remote.snapshot.record, remote.snapshot.events)
  // measured from this device's own record, the account's record wins every part; the histories are joined
  const target = local.snapshot ? mergeSnapshots(local.snapshot.record, local.snapshot, account) : account
  const applied = await applyHere(repo, wallet, remote, local, target, signal)
  if (applied !== 'changed') throw new Error('This device changed while choosing. Try again.')
  if (await fingerprint(target) === await fingerprint(account)) return
  const fresh = await readLocal(repo, companionId)
  if (fresh.metadata && fresh.snapshot) await stageSave(repo, wallet, fresh, fresh.metadata, fresh.snapshot, remote.revision, signal)
}

/* The server hatches a wallet-backed egg (its clock, its chart, once), and this device takes the account's copy.
   Anything this device changed meanwhile is merged as usual; the hatch and the chart are always the server's. */
export async function hatchWithWallet(repo: Repository, wallet: string, companionId: string, timeZone: string, signal: AbortSignal) {
  const remote = await accountWrite(wallet, { action: 'hatch', companionId, timeZone }, signal)
  signal.throwIfAborted()
  await reconcile(repo, wallet, remote, signal)
  return remote
}

const draftKey = (wallet: string, kind: 'ordinary' | 'event') => `wallet-adoption:${wallet}:${kind}`
function readDraft(value: unknown): Draft | null {
  return value && typeof value === 'object' && 'stamp' in value && typeof value.stamp === 'string'
    && 'snapshot' in value && value.snapshot && typeof value.snapshot === 'object' ? value as Draft : null
}

async function finishDraft(repo: Repository, wallet: string, key: string, draft: Draft, signal: AbortSignal) {
  const remote = await accountWrite(wallet, { action: 'adopt', snapshot: draft.snapshot }, signal)
  const id = remote.snapshot.record.companionId
  if (draft.snapshot.record.companionId.startsWith('hatch-') && id !== draft.snapshot.record.companionId) throw new Error('The account returned an unexpected mystery egg.')
  const idb = await readLocal(repo, id)
  const result = idb.metadata?.wallet === wallet && idb.found ? 'current' : await installRemote(repo, wallet, remote, idb, signal)
  if (result === 'retry') throw new Error('The account kept your adoption. Open the account again to finish restoring it.')
  signal.throwIfAborted()
  const removed = await repo.write({ check: { meta: metaGuard(key, draft.stamp) }, meta: { [key]: null } })
  if (!removed.ok && removed.reason === 'failed') throw new Error('The account kept your adoption, but the browser could not finish opening it.')
  return { record: remote.snapshot.record, conflict: result === 'conflict' }
}

export async function adoptWithWallet(repo: Repository, wallet: string, record: AdventurerCompanion, signal: AbortSignal) {
  const key = draftKey(wallet, record.companionId.startsWith('hatch-') ? 'event' : 'ordinary')
  const accept = async (draft: Draft) => {
    const result = await finishDraft(repo, wallet, key, draft, signal)
    if (result.conflict) throw new Error('The account kept your adoption. A device copy needs review before opening it.')
    return result.record
  }
  for (let i = 0; i < 3; i++) {
    signal.throwIfAborted()
    const previous = readDraft((await repo.load()).meta[key])
    if (previous) return accept(previous)
    const event: JourneyEvent = {
      companionId: record.companionId, eventId: `adopted:${record.companionId}`, type: 'adopted', at: record.createdAt,
      data: { sign: record.starprint.coreSign, ...(record.companionId.startsWith('hatch-') ? { source: 'community-hatch' } : {}) },
    }
    const draft = { stamp: crypto.randomUUID(), snapshot: privateSnapshot(record, [event]) }
    signal.throwIfAborted()
    const staged = await repo.write({ check: { meta: metaGuard(key, null) }, meta: { [key]: draft } })
    if (staged.ok) return accept(draft)
    if (staged.reason === 'failed') break
  }
  throw new Error('This device could not stage the adoption. Try again.')
}

export async function syncWalletAccount(repo: Repository, wallet: string, signal: AbortSignal) {
  let changed = false
  let hasConflict = false
  let retry = false
  const conflicts: string[] = []
  const device = await repo.load()
  for (const kind of ['ordinary', 'event'] as const) {
    const key = draftKey(wallet, kind)
    const draft = readDraft(device.meta[key])
    if (draft) {
      const finished = await finishDraft(repo, wallet, key, draft, signal)
      hasConflict ||= finished.conflict
      changed ||= !finished.conflict
    }
  }
  const list = await accountCompanions(wallet, signal)
  for (const remote of list) {
    signal.throwIfAborted()
    const outcome = await reconcile(repo, wallet, remote, signal)
    changed ||= outcome === 'changed'
    hasConflict ||= outcome === 'conflict'
    retry ||= outcome === 'retry'
    if (outcome === 'conflict') conflicts.push(remote.snapshot.record.companionId)
  }
  return { changed, hasConflict, retry, conflicts }
}
