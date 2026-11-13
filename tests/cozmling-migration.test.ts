/* Cozmling v2: bringing first-version saves in, and keeping them safe. `npm test`.
   Built on tests/fixtures (real-shape v1 saves made by the v1 code, known defects included).
   localStorage is a small stand-in shared with the real v1 code, which plays "the old page". */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

class FakeStorage {
  m = new Map<string, string>()
  off = false                                    // a browser that refuses to store anything
  private check() { if (this.off) throw new Error('storage is off') }
  get length() { this.check(); return this.m.size }
  key(i: number) { this.check(); return [...this.m.keys()][i] ?? null }
  getItem(k: string) { this.check(); return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.check(); this.m.set(k, String(v)) }
  removeItem(k: string) { this.check(); this.m.delete(k) }
}
const storage = new FakeStorage()
;(globalThis as any).localStorage = storage

const care = await import('../src/companion/care')
const { memoryRepository } = await import('../src/cozmling/store/memoryRepository')
const { createStore } = await import('../src/cozmling/store/companionStore')
const { checksum } = await import('../src/cozmling/store/util')
const { readV1, readNote, companionProblem } = await import('../src/cozmling/store/validators')
const { legacyStage, legacyGrowth, V1_KEY, v1Text } = await import('../src/cozmling/integrations/legacyAdapter')
const { exportAll, planImport, applyImport } = await import('../src/cozmling/store/exportImport')
import type { Repository, Write } from '../src/cozmling/store/repository'
import type { LegacyCompanion } from '../src/cozmling/types'

interface Fx { id: string; storageKey: string; raw: string; expect: any }
const local: { clockMs: number; fixtures: Fx[] } = JSON.parse(readFileSync(new URL('./fixtures/legacy-local-v1.json', import.meta.url), 'utf8'))
const notes: { notes: { id: string; sender: string; confirmedRound: number; noteJson: any; expect: any }[] } = JSON.parse(readFileSync(new URL('./fixtures/legacy-chain-notes-v1.json', import.meta.url), 'utf8'))
const fx = (id: string) => local.fixtures.find(f => f.id === id)!
const GOOD = ['guest-egg', 'wallet-sprout', 'wallet-cadet', 'wallet-explorer', 'wallet-guardian', 'wallet-asleep-low', 'wallet-pre-alien-look']
const BAD = ['wallet-malformed-missing-fields', 'wallet-bad-json']
const ownerOf = (key: string) => key.split(':')[1] as string | undefined

let clock = local.clockMs, ids = 0
const env = () => ({ storage, now: () => clock, newId: () => `test-${String(++ids).padStart(6, '0')}`, hash: checksum })
const put = (...which: string[]) => { for (const id of which) storage.setItem(fx(id).storageKey, fx(id).raw) }
/** A fresh page load over the same saved data. */
const page = async (repo: Repository) => { const s = createStore(repo, env()); await s.hydrate(); return s }
const legacy = (s: Awaited<ReturnType<typeof page>>, key: string) => s.getState().companions.find(c => c.kind === 'legacy' && c.legacy.sourceKey === key && !c.archived) as LegacyCompanion | undefined
const counters = (p: any) => ({ fed: p.fed, played: p.played, pets: p.pets, arcade: p.arcade ?? 0, cheered: p.cheered ?? 0, checkins: p.checkins ?? 0 })

beforeEach(() => { storage.m.clear(); storage.off = false; clock = local.clockMs; ids = 0 })

/* ---------------- the reader agrees with the first version ---------------- */

test('a good v1 save is read exactly as the first version reads it', () => {
  for (const id of GOOD) {
    const f = fx(id); put(id)
    const theirs = ownerOf(f.storageKey) ? care.load(ownerOf(f.storageKey)!) : care.loadGuest()
    const mine = readV1(f.raw)
    assert.ok(mine.ok, id)
    assert.deepEqual(mine.pet, theirs, id)
    assert.equal(care.stageOf(mine.pet), f.expect.stage, id)
    assert.equal(care.growthPoints(mine.pet), f.expect.growthPoints, id)
    assert.deepEqual(counters(mine.pet), f.expect.counters, id)
  }
})

test('the v1 key in this file is the one the first version writes', () => {
  care.saveGuest(care.adopt('Zib', { form: 'boy', body: 0, glow: 0, eyes: 0 }, 'loft', clock))
  care.save('SOMEWALLET', care.adopt('Nova', { form: 'girl', body: 2, glow: 1, eyes: 1 }, 'loft', clock))
  assert.deepEqual([...storage.m.keys()].sort(), [V1_KEY, `${V1_KEY}:SOMEWALLET`])
})

test('incomplete and broken saves are refused (the first version lets the incomplete one through)', () => {
  assert.equal(fx('wallet-malformed-missing-fields').expect.parses, true)        // the known v1 defect
  const a = readV1(fx('wallet-malformed-missing-fields').raw), b = readV1(fx('wallet-bad-json').raw)
  assert.ok(!a.ok && /missing or invalid: home, born/.test(a.reason))
  assert.ok(!b.ok && /broken JSON/.test(b.reason))
  for (const [raw, why] of [
    ['{"v":2}', /version 1/], ['null', /not a saved/], ['[]', /not a saved/], ['{"v":1}', /look/],
    [fx('wallet-sprout').raw.replace('"body":2', '"body":63'), /colour/], [fx('wallet-sprout').raw.replace('"food":70', '"food":"lots"'), /food/],
    [fx('wallet-sprout').raw.replace('"fed":5', '"fed":-1'), /fed/], [fx('wallet-sprout').raw.replace('"home":"loft"', '"home":"mars"'), /home/],
  ] as const) { const r = readV1(raw); assert.ok(!r.ok && why.test(r.reason), `${raw.slice(0, 40)} → ${!r.ok && r.reason}`) }
})

/* ---------------- each fixture alone in a fresh browser ---------------- */

test('every good v1 Cozmling comes in as itself: same stage, counters, look, home, needs', async () => {
  for (const id of GOOD) {
    storage.m.clear(); put(id)
    const f = fx(id), s = await page(memoryRepository()), st = s.getState()
    assert.equal(st.status, 'ready'); assert.equal(st.companions.length, 1, id); assert.equal(st.quarantined.length, 0, id)
    const c = st.companions[0] as LegacyCompanion
    assert.equal(c.kind, 'legacy'); assert.equal(st.selectedId, c.companionId)
    assert.equal(legacyStage(c), f.expect.stage, id)
    assert.equal(legacyGrowth(c), f.expect.growthPoints, id)
    assert.deepEqual(counters(c.legacy.pet), f.expect.counters, id)
    assert.deepEqual(c.legacy.pet.look, f.expect.look, id); assert.equal(c.legacy.pet.home, f.expect.home, id); assert.equal(c.legacy.pet.name, f.expect.name, id)
    assert.equal(c.hatch.status, f.expect.hatched ? 'hatched' : 'egg', id)
    assert.equal(c.legacy.stageFloor, f.expect.stage); assert.equal(c.legacy.growthFloor, f.expect.growthPoints)
    assert.equal(companionProblem(c), null, id)
    // the v1 key is untouched, byte for byte, and the original is kept with its checksum
    assert.equal(storage.getItem(f.storageKey), f.raw, id)
    const src = s.source(f.storageKey)!
    assert.equal(src.originalRaw, f.raw); assert.equal(src.originalHash, await checksum(f.raw)); assert.equal(src.companionId, c.companionId)
  }
})

test('the egg stays an egg, the Guardian stays a Guardian, the Cadet keeps its wallet backup reference', async () => {
  put('guest-egg', 'wallet-guardian', 'wallet-cadet')
  const s = await page(memoryRepository())
  const egg = legacy(s, fx('guest-egg').storageKey)!, guardian = legacy(s, fx('wallet-guardian').storageKey)!, cadet = legacy(s, fx('wallet-cadet').storageKey)!
  assert.deepEqual(egg.hatch, { status: 'egg', hatchedAt: null, provenance: 'known' }); assert.equal(legacyStage(egg), 'egg'); assert.equal(egg.walletLinks.length, 0)
  assert.equal(legacyStage(guardian), 'guardian'); assert.equal(guardian.hatch.provenance, 'known'); assert.equal(guardian.hatch.hatchedAt, guardian.legacy.pet.hatched)
  assert.equal(cadet.legacy.pet.txid, 'FIXTURETXIDCADET'); assert.equal(cadet.legacy.pet.round, 55000000)
  assert.deepEqual(cadet.walletLinks.map(l => [l.address, l.status]), [[ownerOf(fx('wallet-cadet').storageKey), 'linked']])
})

test('a sleeping Cozmling keeps its sleep start and settles exactly as the first version does', async () => {
  put('wallet-asleep-low')
  const f = fx('wallet-asleep-low'), s = await page(memoryRepository()), c = legacy(s, f.storageKey)!
  assert.equal(c.legacy.pet.asleep, 1794484800000)
  const later = clock + 5 * 3_600_000
  assert.deepEqual(care.settle(c.legacy.pet, later), care.settle(care.load(ownerOf(f.storageKey)!)!, later))
})

test('a save from before the alien redesign is shown as the old page shows it, and its original text is kept', async () => {
  put('wallet-pre-alien-look')
  const f = fx('wallet-pre-alien-look'), s = await page(memoryRepository()), c = legacy(s, f.storageKey)!
  assert.deepEqual(c.legacy.pet.look, { form: 'girl', body: 2, glow: 1, eyes: 1 })
  assert.equal(s.source(f.storageKey)!.originalRaw, f.raw)                       // still says {"form":"girl"} only
  assert.match(s.getState().lastSync!.warnings[0].text, /before the alien redesign/)
})

test('an incomplete or broken v1 save is quarantined: kept as it is, no companion made, nothing crashes', async () => {
  for (const id of BAD) {
    storage.m.clear(); put(id)
    const f = fx(id), repo = memoryRepository(), s = await page(repo)
    assert.equal(s.getState().companions.length, 0, id)
    assert.deepEqual(s.getState().quarantined.map(q => q.sourceKey), [f.storageKey], id)
    assert.equal(storage.getItem(f.storageKey), f.raw, id)                       // never deleted, never "fixed"
    const src = s.source(f.storageKey)!
    assert.equal(src.status, 'quarantined'); assert.equal(src.originalRaw, f.raw); assert.equal(src.companionId, undefined)
    // and it is still reported, unchanged, on the next visit
    const again = await page(repo)
    assert.deepEqual(again.getState().quarantined.map(q => q.sourceKey), [f.storageKey], id)
    assert.equal((await repo.load()).sources.length, 1)
  }
})

/* ---------------- more than one save in the same browser ---------------- */

test('a guest egg and a wallet Cozmling in one browser stay two separate companions', async () => {
  put('guest-egg', 'wallet-cadet')
  const s = await page(memoryRepository())
  assert.equal(s.getState().companions.length, 2)
  assert.equal(legacyStage(legacy(s, fx('guest-egg').storageKey)!), 'egg')
  assert.equal(legacyStage(legacy(s, fx('wallet-cadet').storageKey)!), 'cadet')
  assert.notEqual(legacy(s, fx('guest-egg').storageKey)!.companionId, legacy(s, fx('wallet-cadet').storageKey)!.companionId)
  for (const id of ['guest-egg', 'wallet-cadet']) assert.equal(storage.getItem(fx(id).storageKey), fx(id).raw)
})

test('a browser that has used many wallets: seven companions, two quarantined, every v1 key untouched', async () => {
  put(...GOOD, ...BAD)
  const s = await page(memoryRepository()), st = s.getState()
  assert.equal(st.companions.length, 7); assert.equal(st.quarantined.length, 2)
  assert.equal(new Set(st.companions.map(c => c.companionId)).size, 7)
  for (const f of local.fixtures) assert.equal(storage.getItem(f.storageKey), f.raw, f.id)
  assert.equal(st.lastSync!.migrated.length, 7)
})

/* ---------------- it can run again and again ---------------- */

test('running it again gives the same companions: no second identity, no second event', async () => {
  put(...GOOD, ...BAD)
  const repo = memoryRepository()
  const first = await page(repo), before = first.getState().companions.map(c => [c.companionId, c.revision]).sort()
  await first.sync(); await first.sync()
  const second = await page(repo)                                                // a later visit
  assert.deepEqual(second.getState().companions.map(c => [c.companionId, c.revision]).sort(), before)
  assert.deepEqual(second.getState().lastSync!.migrated, [])
  const events = await repo.events()
  assert.equal(events.length, 7); assert.equal(new Set(events.map(e => e.companionId)).size, 7)
  assert.equal((await repo.load()).sources.length, 9)
})

test('two tabs opening at the same moment bring each save in once', async () => {
  put('guest-egg', 'wallet-cadet')
  const repo = memoryRepository(), a = createStore(repo, env()), b = createStore(repo, env())
  await Promise.all([a.hydrate(), b.hydrate()])
  const snap = await repo.load()
  assert.equal(snap.companions.length, 2)
  assert.deepEqual(a.getState().companions.map(c => c.companionId).sort(), b.getState().companions.map(c => c.companionId).sort())
  assert.equal((await repo.events()).length, 2)
})

test('the chosen companion is remembered between visits', async () => {
  put('guest-egg', 'wallet-cadet', 'wallet-guardian')
  const repo = memoryRepository(), s = await page(repo)
  const pick = legacy(s, fx('wallet-guardian').storageKey)!.companionId
  assert.equal(await s.select(pick), true); assert.equal(await s.select('nobody'), false)
  assert.equal((await page(repo)).getState().selectedId, pick)
})

/* ---------------- rolling back loses nothing ---------------- */

test('roll-back: care for it in v2, then the first version reads the same Cozmling with the new values', async () => {
  put('wallet-cadet')
  const f = fx('wallet-cadet'), owner = ownerOf(f.storageKey)!, repo = memoryRepository(), s = await page(repo)
  const c = legacy(s, f.storageKey)!
  clock += 60_000
  const res = await s.updateLegacy(c.companionId, pet => care.feed(pet, care.FOODS[0]).pet, { eventId: 'care-test-1', type: 'care' })
  assert.ok(res.ok)
  const mine = (res.companion as LegacyCompanion).legacy.pet
  assert.equal(mine.fed, 41); assert.equal(res.companion.revision, 1); assert.equal(s.getState().savedAt, clock)
  // the old page, reading its own key
  const theirs = care.load(owner)!
  assert.deepEqual(theirs, mine)
  assert.equal(theirs.name, 'Comet'); assert.equal(care.stageOf(theirs), 'cadet'); assert.equal(theirs.txid, 'FIXTURETXIDCADET')
  // the untouched original is still there as evidence, and the next visit sees nothing to do
  assert.equal(s.source(f.storageKey)!.originalRaw, f.raw)
  assert.equal(s.source(f.storageKey)!.lastSeenHash, await checksum(v1Text(mine)))
  const next = await page(repo)
  assert.equal(legacy(next, f.storageKey)!.revision, 1); assert.deepEqual(next.getState().lastSync!.tookFromV1, [])
})

test('hatching an egg in v2 records the real hatch time, and the old page sees it hatched', async () => {
  put('guest-egg')
  const repo = memoryRepository(), s = await page(repo), c = legacy(s, V1_KEY)!
  clock += 5000
  const res = await s.updateLegacy(c.companionId, (pet, now) => ({ ...pet, hatched: now, at: now }), { eventId: `hatched:${c.companionId}`, type: 'hatched' })
  assert.ok(res.ok)
  assert.deepEqual(res.companion.hatch, { status: 'hatched', hatchedAt: clock, provenance: 'known' })
  assert.equal(care.loadGuest()!.hatched, clock); assert.equal(care.stageOf(care.loadGuest()!), 'sprout')
  // the hatch is recorded once: a second delivery of the same event changes nothing
  const twice = await s.updateLegacy(c.companionId, (pet, now) => ({ ...pet, hatched: now + 1, at: now }), { eventId: `hatched:${c.companionId}`, type: 'hatched' })
  assert.ok(!twice.ok && twice.reason === 'duplicate')
  assert.equal(legacy(s, V1_KEY)!.hatch.hatchedAt, clock); assert.equal((await repo.events(c.companionId)).length, 2)
})

test('after a spell on the old page (v2 switched off), its newer save is taken, and nothing is thrown away', async () => {
  put('wallet-cadet')
  const f = fx('wallet-cadet'), owner = ownerOf(f.storageKey)!, repo = memoryRepository(), s = await page(repo)
  const id = legacy(s, f.storageKey)!.companionId
  clock += 60_000
  await s.updateLegacy(id, pet => care.feed(pet, care.FOODS[0]).pet)              // v2: fed 41
  const v2Copy = v1Text(legacy(s, f.storageKey)!.legacy.pet)
  // the old page takes over: it loads its key, plays twice, saves
  clock += 3_600_000
  let old = care.settle(care.load(owner)!, clock)
  old = care.play(care.play(old).pet).pet
  care.save(owner, old)
  const back = await page(repo), c = legacy(back, f.storageKey)!
  assert.equal(c.companionId, id)                                                 // the same companion
  assert.equal(c.legacy.pet.played, 32); assert.equal(c.legacy.pet.fed, 41); assert.equal(c.revision, 2)
  assert.deepEqual(back.getState().lastSync!.tookFromV1, [id])
  assert.deepEqual(care.load(owner), c.legacy.pet)                                // both sides agree again
  const hist = back.source(f.storageKey)!.history
  assert.equal(hist.at(-1)!.raw, v2Copy); assert.match(hist.at(-1)!.note, /before a newer save/)
})

test('an old tab holding a stale copy cannot undo progress: counts never go down, and its copy is kept', async () => {
  put('wallet-cadet')
  const f = fx('wallet-cadet'), owner = ownerOf(f.storageKey)!, repo = memoryRepository(), s = await page(repo)
  const id = legacy(s, f.storageKey)!.companionId
  const stale = care.load(owner)!                                                 // what the old tab has in memory
  clock += 60_000
  await s.updateLegacy(id, pet => care.feed(pet, care.FOODS[0]).pet)              // v2: fed 41
  // (a) the old tab writes its copy with an OLDER time: v2 keeps its own and puts it back
  care.save(owner, stale)
  await s.sync()
  assert.equal(legacy(s, f.storageKey)!.legacy.pet.fed, 41); assert.equal(care.load(owner)!.fed, 41)
  assert.match(s.source(f.storageKey)!.history.at(-1)!.note, /older save/)
  // (b) the old tab ticks and writes its copy with a NEWER time: its needs are taken, the count is not lost
  clock += 8000
  care.save(owner, care.settle(stale, clock))
  await s.sync()
  assert.equal(legacy(s, f.storageKey)!.legacy.pet.fed, 41); assert.equal(care.load(owner)!.fed, 41)
})

test('the old page adopted a different Cozmling under the same key: both are kept, the first is set aside', async () => {
  put('guest-egg')
  const repo = memoryRepository(), s = await page(repo), first = legacy(s, V1_KEY)!.companionId
  clock += 86_400_000
  care.saveGuest(care.adopt('Blip', { form: 'boy', body: 3, glow: 2, eyes: 1 }, 'grove', clock))       // "start over" on the old page
  const back = await page(repo), st = back.getState()
  assert.equal(st.companions.length, 2)
  const was = st.companions.find(c => c.companionId === first)!, now = legacy(back, V1_KEY)!
  assert.match(was.archived!.reason, /adopted in its place/); assert.equal((was as LegacyCompanion).legacy.pet.name, 'Pip')
  assert.equal(now.legacy.pet.name, 'Blip'); assert.notEqual(now.companionId, first); assert.equal(st.selectedId, now.companionId)
  assert.deepEqual(st.lastSync!.replaced, [{ was: first, now: now.companionId }])
  assert.equal(care.loadGuest()!.name, 'Blip')                                    // the old page's Cozmling is left alone
  // set aside means it can't be changed or chosen by accident, but it is still in the store
  assert.equal((await back.updateLegacy(first, p => p)).ok, false); assert.equal(await back.select(first), false)
  assert.equal((await page(repo)).getState().companions.length, 2)
})

test('the v1 key disappears: the companion stays, and its v1 copy is put back', async () => {
  put('wallet-sprout')
  const f = fx('wallet-sprout'), repo = memoryRepository(), s = await page(repo), id = legacy(s, f.storageKey)!.companionId
  storage.removeItem(f.storageKey)
  const back = await page(repo)
  assert.equal(legacy(back, f.storageKey)!.companionId, id)
  assert.deepEqual(care.load(ownerOf(f.storageKey)!), legacy(back, f.storageKey)!.legacy.pet)
})

test('something unreadable lands on a key v2 already knows: it is kept in history and the good copy is put back', async () => {
  put('wallet-sprout')
  const f = fx('wallet-sprout'), repo = memoryRepository(), s = await page(repo), id = legacy(s, f.storageKey)!.companionId
  storage.setItem(f.storageKey, '{"v":1,"name":"Brok')
  const back = await page(repo)
  assert.equal(legacy(back, f.storageKey)!.companionId, id); assert.equal(back.getState().quarantined.length, 0)
  assert.equal(back.source(f.storageKey)!.history.at(-1)!.raw, '{"v":1,"name":"Brok')
  assert.equal(care.load(ownerOf(f.storageKey)!)!.name, 'Nova')
})

test('a quarantined save that later becomes readable is brought in, and the unreadable original is still kept', async () => {
  put('wallet-bad-json')
  const f = fx('wallet-bad-json'), repo = memoryRepository()
  await page(repo)
  storage.setItem(f.storageKey, fx('wallet-sprout').raw)
  const back = await page(repo), c = legacy(back, f.storageKey)!
  assert.equal(c.legacy.pet.name, 'Nova'); assert.equal(back.getState().quarantined.length, 0)
  assert.equal(back.source(f.storageKey)!.originalRaw, f.raw); assert.equal(back.source(f.storageKey)!.status, 'migrated')
})

/* ---------------- honesty about what we know ---------------- */

test('a Cozmling brought back from a wallet note has an unknown hatch time: none is invented', async () => {
  const egg = notes.notes.find(n => n.id === 'note-egg')!
  const read = readNote(egg.noteJson)
  assert.ok(read.ok)
  care.save(egg.sender, care.restore(egg.sender, read.saved, 'TX', egg.confirmedRound, clock))      // what the old page stores after a restore
  const s = await page(memoryRepository()), c = legacy(s, `${V1_KEY}:${egg.sender}`)!
  assert.deepEqual(c.hatch, { status: 'hatched', hatchedAt: null, provenance: 'legacy-unknown' })
  // and it stays unknown however much it is cared for afterwards
  clock += 1000
  const res = await s.updateLegacy(c.companionId, pet => care.pat(pet).pet)
  assert.ok(res.ok && res.companion.hatch.provenance === 'legacy-unknown' && res.companion.hatch.hatchedAt === null)
})

test('wallet notes: every fixture reads, and a colour that does not exist is made explicit with a warning', () => {
  for (const n of notes.notes) {
    const r = readNote(n.noteJson)
    assert.ok(r.ok, n.id); assert.equal(r.saved.name, n.expect.name, n.id); assert.equal(!!r.saved.state, n.expect.hasState, n.id)
    assert.equal(care.stageOf(care.restore(n.sender, r.saved, 'TX', n.confirmedRound, clock)), n.expect.restoredStage, n.id)
    if (n.id === 'note-bad-palette') { assert.equal(r.saved.look.body, 0); assert.match(r.warnings[0], /body colour 63 does not exist/) } else assert.deepEqual(r.warnings, [], n.id)
  }
  assert.equal(readNote({ n: '', f: 'b' }).ok, false); assert.equal(readNote(null).ok, false)
})

test('a stage is never shown lower than the one it came in with', async () => {
  put('wallet-guardian')
  const s = await page(memoryRepository()), c = legacy(s, fx('wallet-guardian').storageKey)!
  const shrunk: LegacyCompanion = { ...c, legacy: { ...c.legacy, pet: { ...c.legacy.pet, fed: 0, played: 0, pets: 0, arcade: 0, cheered: 0, checkins: 0 } } }
  assert.equal(care.stageOf(shrunk.legacy.pet), 'sprout')                         // what a rule change could do
  assert.equal(legacyStage(shrunk), 'guardian'); assert.equal(legacyGrowth(shrunk), 1400)
})

/* ---------------- writes that must not go through ---------------- */

test('a tab working from an older copy of a first-version Cozmling catches up before it changes anything', async () => {
  put('wallet-sprout')
  const f = fx('wallet-sprout'), repo = memoryRepository(), a = await page(repo), b = await page(repo)
  const id = legacy(a, f.storageKey)!.companionId
  clock += 1000
  assert.ok((await a.updateLegacy(id, pet => care.feed(pet, care.FOODS[0]).pet)).ok)            // fed 6, and the v1 key now says so
  clock += 1000
  const late = await b.updateLegacy(id, pet => care.play(pet).pet)                               // b still holds revision 0…
  assert.ok(late.ok)                                                                             // …sees the v1 key has moved on, reads the newer copy, and plays on top of it
  assert.equal(late.companion.revision, 2)
  const end = (await repo.load()).companions[0] as LegacyCompanion
  assert.equal(end.legacy.pet.fed, 6); assert.equal(end.legacy.pet.played, 4); assert.equal(end.revision, 2)
  assert.equal(storage.getItem(f.storageKey), v1Text(end.legacy.pet))
})

test('the arcade (still the first version\'s code) saves a run, then the new page feeds: the run is not lost', async () => {
  put('wallet-cadet')
  const f = fx('wallet-cadet'), owner = ownerOf(f.storageKey)!, repo = memoryRepository(), s = await page(repo)
  const id = legacy(s, f.storageKey)!.companionId, before = legacy(s, f.storageKey)!.legacy.pet
  clock += 60_000
  const run = care.cheer(owner, { daily: false, best: false }, clock)                             // the first version's own code, writing the v1 key directly
  assert.ok(run, 'the old code found and cheered the Cozmling')
  assert.equal(care.load(owner)!.arcade, (before.arcade ?? 0) + 1)
  clock += 5000
  const fed = await s.updateLegacy(id, pet => care.feed(pet, care.FOODS[2]).pet)                 // the new page, which has not looked at the key since
  assert.ok(fed.ok)
  const end = (await repo.load()).companions[0] as LegacyCompanion
  assert.equal(end.legacy.pet.arcade, (before.arcade ?? 0) + 1, 'the arcade run is still counted')
  assert.equal(end.legacy.pet.fed, before.fed + 1)
  assert.equal(care.load(owner)!.arcade, (before.arcade ?? 0) + 1); assert.equal(care.load(owner)!.fed, before.fed + 1)
})

test('a write that fails is never shown as saved, and the v1 copy is left alone', async () => {
  put('wallet-sprout')
  const f = fx('wallet-sprout'), inner = memoryRepository()
  let failing = false
  const repo: Repository = { durable: true, load: () => inner.load(), events: id => inner.events(id), write: (w: Write) => (failing ? Promise.resolve({ ok: false, reason: 'failed', detail: 'QuotaExceededError' }) : inner.write(w)) }
  const s = await page(repo), id = legacy(s, f.storageKey)!.companionId
  failing = true; clock += 1000
  const res = await s.updateLegacy(id, pet => care.feed(pet, care.FOODS[0]).pet)
  assert.ok(!res.ok && res.reason === 'failed')
  assert.equal(s.getState().savedAt, null); assert.equal(s.getState().saveProblem, 'QuotaExceededError')
  assert.equal(legacy(s, f.storageKey)!.legacy.pet.fed, 5); assert.equal(storage.getItem(f.storageKey), f.raw)
  failing = false
  assert.ok((await s.updateLegacy(id, pet => care.feed(pet, care.FOODS[0]).pet)).ok)
  assert.equal(s.getState().saveProblem, null); assert.equal(s.getState().savedAt, clock)
})

test('a browser that stores nothing still works for the visit, and says it is not saved on the device', async () => {
  storage.off = true
  const s = await page(memoryRepository())
  assert.equal(s.getState().status, 'ready'); assert.equal(s.getState().durable, false); assert.deepEqual(s.getState().companions, [])
})

/* ---------------- a file the player can keep ---------------- */

test('export, then import on another device: the same companions arrive, nothing is overwritten without a choice', async () => {
  put(...GOOD, ...BAD)
  const home = memoryRepository(), s = await page(home)
  const id = legacy(s, fx('wallet-cadet').storageKey)!.companionId
  const file = JSON.parse(JSON.stringify(await exportAll(home, clock)))            // as it would be after a download
  assert.equal(file.companions.length, 7); assert.equal(file.sources.length, 9); assert.equal(file.events.length, 7)

  const away = memoryRepository(), have = async () => new Set((await away.events()).map(e => e.eventId))
  const first = planImport(file, await away.load(), await have())
  assert.ok(first.ok); assert.equal(first.plan.add.length, 7); assert.equal(first.plan.events.length, 7)
  assert.ok((await applyImport(away, first.plan)).ok)
  const arrived = (await away.load()).companions
  assert.deepEqual(arrived.map(c => c.companionId).sort(), file.companions.map((c: any) => c.companionId).sort())
  assert.ok(arrived.every(c => c.kind === 'legacy' && c.legacy.sourceKey === '' && companionProblem(c) === null))
  // the same file again: nothing to do
  const again = planImport(file, await away.load(), await have())
  assert.ok(again.ok); assert.equal(again.plan.add.length, 0); assert.equal(again.plan.same.length, 7); assert.equal(again.plan.events.length, 0)

  // a newer copy of one companion is only taken when the player says so
  clock += 1000
  await s.updateLegacy(id, pet => care.feed(pet, care.FOODS[0]).pet)
  const newer = planImport(JSON.parse(JSON.stringify(await exportAll(home, clock))), await away.load(), await have())
  assert.ok(newer.ok); assert.deepEqual(newer.plan.newer.map(n => n.incoming.companionId), [id])
  await applyImport(away, newer.plan)
  assert.equal(((await away.load()).companions.find(c => c.companionId === id) as LegacyCompanion).legacy.pet.fed, 40)
  await applyImport(away, newer.plan, new Set([id]))
  assert.equal(((await away.load()).companions.find(c => c.companionId === id) as LegacyCompanion).legacy.pet.fed, 41)
})

test('import refuses files that are not ours and records that are not sound', async () => {
  put('wallet-sprout')
  const repo = memoryRepository()
  await page(repo)
  const snap = await repo.load(), file = await exportAll(repo, clock)
  assert.equal(planImport(null, snap, new Set()).ok, false); assert.equal(planImport({ format: 'something-else' }, snap, new Set()).ok, false)
  assert.equal(planImport({ ...file, version: 2 }, snap, new Set()).ok, false)
  const broken = structuredClone(file.companions[0]) as any; broken.companionId = 'other-000001'; broken.legacy.pet.food = 500
  const dupe = structuredClone(file.companions[0]) as any; dupe.companionId = 'other-000002'
  const r = planImport({ ...file, companions: [broken, dupe, dupe, { nonsense: true }] }, snap, new Set())
  assert.ok(r.ok); assert.deepEqual(r.plan.add.map(c => c.companionId), ['other-000002']); assert.equal(r.plan.rejected.length, 3)
})

test('the old page just sitting open (it rewrites its save every few seconds) changes nothing in v2', async () => {
  put('wallet-cadet')
  const f = fx('wallet-cadet'), owner = ownerOf(f.storageKey)!, repo = memoryRepository(), s = await page(repo)
  const id = legacy(s, f.storageKey)!.companionId
  for (let i = 0; i < 5; i++) { clock += 4000; care.save(owner, care.settle(care.load(owner)!, clock)); await s.sync() }
  const c = legacy(s, f.storageKey)!
  assert.equal(c.companionId, id); assert.equal(c.revision, 0); assert.deepEqual(s.source(f.storageKey)!.history, [])
  assert.equal(s.source(f.storageKey)!.lastSeenHash, await checksum(storage.getItem(f.storageKey)!))
  // v2's next change still starts from the right place and lands in the v1 key
  clock += 4000
  const res = await s.updateLegacy(id, pet => care.feed(pet, care.FOODS[0]).pet)
  assert.ok(res.ok); assert.deepEqual(care.load(owner), (res.companion as LegacyCompanion).legacy.pet)
  assert.deepEqual(care.settle((res.companion as LegacyCompanion).legacy.pet, clock).food, care.clamp(care.settle(JSON.parse(f.raw), clock).food + care.FOODS[0].food))
})

test('with no choice made yet, the guest Cozmling shows first (as on the old page); otherwise the most recently looked after', async () => {
  put('wallet-guardian', 'wallet-asleep-low', 'guest-egg', 'wallet-cadet')
  const s = await page(memoryRepository())
  assert.equal(s.getState().selectedId, legacy(s, V1_KEY)!.companionId)
  storage.m.clear(); put('wallet-asleep-low', 'wallet-guardian')                 // no guest: Atlas was looked after later than Luna
  const t = await page(memoryRepository())
  assert.equal(t.getState().selectedId, legacy(t, fx('wallet-guardian').storageKey)!.companionId)
})
