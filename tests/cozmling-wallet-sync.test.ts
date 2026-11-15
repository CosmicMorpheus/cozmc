import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newAdventurer } from '../src/cozmling/domain/adventurer'
import { memoryRepository } from '../src/cozmling/store/memoryRepository'
import { accountOwners, adoptWithWallet, mergeSnapshots, resolveWithAccount, syncWalletAccount } from '../src/cozmling/account/localAccount'
import type { AccountCompanion, AccountOperation, AccountSnapshot } from '../src/cozmling/account/accountClient'
import type { JourneyEvent } from '../src/cozmling/types'

const wallet = 'A'.repeat(58)
const id = '49b4cf3c-c457-4437-abf2-31c6ce9d302c'
const at = Date.UTC(2026, 10, 14)
const starter = () => newAdventurer({ name: 'Orbi', birthday: '2026-11-05', look: 'a', skin: 'teal' }, { companionId: id, now: at })
const signal = new AbortController().signal

function accountServer() {
  let companion: AccountCompanion | undefined
  let lostAdopt = false
  let lostSave = false
  let beforeNextSave: (() => void) | null = null
  const seenAdoptions: string[] = []
  const seenSaves: string[] = []
  const applied = new Set<string>()
  const json = (value: unknown, status = 200) => Response.json(value, { status })
  return {
    get current() { return companion! },
    seenAdoptions, seenSaves,
    async fetch(_url: unknown, init: RequestInit) {
      assert.equal(new Headers(init.headers).get('X-COZMC-Wallet'), wallet)
      if (init.method === 'GET') return json({ companions: companion ? [companion] : [] })
      const body = JSON.parse(String(init.body)) as AccountOperation | { action: 'adopt'; snapshot: AccountSnapshot }
      if (body.action === 'adopt') {
        seenAdoptions.push(body.snapshot.record.companionId)
        companion ??= { revision: 0, snapshot: body.snapshot }
        if (lostAdopt) { lostAdopt = false; throw new TypeError('Connection lost after adoption') }
      } else {
        assert.ok(companion)
        if (beforeNextSave) { const run = beforeNextSave; beforeNextSave = null; run() }
        seenSaves.push(body.opId)
        if (applied.has(body.opId)) return json({ companion })
        if (body.expectedRevision !== companion.revision) return json({ error: 'stale_save', companion }, 409)
        companion = { revision: companion.revision + 1, snapshot: body.snapshot }
        applied.add(body.opId)
        if (lostSave) { lostSave = false; throw new TypeError('Connection lost after save') }
      }
      return json({ companion })
    },
    loseNextAdoption() { lostAdopt = true },
    /** Another device saves first: `edit` is applied to the account's copy as a new revision. */
    editRemote(edit: (snapshot: AccountSnapshot) => AccountSnapshot) {
      assert.ok(companion)
      companion = { revision: companion.revision + 1, snapshot: edit(structuredClone(companion.snapshot)) }
    },
    /** ...between this device reading the account and sending its save. */
    editRemoteBeforeNextSave(edit: (snapshot: AccountSnapshot) => AccountSnapshot) { beforeNextSave = () => this.editRemote(edit) },
    loseNextSave() { lostSave = true },
    setRemoteFood(food: number) {
      assert.ok(companion)
      companion = {
        revision: companion.revision + 1,
        snapshot: { ...companion.snapshot, record: { ...companion.snapshot.record, care: { ...companion.snapshot.record.care, food } } },
      }
    },
  }
}

test('a lost adoption response recovers the same account companion from the device draft', async t => {
  const server = accountServer()
  t.mock.method(globalThis, 'fetch', server.fetch)
  const repo = memoryRepository()
  server.loseNextAdoption()
  await assert.rejects(adoptWithWallet(repo, wallet, starter(), signal), /Connection lost/)
  assert.equal((await repo.load()).companions.length, 0)
  await syncWalletAccount(repo, wallet, signal)
  const device = await repo.load()
  assert.deepEqual(server.seenAdoptions, [id, id])
  assert.equal(device.companions.length, 1)
  assert.equal(accountOwners(device.meta)[id], wallet)
})

test('care and real Story Mode events restore to a fresh device after saving', async t => {
  const server = accountServer()
  t.mock.method(globalThis, 'fetch', server.fetch)
  const repo = memoryRepository()
  await adoptWithWallet(repo, wallet, starter(), signal)
  const egg = starter()
  const record = { ...egg, revision: 1, care: { ...egg.care, food: 95 } }
  const main: JourneyEvent = { type: 'story-mode', eventId: 'main-scene', companionId: id, at, data: { run: 'main', choiceId: 'help' } }
  const preview: JourneyEvent = { ...main, eventId: 'test-scene', data: { run: 'test-1' } }
  await repo.write({ companions: [{ record, expect: 0 }], events: [main, preview] })
  await syncWalletAccount(repo, wallet, signal)
  const second = memoryRepository()
  await syncWalletAccount(second, wallet, signal)
  assert.equal(server.current.revision, 1)
  assert.deepEqual((await second.load()).companions[0], record)
  assert.deepEqual((await second.events(id)).filter(event => event.type === 'story-mode'), [main])
})

test('a lost save response retries the same operation and keeps later local changes', async t => {
  const server = accountServer()
  t.mock.method(globalThis, 'fetch', server.fetch)
  const repo = memoryRepository()
  const original = starter()
  await adoptWithWallet(repo, wallet, original, signal)
  const meal = { ...original, revision: 1, care: { ...original.care, food: 86 } }
  await repo.write({ companions: [{ record: meal, expect: 0 }] })
  server.loseNextSave()
  await assert.rejects(syncWalletAccount(repo, wallet, signal), /Connection lost/)
  const play = { ...meal, revision: 2, care: { ...meal.care, fun: 91 } }
  await repo.write({ companions: [{ record: play, expect: 1 }] })
  await syncWalletAccount(repo, wallet, signal)
  await syncWalletAccount(repo, wallet, signal)
  assert.equal(server.seenSaves[0], server.seenSaves[1])
  assert.notEqual(server.seenSaves[1], server.seenSaves[2])
  assert.equal(server.current.revision, 2)
  assert.deepEqual(server.current.snapshot.record.care, play.care)
})

const day = (n: number) => at + n * 86_400_000
const careNote = (when: number, food: number): JourneyEvent => ({ eventId: `care:${id}:2026-11-15`, companionId: id, type: 'care', at: when, data: { food } })

test('both devices played: each change is kept where it was made, and the account’s copy of anything both recorded wins', async t => {
  const server = accountServer()
  t.mock.method(globalThis, 'fetch', server.fetch)
  const repo = memoryRepository()
  const original = starter()
  await adoptWithWallet(repo, wallet, original, signal)
  // this device: fed it, and recorded the day's first care at its own time
  const fed = { ...original, revision: 1, updatedAt: day(1), care: { ...original.care, food: 91, settledAt: day(1) } }
  await repo.write({ companions: [{ record: fed, expect: 0 }], events: [careNote(day(1), 91)] })
  // the other device, saved first: the same day's care note at its own time, a story, and some progress
  const story: JourneyEvent = { eventId: `story:${id}:2026-11-15`, companionId: id, type: 'story', at: day(1) + 5, data: { kind: 'play' } }
  server.editRemote(snapshot => ({
    record: { ...snapshot.record, updatedAt: day(1) + 9, progress: { ...snapshot.record.progress, experience: 7 } },
    events: [...snapshot.events, careNote(day(1) + 3, 80), story],
  }))
  const result = await syncWalletAccount(repo, wallet, signal)
  assert.deepEqual([result.hasConflict, result.conflicts], [false, []])
  const here = (await repo.load()).companions[0] as typeof original
  assert.equal(here.care.food, 91, 'care changed only here: kept')
  assert.equal(here.progress.experience, 7, 'progress changed only there: taken')
  const events = await repo.events(id)
  assert.deepEqual(events.find(e => e.type === 'care'), careNote(day(1) + 3, 80), 'the account’s copy of the shared care note')
  assert.ok(events.some(e => e.eventId === story.eventId), 'the other device’s story arrived')
  // and the merge went back to the account in one save, built on the account’s revision
  assert.equal(server.seenSaves.length, 1)
  assert.deepEqual([server.current.snapshot.record.care.food, server.current.snapshot.record.progress.experience], [91, 7])
  assert.deepEqual(server.current.snapshot.events.map(e => e.eventId).sort(), [`adopted:${id}`, careNote(0, 0).eventId, story.eventId].sort())
  // a second device opening the account now gets exactly that
  const second = memoryRepository()
  await syncWalletAccount(second, wallet, signal)
  assert.deepEqual([(await second.load()).companions[0]].map(c => (c as typeof original).care.food), [91])
  assert.equal((await syncWalletAccount(repo, wallet, signal)).changed, false, 'and then it is settled')
})

test('both devices changed care: the most recently settled care wins, progress keeps the larger figures, a hatch is never undone', () => {
  const base = starter()
  const snap = (record: typeof base): AccountSnapshot => ({ record, events: [] })
  const here = { ...base, care: { ...base.care, food: 40, settledAt: day(2) }, progress: { ...base.progress, experience: 3, counters: { pats: 5 } } }
  const there = {
    ...base, hatch: { status: 'hatched' as const, hatchedAt: day(1), provenance: 'known' as const },
    care: { ...base.care, food: 70, settledAt: day(1) }, progress: { ...base.progress, experience: 9, counters: { pats: 2, feeds: 4 } },
  }
  const merged = mergeSnapshots(base, snap(here), snap(there)).record
  assert.deepEqual([merged.care.food, merged.care.settledAt], [40, day(2)], 'this device settled care later')
  assert.deepEqual([merged.progress.experience, merged.progress.counters], [9, { pats: 5, feeds: 4 }])
  assert.equal(merged.hatch.status, 'hatched', 'hatched on the other device: it stays hatched')
  const hatchedHere = mergeSnapshots(base, snap({ ...here, hatch: there.hatch }), snap({ ...there, hatch: base.hatch })).record
  assert.equal(hatchedHere.hatch.status, 'hatched', 'and the other way round')
  assert.ok(merged.revision > Math.max(here.revision, there.revision))
})

test('a save that lost the race to another device merges on the next pass instead of stopping', async t => {
  const server = accountServer()
  t.mock.method(globalThis, 'fetch', server.fetch)
  const repo = memoryRepository()
  const original = starter()
  await adoptWithWallet(repo, wallet, original, signal)
  const played = { ...original, revision: 1, updatedAt: day(1), care: { ...original.care, fun: 95, settledAt: day(1) } }
  await repo.write({ companions: [{ record: played, expect: 0 }] })
  server.editRemoteBeforeNextSave(snapshot => ({ ...snapshot, record: { ...snapshot.record, name: 'Nova', updatedAt: day(1) + 1 } }))
  const first = await syncWalletAccount(repo, wallet, signal)
  assert.deepEqual([first.hasConflict, first.retry], [false, true], 'refused as stale: try again, no conflict')
  await syncWalletAccount(repo, wallet, signal)
  assert.deepEqual([server.current.snapshot.record.name, server.current.snapshot.record.care.fun], ['Nova', 95])
  assert.equal(((await repo.load()).companions[0] as typeof original).name, 'Nova')
})

test('a copy imported from a file is never replaced on its own; the player can choose the account’s copy, keeping what only this device had', async t => {
  const server = accountServer()
  t.mock.method(globalThis, 'fetch', server.fetch)
  const first = memoryRepository()
  await adoptWithWallet(first, wallet, starter(), signal)
  // another browser holds an untracked copy of the same Cozmling (from a save file), with an event the account never saw
  const other = memoryRepository()
  const imported = { ...starter(), revision: 3, name: 'Copy' }
  const onlyHere: JourneyEvent = { eventId: `sky:${id}:2026-11-14`, companionId: id, type: 'sky-read', at: day(0) + 7 }
  await other.write({ companions: [{ record: imported, expect: null }], events: [onlyHere] })
  const seen = await syncWalletAccount(other, wallet, signal)
  assert.deepEqual([seen.hasConflict, seen.conflicts], [true, [id]])
  assert.equal(((await other.load()).companions[0] as typeof imported).name, 'Copy', 'nothing replaced')
  assert.equal(accountOwners((await other.load()).meta)[id], undefined)
  await resolveWithAccount(other, wallet, id, signal)
  const now = await other.load()
  assert.equal((now.companions[0] as typeof imported).name, 'Orbi', 'the account’s record')
  assert.equal(accountOwners(now.meta)[id], wallet, 'now kept for this wallet')
  assert.ok(server.current.snapshot.events.some(e => e.eventId === onlyHere.eventId), 'the event only this device had went to the account')
  assert.deepEqual((await syncWalletAccount(other, wallet, signal)).conflicts, [])
})
