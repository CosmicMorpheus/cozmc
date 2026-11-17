/* Care and growth across days, by the rules the site uses (src/companion/care.ts and src/cozmling/domain/care.ts).
   - How much care counts toward growing up in a day, so tapping a button can't skip stages; the care itself
     (more food, more fun) always works.
   - Asleep, the page says what it will want when it wakes, instead of hiding it.
   - A Starprint's first visit of the day, and arcade runs, count toward growing up, once each.
   - Casual, regular and very active players over two weeks: steady play grows it, spamming doesn't beat it,
     and nobody's earlier progress is lowered. (The care values themselves are unchanged here: rebalancing them
     is a separate decision.) */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { adopt, DAILY_COUNTED, feed, FOODS, growthPoints, mood, pat, play, settle, toggleSleep, utcDay, type Pet } from '../src/companion/care'
import { arcadeCheer, asPet, dailyVisit } from '../src/cozmling/domain/care'
import { newAdventurer } from '../src/cozmling/domain/adventurer'
import { provisionalStarprint } from '../src/cozmling/celestial/chart'
import type { AdventurerCompanion } from '../src/cozmling/types'

const H = 3_600_000, D = 24 * H
const T0 = Date.UTC(2026, 10, 18)
const LOOK = { form: 'boy', body: 0, glow: 0, eyes: 0 } as const
const hatchedPet = (at = T0): Pet => ({ ...adopt('Orbi', LOOK, 'loft', at), hatched: at })

test('only the first few feeds, plays and pats of a UTC day count toward growing up; the care itself always works', () => {
  let p = hatchedPet()
  for (let i = 0; i < 200; i++) p = pat(p).pet
  assert.equal(p.pets, DAILY_COUNTED.pets, '200 pats count as 10')
  assert.equal(p.fun, 100, 'every pat still cheers it up')
  assert.equal(growthPoints(p), 2, 'so 200 pats are worth 2 growth points, not 40')

  p = { ...p, food: 0 }
  for (let i = 0; i < 8; i++) { p = feed({ ...p, food: 0 }, FOODS[2]).pet }
  assert.equal(p.fed, DAILY_COUNTED.fed, 'eight feeds count as five')
  for (let i = 0; i < 8; i++) p = play({ ...p, energy: 100 }).pet
  assert.equal(p.played, DAILY_COUNTED.played, 'eight plays count as five')

  // the next UTC day counts again
  const tomorrow = settle(p, T0 + D + H)
  const q = pat(feed({ ...tomorrow, food: 10, asleep: null }, FOODS[0]).pet).pet      // awake again
  assert.equal(q.fed, DAILY_COUNTED.fed + 1)
  assert.equal(q.pets, DAILY_COUNTED.pets + 1)
  assert.equal(q.tally?.day, utcDay(T0 + D + H))
})

test('progress from before the daily limits is kept as it was', () => {
  const veteran: Pet = { ...hatchedPet(), fed: 300, played: 250, pets: 900, arcade: 40, cheered: 12, checkins: 30 }
  const before = growthPoints(veteran)
  const after = pat(play(feed({ ...veteran, food: 10 }, FOODS[0]).pet).pet).pet
  assert.ok(growthPoints(after) >= before, 'nothing is taken away')
  assert.equal(after.fed, 301); assert.equal(after.played, 251)
})

test('asleep, it says plainly what it will want when it wakes', () => {
  const sleepy = toggleSleep({ ...hatchedPet(), energy: 40 }, T0).pet
  assert.match(mood({ ...sleepy, food: 10 }).line, /fast asleep\. It’ll be hungry when it wakes\./)
  assert.match(mood({ ...sleepy, food: 60, fun: 10 }).line, /It’ll want to play when it wakes\./)
  assert.doesNotMatch(mood({ ...sleepy, food: 60, fun: 60 }).line, /when it wakes/)
})

function starprint(hatched = true): AdventurerCompanion {
  const c = newAdventurer({ name: 'Vega', birthday: '2026-11-04', look: 'a', skin: 'teal' }, { companionId: crypto.randomUUID(), now: T0, starprint: provisionalStarprint('2026-11-04', T0) ?? undefined })
  return hatched ? { ...c, hatch: { status: 'hatched', hatchedAt: T0, provenance: 'known' }, care: { ...c.care, settledAt: T0 } } : c
}

test('a Starprint’s first visit of the day counts once toward growing up', () => {
  const c = starprint()
  const visited = dailyVisit(c, T0 + 2 * H) as AdventurerCompanion
  assert.equal(asPet(visited).checkins, 1)
  assert.equal(dailyVisit(visited, T0 + 5 * H), null, 'a second visit (or a second tab) the same day changes nothing')
  const nextDay = dailyVisit(visited, T0 + D + H) as AdventurerCompanion
  assert.equal(asPet(nextDay).checkins, 2)
  assert.equal(growthPoints(asPet(nextDay)), 20, 'each counted visit is worth what a daily check-in always was')
  assert.equal(dailyVisit(starprint(false), T0), null, 'an egg isn’t visited yet')
})

test('arcade runs cheer up a Starprint (not only a first-version Cozmling), and a sleeping one is left to sleep', () => {
  const c = starprint()
  const { companion, outcome } = arcadeCheer({ ...c, care: { ...c.care, fun: 50 } }, { daily: true, best: false }, T0 + H)
  assert.ok(companion && companion.kind === 'adventurer')
  assert.equal(asPet(companion).arcade, 1)
  assert.ok(outcome.fun > 0 && outcome.energy < 0)
  const asleep = { ...c, care: { ...c.care, asleepAt: T0, energy: 40 } }
  assert.equal(arcadeCheer(asleep, { daily: false, best: false }, T0 + H).companion, null)
})

/* Two weeks of three kinds of player, by today's care values, with the daily limits. */
type Visit = { at: number; actions: string[] }
function twoWeeks(visitsFor: (day: number) => Visit[], days = 14) {
  let p = hatchedPet()
  for (let d = 0; d < days; d++) for (const v of visitsFor(d)) {
    const now = T0 + d * D + v.at
    p = settle(p, now)
    for (const a of v.actions) {
      const o = a === 'wake' ? (p.asleep ? toggleSleep(p, now) : { ok: true, pet: p, say: '' })
        : a === 'bed' ? (p.asleep ? { ok: true, pet: p, say: '' } : toggleSleep(p, now))
        : a.startsWith('feed:') ? feed(p, FOODS.find(f => f.id === a.slice(5))!) : a === 'play' ? play(p) : pat(p)
      p = o.pet
    }
  }
  return growthPoints(p)
}
const casual = (d: number): Visit[] => d % 2 === 0 ? [{ at: 19 * H, actions: ['wake', 'feed:cheese', 'feed:starfruit', 'play', 'play', 'pat', 'pat', 'pat'] }] : []
const regular = (): Visit[] => [{ at: 19 * H, actions: ['wake', 'feed:cheese', 'feed:starfruit', 'play', 'play', 'play', 'play', 'pat', 'pat', 'pat', 'pat', 'pat'] }]
const spammer = (): Visit[] => [{ at: 19 * H, actions: ['wake', ...Array(40).fill('feed:cookie'), ...Array(60).fill('play'), ...Array(500).fill('pat')] }]

test('over two weeks, steady care grows a Cozmling and button-mashing can’t race ahead of it', () => {
  const c = twoWeeks(casual), r = twoWeeks(regular), s = twoWeeks(spammer)
  assert.ok(c > 0 && r > c, `regular care grows faster than occasional care (${r} vs ${c})`)
  // the most a day of mashing can count: 5 feeds, 5 plays and 10 pats
  const ceiling = 14 * (DAILY_COUNTED.fed + DAILY_COUNTED.played + Math.floor(DAILY_COUNTED.pets / 5))
  assert.ok(s <= ceiling, `spamming is held to the daily limits (${s} ≤ ${ceiling})`)
  assert.ok(s < 2 * r, `and stays within reach of steady care (${s} vs ${r})`)
})
