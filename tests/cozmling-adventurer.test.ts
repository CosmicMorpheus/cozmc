/* Cozmling v2: Starprints, adopting an adventurer, and care by the first version's rules. `npm test`. */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

class FakeStorage {
  m = new Map<string, string>()
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  removeItem(k: string) { this.m.delete(k) }
}
const storage = new FakeStorage()
;(globalThis as any).localStorage = storage

const v1 = await import('../src/companion/care')
const { SIGNS, ELEMENTS, signFor, starprintFor, parseBirthday, birthdayText, STARPRINT_ENGINE } = await import('../src/cozmling/domain/starprint')
const { newAdventurer, adoptProblem, customize, SKINS } = await import('../src/cozmling/domain/adventurer')
const { asPet, careFor, hatch, look, nameOf, petOf } = await import('../src/cozmling/domain/care')
const { memoryRepository } = await import('../src/cozmling/store/memoryRepository')
const { createStore } = await import('../src/cozmling/store/companionStore')
const { checksum } = await import('../src/cozmling/store/util')
const { companionProblem } = await import('../src/cozmling/store/validators')
const { exportAll, planImport, applyImport } = await import('../src/cozmling/store/exportImport')
import type { AdventurerCompanion, Companion } from '../src/cozmling/types'
import type { Repository } from '../src/cozmling/store/repository'

const H = 3_600_000, START = Date.UTC(2026, 10, 12, 18, 0, 0)
let clock = START, ids = 0
const env = () => ({ storage, now: () => clock, newId: () => `test-${String(++ids).padStart(6, '0')}`, hash: checksum })
const page = async (repo: Repository, persist?: { ask(): Promise<boolean>; granted(): Promise<boolean> }) => { const s = createStore(repo, env(), undefined, persist); await s.hydrate(); return s }
const choices = { name: 'Orbi', birthday: '2026-11-05', look: 'a' as const, skin: 'teal' }
const fresh = (over: Partial<typeof choices> = {}) => newAdventurer({ ...choices, ...over }, { companionId: `test-${String(++ids).padStart(6, '0')}`, now: clock })
const needs = (c: Companion, now = clock) => { const p = v1.settle(petOf(c), now); return [p.food, p.fun, p.energy, p.asleep] }

beforeEach(() => { storage.m.clear(); clock = START; ids = 0 })

/* ---------------- Starprint ---------------- */

test('the twelve identities are the approved ones: sign, element, archetype', () => {
  assert.deepEqual(SIGNS.map(s => `${s.name} / ${s.archetype} / ${s.element}`), [
    'Aries / Pathfinder / fire', 'Taurus / Keeper / earth', 'Gemini / Messenger / air', 'Cancer / Nurturer / water', 'Leo / Radiant Heart / fire', 'Virgo / Inventor / earth',
    'Libra / Harmonizer / air', 'Scorpio / Seeker / water', 'Sagittarius / Wanderer / fire', 'Capricorn / Builder / earth', 'Aquarius / Visionary / air', 'Pisces / Dreamer / water',
  ])
  assert.deepEqual(Object.keys(ELEMENTS).sort(), ['air', 'earth', 'fire', 'water'])
  for (const e of ['fire', 'earth', 'air', 'water'] as const) assert.equal(SIGNS.filter(s => s.element === e).length, 3)
})

test('every day of the year belongs to exactly one sign, and each sign starts and ends on its dates', () => {
  const count: Record<string, number> = {}
  for (let t = Date.UTC(2024, 0, 1); t < Date.UTC(2025, 0, 1); t += 86_400_000) {      // a leap year: Feb 29 included
    const s = signFor(new Date(t).toISOString().slice(0, 10))
    assert.ok(s, new Date(t).toISOString()); count[s.sign] = (count[s.sign] ?? 0) + 1
  }
  assert.equal(Object.values(count).reduce((a, b) => a + b, 0), 366); assert.equal(Object.keys(count).length, 12)
  const pad = (n: number) => String(n).padStart(2, '0')
  for (const s of SIGNS) {
    assert.equal(signFor(`2026-${pad(s.from[0])}-${pad(s.from[1])}`)!.sign, s.sign); assert.equal(signFor(`2026-${pad(s.to[0])}-${pad(s.to[1])}`)!.sign, s.sign)
  }
  assert.equal(signFor('2026-12-31')!.sign, 'capricorn'); assert.equal(signFor('2027-01-01')!.sign, 'capricorn')      // over the new year
  assert.equal(signFor('2026-11-05')!.sign, 'scorpio'); assert.equal(signFor('2026-05-05')!.sign, 'taurus')
  assert.equal(signFor('2024-02-29')!.sign, 'pisces')
})

test('a birthday must be a real date', () => {
  for (const bad of ['', '2026-02-30', '2023-02-29', '2026-13-01', '2026-00-10', '2026-1-5', '05/11/2026', 'tomorrow', '1899-12-31']) {
    assert.equal(parseBirthday(bad), null, bad); assert.equal(signFor(bad), null, bad); assert.equal(starprintFor(bad), null, bad)
  }
  assert.equal(birthdayText('2026-11-05'), 'November 5')
})

test('a Starprint records how it was worked out, and never carries a Moon or Rising sign yet', () => {
  const s = starprintFor('2026-11-05')!
  assert.deepEqual(s, { chosenBirthday: '2026-11-05', coreSign: 'scorpio', element: 'water', archetype: 'Seeker', status: 'partial', engineVersion: STARPRINT_ENGINE })
  assert.ok(!('moon' in s) && !('rising' in s))
})

/* ---------------- adoption ---------------- */

test('a new adventurer is a Star Egg with the same starting needs as a first-version Cozmling', () => {
  const a = fresh(), old = v1.adopt('Orbi', { form: 'boy', body: 0, glow: 0, eyes: 0 }, 'loft', clock)
  assert.equal(a.kind, 'adventurer'); assert.deepEqual(a.hatch, { status: 'egg', hatchedAt: null, provenance: 'known' })
  assert.deepEqual([a.care.food, a.care.fun, a.care.energy], [old.food, old.fun, old.energy])
  assert.equal(a.starprint.coreSign, 'scorpio'); assert.equal(a.progress.visualStage, null); assert.deepEqual(a.walletLinks, [])
  assert.equal(companionProblem(a), null)
  const messy = '  <b>Zib!!</b>  the   great one '
  assert.equal(fresh({ name: messy }).name, v1.cleanName(messy).trim())           // the same name clean-up as the first version
  assert.equal(fresh({ name: messy }).name, 'bZibb the gre')
})

test('adoption needs a birthday, a name, a look and a skin', () => {
  assert.equal(adoptProblem(choices), null)
  assert.match(adoptProblem({ ...choices, birthday: '' })!, /birthday/); assert.match(adoptProblem({ ...choices, name: '  !! ' })!, /name/)
  assert.match(adoptProblem({ ...choices, look: 'c' as any })!, /look/); assert.match(adoptProblem({ ...choices, skin: 'plaid' })!, /skin/)
  assert.throws(() => fresh({ name: '' }))
})

test('adopting saves it, shows it, and it is still there on the next visit, with no wallet and no v1 key', async () => {
  const repo = memoryRepository(), s = await page(repo)
  assert.equal(s.getState().companions.length, 0)
  const a = fresh()
  assert.ok((await s.adopt(a)).ok)
  assert.equal(s.getState().selectedId, a.companionId); assert.equal(s.getState().savedAt, clock)
  const back = await page(repo), c = back.getState().companions[0] as AdventurerCompanion
  assert.equal(back.getState().selectedId, a.companionId); assert.deepEqual(c, a)
  assert.deepEqual((await repo.events(a.companionId)).map(e => e.type), ['adopted'])
  assert.equal(storage.m.size, 0)                                              // adventurers have no first-version form
  assert.ok(!(await s.adopt(a)).ok)                                            // the same one can't be adopted twice
})

test('the browser is asked to keep the save at the first adoption, and play never waits on the answer', async () => {
  let asked = 0
  const persist = { ask: async () => { asked++; return false }, granted: async () => false }
  const durable: Repository = { ...memoryRepository(), durable: true }
  const s = await page(durable, persist)
  assert.equal(asked, 0)
  await s.adopt(fresh()); await new Promise(r => setTimeout(r, 0))
  assert.equal(asked, 1); assert.equal(s.getState().persisted, false)          // "not kept for sure": the page can nudge towards export
  const visit = await page(memoryRepository(), persist)                        // a browser that stores nothing is never asked
  await visit.adopt(fresh()); await new Promise(r => setTimeout(r, 0))
  assert.equal(asked, 1); assert.equal(visit.getState().persisted, null)
})

/* ---------------- hatching ---------------- */

test('hatching happens once, records the real time, and makes a Hatchling', async () => {
  const repo = memoryRepository(), s = await page(repo), a = fresh()
  await s.adopt(a)
  assert.equal(careFor(a, { do: 'play' }, clock).ok, false)                   // an egg can't be played with
  clock += 60_000
  const res = await s.update(a.companionId, hatch, { event: { eventId: `hatched:${a.companionId}`, type: 'hatched' } })
  assert.ok(res.ok)
  const c = res.companion as AdventurerCompanion
  assert.deepEqual(c.hatch, { status: 'hatched', hatchedAt: clock, provenance: 'known' }); assert.equal(c.progress.visualStage, 'hatchling'); assert.equal(c.revision, 1)
  assert.equal(hatch(c, clock + 1), null)
  const again = await s.update(a.companionId, c => ({ ...c, hatch: { status: 'hatched', hatchedAt: 1, provenance: 'known' } }), { event: { eventId: `hatched:${a.companionId}`, type: 'hatched' } })
  assert.ok(!again.ok && again.reason === 'duplicate')
  assert.equal(((await page(repo)).getState().companions[0] as AdventurerCompanion).hatch.hatchedAt, clock)
})

/* ---------------- care: the first version's rules, exactly ---------------- */

test('an adventurer follows exactly the same care numbers as a first-version Cozmling', () => {
  let a: Companion = hatch(fresh(), clock)!
  let old = { ...v1.adopt('Orbi', { form: 'boy', body: 0, glow: 0, eyes: 0 }, 'loft', clock), hatched: clock }
  const same = (step: string) => {
    const p = v1.settle(old, clock)
    assert.deepEqual(needs(a), [p.food, p.fun, p.energy, p.asleep], step)
    const k = (a as AdventurerCompanion).progress.counters
    assert.deepEqual([k.fed ?? 0, k.played ?? 0, k.pets ?? 0], [old.fed, old.played, old.pets], step)
    assert.equal(look(a, clock).mood.line, v1.mood(p).line, step)
  }
  const both = (step: string, act: Parameters<typeof careFor>[1], on: (p: typeof old) => ReturnType<typeof v1.feed>) => {
    const mine = careFor(a, act, clock), theirs = on(v1.settle(old, clock))
    assert.equal(mine.ok, theirs.ok, step); assert.equal(mine.say, theirs.say, step)
    if (mine.companion) a = mine.companion
    if (theirs.ok) old = theirs.pet as typeof old
    same(step)
  }
  same('start')
  clock += 3 * H; both('feed cheese', { do: 'feed', food: 'cheese' }, p => v1.feed(p, v1.FOODS[0]))
  both('feed again', { do: 'feed', food: 'cheese' }, p => v1.feed(p, v1.FOODS[0]))
  both('full', { do: 'feed', food: 'cheese' }, p => v1.feed(p, v1.FOODS[0]))                        // "is full."
  clock += 5 * H; both('play', { do: 'play' }, p => v1.play(p))
  for (let i = 0; i < 6; i++) both(`pat ${i}`, { do: 'pat' }, p => v1.pat(p))
  both('not tired', { do: 'rest' }, p => v1.toggleSleep(p, clock))                                  // "isn't tired yet."?
  clock += 9 * H; both('lights out', { do: 'rest' }, p => v1.toggleSleep(p, clock))
  both('fed while asleep', { do: 'feed', food: 'cookie' }, p => v1.feed(p, v1.FOODS[2]))
  both('play while asleep', { do: 'play' }, p => v1.play(p))
  clock += 8 * H; same('after a night')
  both('wake', { do: 'rest' }, p => v1.toggleSleep(p, clock))
  both('treat', { do: 'feed', food: 'cookie' }, p => v1.feed(p, v1.FOODS[2]))
  clock += 40 * H; same('two days away')                                                           // ran out of energy and dozed off by itself
  both('too tired to wake?', { do: 'rest' }, p => v1.toggleSleep(p, clock))
  assert.equal((a as AdventurerCompanion).progress.experience, v1.growthPoints(old))
})

test('patting a sleeping Cozmling only gets a hush, and an unknown food does nothing', () => {
  let a: Companion = hatch(fresh(), clock)!
  clock += 12 * H
  a = careFor(a, { do: 'rest' }, clock).companion!
  const pat = careFor(a, { do: 'pat' }, clock)
  assert.equal(pat.ok, false); assert.equal(pat.companion, null); assert.match(pat.say, /Shh, Orbi is sleeping/)
  assert.equal(careFor(a, { do: 'feed', food: 'pizza' }, clock).companion, null)
})

test('looking never changes anything, and needs drift exactly as in the first version', () => {
  const a = hatch(fresh(), clock)!, before = JSON.stringify(a)
  const later = look(a, clock + 10 * H)
  assert.equal(JSON.stringify(a), before)
  const theirs = v1.settle(asPet(a as AdventurerCompanion), clock + 10 * H)
  assert.deepEqual([later.pet.food, later.pet.fun, later.pet.energy], [theirs.food, theirs.fun, theirs.energy])
  assert.ok(later.pet.food < 80 && later.pet.energy < 90); assert.equal(nameOf(a), 'Orbi')
})

test('care is one saved change per action, and the first care of each day is kept as a memory once', async () => {
  const repo = memoryRepository(), s = await page(repo), a = fresh()
  await s.adopt(a)
  await s.update(a.companionId, hatch, { event: { eventId: `hatched:${a.companionId}`, type: 'hatched' } })
  const day = () => Math.floor(clock / 86_400_000)
  const act = (what: Parameters<typeof careFor>[1]) => s.update(a.companionId, (c, now) => careFor(c, what, now).companion, { note: { eventId: `care:${a.companionId}:${day()}`, type: 'care' } })
  clock += 4 * H
  for (const what of [{ do: 'feed', food: 'cheese' }, { do: 'play' }, { do: 'pat' }, { do: 'pat' }] as const) assert.ok((await act(what)).ok)
  let c = s.getState().companions[0] as AdventurerCompanion
  assert.equal(c.revision, 5); assert.deepEqual([c.progress.counters.fed, c.progress.counters.played, c.progress.counters.pets], [1, 1, 2])
  assert.deepEqual((await repo.events(a.companionId)).map(e => e.type), ['adopted', 'hatched', 'care'])
  // an action that changes nothing writes nothing
  const full = await act({ do: 'feed', food: 'cheese' }); await act({ do: 'feed', food: 'cheese' }); const stuffed = await act({ do: 'feed', food: 'cheese' })
  assert.ok(full.ok && stuffed.ok); c = s.getState().companions[0] as AdventurerCompanion
  assert.ok(c.revision <= 7); assert.equal((await repo.events(a.companionId)).length, 3)
  clock += 24 * H                                                               // the next day: it dozed off by itself overnight (the v1 rule)
  assert.equal((await act({ do: 'pat' })).ok, true); assert.equal((await repo.events(a.companionId)).length, 3)      // a hush changes nothing, so nothing is written
  await act({ do: 'rest' }); await act({ do: 'pat' })                           // wake it, pat it: one more memory, once
  assert.deepEqual((await repo.events(a.companionId)).map(e => e.type), ['adopted', 'hatched', 'care', 'care'])
  // a second tab that doesn't know the memory exists still gets its change through
  const other = await page(repo)
  assert.ok((await other.update(a.companionId, (c, now) => careFor(c, { do: 'pat' }, now).companion, { note: { eventId: `care:${a.companionId}:${day()}`, type: 'care' } })).ok)
  assert.equal((await repo.events(a.companionId)).length, 4)
})

/* ---------------- wardrobe ---------------- */

test('a tab working from an older copy cannot overwrite a newer change', async () => {
  const repo = memoryRepository(), a = await page(repo)
  const id = fresh().companionId
  ids--                                                    // adopt that very record
  assert.ok((await a.adopt(fresh())).ok)
  const b = await page(repo)                               // a second tab, opened now
  clock += 1000
  assert.ok((await a.update(id, (c, now) => hatch(c, now), { event: { eventId: `hatched:${id}`, type: 'hatched' } })).ok)
  clock += 1000
  const late = await b.update(id, c => (c.kind === 'adventurer' ? customize(c, { name: 'Nova' }) : null))      // b still holds revision 0
  assert.ok(!late.ok && late.reason === 'stale')
  const seen = b.getState().companions.find(c => c.companionId === id)!
  assert.equal(seen.revision, 1); assert.equal(seen.hatch.status, 'hatched')                                    // b now shows the newer one
  assert.ok((await b.update(id, c => (c.kind === 'adventurer' ? customize(c, { name: 'Nova' }) : null))).ok)    // and trying again works on top of it
  const end = (await repo.load()).companions[0] as AdventurerCompanion
  assert.equal(end.name, 'Nova'); assert.equal(end.hatch.status, 'hatched'); assert.equal(end.revision, 2)
})

test('changing the look, skin or name never touches the Starprint or the identity', () => {
  const a = fresh(), b = customize(a, { look: 'b', skin: 'rose', name: 'Nova' })!
  assert.equal(b.appearance.appearanceOption, 'b'); assert.equal(b.appearance.skin, 'rose'); assert.equal(b.name, 'Nova')
  assert.deepEqual(b.starprint, a.starprint); assert.equal(b.companionId, a.companionId); assert.deepEqual(b.care, a.care)
  assert.equal(customize(a, {}), null); assert.equal(customize(a, { look: 'a' }), null)            // nothing to change
  assert.equal(customize(a, { skin: 'plaid' }), null); assert.equal(customize(a, { name: ' !! ' }), null)
  assert.equal(SKINS.length, 6)
})

/* ---------------- living alongside first-version Cozmlings ---------------- */

test('an adventurer and a first-version Cozmling live side by side, and both travel in an export', async () => {
  v1.saveGuest({ ...v1.adopt('Pip', { form: 'boy', body: 0, glow: 0, eyes: 0 }, 'loft', clock - 5 * H), hatched: clock - 4 * H })
  const repo = memoryRepository(), s = await page(repo), a = fresh()
  assert.equal(s.getState().companions.length, 1)
  await s.adopt(a)
  assert.deepEqual(s.getState().companions.map(c => c.kind).sort(), ['adventurer', 'legacy']); assert.equal(s.getState().selectedId, a.companionId)
  const guestBefore = storage.getItem('cozmc-cozmling-v1')
  await s.update(a.companionId, hatch); await s.update(a.companionId, (c, now) => careFor(c, { do: 'pat' }, now).companion)
  assert.equal(storage.getItem('cozmc-cozmling-v1'), guestBefore)              // caring for the adventurer never touches the other one's save
  const away = memoryRepository(), plan = planImport(JSON.parse(JSON.stringify(await exportAll(repo, clock))), await away.load(), new Set())
  assert.ok(plan.ok); assert.equal(plan.plan.add.length, 2); assert.deepEqual(plan.plan.rejected, [])
  assert.ok((await applyImport(away, plan.plan)).ok)
  assert.deepEqual((await page(away)).getState().companions.map(c => c.kind).sort(), ['adventurer', 'legacy'])
})
