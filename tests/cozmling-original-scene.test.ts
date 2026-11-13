/* The original Cozmling scene, recovered: how any companion is shown in it. `npm test`.
   The drawing itself (the Cosmic Grove, the pixel creature, the Room) is the first version's own code;
   the browser tests (tests/cozmling-loft.mjs) check it on screen. These check the mapping onto it. */
import { test } from 'node:test'
import assert from 'node:assert/strict'

;(globalThis as any).localStorage = { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }
const v1 = await import('../src/companion/care')
const { BODIES, GLOWS, STAGES, DEFAULT_LOOK } = await import('../src/companion/look')
const { newAdventurer, customize, SKINS } = await import('../src/cozmling/domain/adventurer')
const { asPet, careFor, hatch } = await import('../src/cozmling/domain/care')
const { companionProblem } = await import('../src/cozmling/store/validators')
const S = await import('../src/cozmling/integrations/originalScene')
import type { AdventurerCompanion, Companion } from '../src/cozmling/types'

const T0 = Date.parse('2026-11-13T12:00:00Z')
const adventurer = (birthday = '2026-03-30', look: 'a' | 'b' = 'a', skin = 'sky') =>
  newAdventurer({ name: 'Orbi', birthday, look, skin }, { companionId: 'test-orig-1', now: T0 })
const hatched = (c: AdventurerCompanion) => hatch(c, T0 + 1000) as AdventurerCompanion
const withCounts = (c: AdventurerCompanion, counters: Record<string, number>): AdventurerCompanion => ({ ...c, progress: { ...c.progress, counters } })

test('a new adventurer is the original creature: Look A and B are its two forms, the skin its body colour, its element its glow', () => {
  const a = S.originalLook(adventurer('2026-03-30', 'a', 'sky'))          // an Aries: fire
  assert.deepEqual(a, { form: 'boy', body: 1, glow: 6, eyes: DEFAULT_LOOK.boy.eyes })
  assert.equal(BODIES[a.body], '#7cc8ff'); assert.equal(GLOWS[a.glow], '#ff6a4a')   // the sky-blue Cozmling with the red bulb, as in the reference video
  const b = S.originalLook(adventurer('2026-05-05', 'b', 'rose'))         // a Taurus: earth
  assert.equal(b.form, 'girl'); assert.equal(BODIES[b.body], '#ff9ccf'); assert.equal(GLOWS[b.glow], '#8dff6a')
  // every skin there is to choose has its own original body colour, and every element its own glow
  for (const s of SKINS) assert.ok(S.SKIN_BODY[s.id] in BODIES, s.id)
  assert.equal(new Set(SKINS.map(s => S.SKIN_BODY[s.id])).size, SKINS.length)
  assert.equal(new Set(Object.values(S.ELEMENT_GLOW)).size, 4)
  // the same record always draws the same Cozmling
  assert.deepEqual(S.originalLook(adventurer()), S.originalLook(adventurer()))
})

test('it lives in the Cosmic Grove unless moved, and a home is only ever a real choice', () => {
  const c = adventurer()
  assert.equal(c.appearance.rendererVersion, S.ORIGINAL_RENDERER); assert.equal(c.appearance.home, 'grove')
  assert.equal(S.originalHome(c), 'grove')
  // a record from before the recovery said 'loft' without anyone choosing it: it lives in the Grove too
  const old: AdventurerCompanion = { ...c, appearance: { ...c.appearance, rendererVersion: 'layers-1', home: 'loft' } }
  assert.equal(S.originalHome(old), 'grove')
  const moved = customize(old, { home: 'moonbase' })!
  assert.equal(S.originalHome(moved), 'moonbase'); assert.equal(moved.appearance.rendererVersion, S.ORIGINAL_RENDERER)
  assert.deepEqual(moved.starprint, old.starprint, 'moving never touches the Starprint')
  assert.equal(customize(moved, { home: 'moonbase' }), null, 'no change, nothing saved')
  assert.equal(customize(moved, { home: 'attic' as any }), null, 'not a home')
  assert.equal(S.originalHome(customize(moved, { home: 'loft' })!), 'loft')
  // a change of look keeps the home it was moved to
  assert.equal(S.originalHome(customize(moved, { skin: 'moss' })!), 'moonbase')
  assert.equal(companionProblem(moved), null, 'the saved record is valid')
  assert.deepEqual(S.HOME_ORDER, ['grove', 'moonbase', 'loft'])
})

test('it grows on the original ladder, with the original thresholds', () => {
  const egg = adventurer()
  assert.equal(S.originalStage(egg), 'egg')
  const c = hatched(egg)
  assert.equal(S.originalStage(c), 'sprout')
  for (const { stage, at } of v1.GROWTH) assert.equal(S.originalStage(withCounts(c, { fed: at })), stage, `${at} points`)
  assert.equal(S.originalStage(withCounts(c, { arcade: 100 })), 'explorer', 'arcade runs count double')
  const p = S.originalProgress(withCounts(c, { fed: 20 }))
  assert.deepEqual([p.stage, p.points, p.next?.stage, p.pct], ['sprout', 20, 'cadet', 50])
  const top = S.originalProgress(withCounts(c, { fed: 900 }))
  assert.deepEqual([top.stage, top.next, top.pct], ['guardian', null, 100])
  assert.deepEqual(STAGES, ['egg', 'sprout', 'cadet', 'explorer', 'guardian'])
})

test('the scene shows what the care rules say: asleep, low, the need, the egg’s cracks', () => {
  const c = hatched(adventurer())
  const f = S.originalFrame(c, 0, T0 + 2000)
  assert.deepEqual([f.home, f.stage, f.asleep, f.low, f.need, f.crack], ['grove', 'sprout', false, false, null, 0])
  const rest = careFor(c, { do: 'rest' }, T0 + 3000).companion!
  assert.equal(S.originalFrame(rest, 0, T0 + 4000).asleep, true)
  // left alone for half a day it is low, and says what it needs most (as in the reference video: a sad face and a thought bubble)
  const later = S.originalFrame(c, 0, T0 + 12 * 3_600_000)
  assert.equal(later.low, true); assert.equal(later.need, 'fun')
  assert.equal(v1.mood(v1.settle(asPet(c), T0 + 12 * 3_600_000)).need, later.need, 'the same rules as the care meters')
  // and left a whole day, it has curled up asleep by itself, as the original does
  const night = S.originalFrame(c, 0, T0 + 24 * 3_600_000)
  assert.deepEqual([night.asleep, night.low, night.need], [true, false, null])
  assert.equal(S.originalFrame(adventurer(), 2, T0).crack, 2)
})

test('a first-version Cozmling is shown exactly as itself', () => {
  const pet = { ...v1.adopt('Pip', { form: 'girl', body: 3, glow: 1, eyes: 1 }, 'moonbase', T0), hatched: T0, fed: 45 }
  const c = { schemaVersion: 2, kind: 'legacy', companionId: 'test-legacy-1', revision: 0, createdAt: T0, updatedAt: T0, hatch: { status: 'hatched', hatchedAt: T0, provenance: 'known' }, walletLinks: [],
    legacy: { pet, stageFloor: 'explorer', growthFloor: 0, sourceKey: 'cozmc-cozmling-v1' } } as unknown as Companion
  assert.deepEqual(S.originalLook(c), pet.look); assert.equal(S.originalHome(c), 'moonbase')
  assert.equal(S.originalStage(c), 'explorer', 'never shown below the stage it arrived with')
  assert.equal(S.drawnOriginal(c), true)
})

test('the original scene is the default for adventurers; the concept-art figures are kept, not removed', async () => {
  assert.equal(S.ADVENTURER_SCENE, 'original')
  assert.equal(S.drawnOriginal(adventurer()), true)
  const { readFileSync } = await import('node:fs')
  assert.match(readFileSync(new URL('../src/cozmling/render/AdventurerRenderer.tsx', import.meta.url), 'utf8'), /export const AdventurerRenderer/)
})
