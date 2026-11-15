import assert from 'node:assert/strict'
import { test } from 'node:test'
import { newAdventurer } from '../src/cozmling/domain/adventurer'
import { memoryRepository } from '../src/cozmling/store/memoryRepository'
import { accountOwners, adoptWithWallet, syncWalletAccount } from '../src/cozmling/account/localAccount'
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

test('competing cloud and device saves keep each copy for review', async t => {
  const server = accountServer()
  t.mock.method(globalThis, 'fetch', server.fetch)
  const repo = memoryRepository()
  const original = starter()
  await adoptWithWallet(repo, wallet, original, signal)
  const locallyFed = { ...original, revision: 1, care: { ...original.care, food: 91 } }
  await repo.write({ companions: [{ record: locallyFed, expect: 0 }] })
  server.setRemoteFood(66)
  assert.equal((await syncWalletAccount(repo, wallet, signal)).hasConflict, true)
  assert.deepEqual((await repo.load()).companions[0], locallyFed)
  assert.equal(server.current.snapshot.record.care.food, 66)
  assert.deepEqual(server.seenSaves, [])
})
