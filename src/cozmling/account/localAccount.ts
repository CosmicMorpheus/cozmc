import type { AdventurerCompanion, JourneyEvent } from '../types'
import type { Repository, Write } from '../store/repository'
import { AccountRequestError, accountCompanions, accountWrite, type AccountCompanion, type AccountOperation, type AccountSnapshot } from './accountClient'

const OWNER_PREFIX = 'wallet-companion:'
const ownerKey = (id: string) => OWNER_PREFIX + id
type Tracked = { stamp: string; wallet: string; serverRevision: number; fingerprint: string; pending?: AccountOperation; conflict?: boolean }
type Draft = { stamp: string; snapshot: AccountSnapshot }
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

async function fingerprint(snapshot: AccountSnapshot) {
  const clean = privateSnapshot(snapshot.record, snapshot.events)
  // An IndexedDB revision guards writes on this device. It is independent of the cloud save revision.
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical({ ...clean, record: { ...clean.record, revision: 0 } })))
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')
}

async function readLocal(repo: Repository, id: string) {
  const saved = await repo.load()
  const found = saved.companions.find(item => item.companionId === id)
  const allEvents = await repo.events(id)
  const metadata = tracked(saved.meta[ownerKey(id)])
  return { found, allEvents, metadata, snapshot: found?.kind === 'adventurer' ? privateSnapshot(found, allEvents) : null }
}

type Local = Awaited<ReturnType<typeof readLocal>>
const keep = (wallet: string, serverRevision: number, hash: string): Tracked => ({ stamp: crypto.randomUUID(), wallet, serverRevision, fingerprint: hash })
const metaGuard = (key: string, stamp: string | null) => ({ key, stamp })

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

async function installRemote(repo: Repository, wallet: string, remote: AccountCompanion, local: Local, signal: AbortSignal) {
  const { record, events } = privateSnapshot(remote.snapshot.record, remote.snapshot.events)
  const id = record.companionId
  if (local.found && (!local.metadata || local.metadata.wallet !== wallet)) {
    // An imported file is not proof it belongs to this account. Never replace it automatically.
    return 'conflict' as const
  }
  const existing = new Map(local.allEvents.map(event => [event.eventId, event]))
  const incoming = new Map(events.map(event => [event.eventId, event]))
  const diverges = events.some(event => existing.has(event.eventId) && canonical(event) !== canonical(existing.get(event.eventId)))
    || (local.snapshot?.events ?? []).some(event => !incoming.has(event.eventId))
  if (diverges) return local.metadata ? conflict(repo, id, local.metadata) : 'conflict' as const
  const hash = await fingerprint({ record, events })
  signal.throwIfAborted()
  const replacement = local.found ? { ...record, revision: Math.max(record.revision, local.found.revision + 1) } : record
  const good = await setTracking(repo, id, local.metadata, keep(wallet, remote.revision, hash), {
    companions: [{ record: replacement, expect: local.found?.revision ?? null }],
    events: events.filter(event => !existing.has(event.eventId)),
  }, local.allEvents.map(event => event.eventId))
  return good ? 'changed' as const : 'retry' as const
}

async function savePending(repo: Repository, wallet: string, local: Local, signal: AbortSignal) {
  const mark = local.metadata
  if (!mark?.pending || !local.snapshot) return 'current' as const
  const operation = mark.pending
  const id = operation.snapshot.record.companionId
  let remote: AccountCompanion
  try {
    remote = await accountWrite(wallet, operation, signal)
  } catch (error) {
    if (error instanceof AccountRequestError && error.status === 409) {
      signal.throwIfAborted()
      return conflict(repo, id, mark)
    }
    throw error
  }
  const sentHash = await fingerprint(operation.snapshot)
  const serverHash = await fingerprint(remote.snapshot)
  signal.throwIfAborted()
  if (remote.snapshot.record.companionId !== id) throw new Error('The account returned an unexpected companion.')
  if (serverHash !== sentHash) {
    const fresh = await readLocal(repo, id)
    if (fresh.metadata?.stamp !== mark.stamp || !fresh.snapshot) return 'retry' as const
    if (await fingerprint(fresh.snapshot) === sentHash) return installRemote(repo, wallet, remote, fresh, signal)
    return conflict(repo, id, mark)
  }
  await setTracking(repo, id, mark, keep(wallet, remote.revision, serverHash))
  return 'retry' as const
}

async function reconcile(repo: Repository, wallet: string, remote: AccountCompanion, signal: AbortSignal) {
  const id = remote.snapshot.record.companionId
  const local = await readLocal(repo, id)
  const mark = local.metadata
  if (!local.found || !mark || mark.wallet !== wallet || !local.snapshot) return installRemote(repo, wallet, remote, local, signal)
  if (mark.conflict) return 'conflict' as const
  if (mark.pending) return savePending(repo, wallet, local, signal)
  const hash = await fingerprint(local.snapshot)
  signal.throwIfAborted()
  if (hash === mark.fingerprint) {
    return remote.revision === mark.serverRevision ? 'current' as const : installRemote(repo, wallet, remote, local, signal)
  }
  if (remote.revision !== mark.serverRevision) {
    if (hash === await fingerprint(remote.snapshot)) {
      signal.throwIfAborted()
      return await setTracking(repo, id, mark, keep(wallet, remote.revision, hash)) ? 'changed' as const : 'retry' as const
    }
    signal.throwIfAborted()
    return conflict(repo, id, mark)
  }
  const pending: AccountOperation = { action: 'save', expectedRevision: mark.serverRevision, opId: crypto.randomUUID(), snapshot: local.snapshot }
  const staged = { ...mark, stamp: crypto.randomUUID(), pending }
  if (!await setTracking(repo, id, mark, staged)) return 'retry' as const
  return savePending(repo, wallet, { ...local, metadata: staged }, signal)
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
  }
  return { changed, hasConflict, retry }
}
