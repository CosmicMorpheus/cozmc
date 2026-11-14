/* ============================================================
   A STORY MODE TEST SAVE: for the preview site and local work only.

   Lets a tester play Story Mode on a simulated story day, a day at a time, without touching the
   Cozmling's real save. It lives in its own IndexedDB database, so its story, its simulated day and
   its runs are kept apart from every regular save, and nothing in it is ever exported or shown in
   Memories. Only the preview tools (behind COZMLING_DEV) use this file; a production build leaves
   it out entirely.

   - Its simulated story day is kept with it, one per Cozmling.
   - "Advance one story day" moves that day on by exactly one, from the day the tester was looking at:
     the same advance tried twice (a double tap, a retry) moves it once.
   - "Reset test story" starts a new run from today: the earlier run's events stay where they are,
     unread, and the regular save is never touched.
   - A story-only growth stage lets a test reach a story for an older Cozmling without growing one.
   ============================================================ */
import type { Stage } from '../../companion/look'
import { indexedDbRepository } from '../store/indexedDbRepository'
import { memoryRepository } from '../store/memoryRepository'
import type { Repository } from '../store/repository'
import type { JourneyEvent } from '../types'
import { addDays } from './world'

export const TEST_DB = 'cozmc-cozmling-v2-story-test'
export interface TestSave {
  schema: 1
  /** Story Mode reads the test save (true) or the regular one (false) */
  active: boolean
  /** the run: 'Reset test story' starts the next */
  run: number
  /** the simulated story day */
  day: string
  /** the growth stage Story Mode uses in the test save (null: the Cozmling's own) */
  stage: Stage | null
  startedAt: number
}

let repo: Promise<Repository> | null = null
/** The test save's own database (or, where the browser stores nothing, one for this visit). */
export const testRepo = () => (repo ??= indexedDbRepository(TEST_DB).then(r => r ?? memoryRepository()))
/** For tests: start from an empty test database. */
export const useTestRepo = (r: Repository) => { repo = Promise.resolve(r) }

const key = (companionId: string) => `story-test:${companionId}`
export const testRun = (s: TestSave) => `test-${s.run}`
const valid = (v: unknown): v is TestSave => { const s = v as TestSave | null; return !!s && s.schema === 1 && typeof s.run === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(s.day) }

// one change at a time, so a double tap is seen against the change before it
let turn: Promise<unknown> = Promise.resolve()
const inTurn = <T,>(f: () => Promise<T>): Promise<T> => { const p = turn.then(f, f); turn = p.catch(() => {}); return p }

export async function readTestSave(companionId: string): Promise<TestSave | null> {
  const v = (await (await testRepo()).load()).meta[key(companionId)]
  return valid(v) ? v : null
}
async function write(companionId: string, s: TestSave): Promise<TestSave> {
  const res = await (await testRepo()).write({ meta: { [key(companionId)]: s } })
  if (!res.ok) throw new Error(`The test save couldn’t be written: ${res.detail}`)
  return s
}

/** Use the test save (making one from today, at the Cozmling's own stage, the first time). */
export const startTestSave = (companionId: string, today: string) => inTurn(async () => {
  const s = await readTestSave(companionId)
  return write(companionId, s ? { ...s, active: true } : { schema: 1, active: true, run: 1, day: today, stage: null, startedAt: Date.now() })
})
/** Go back to the regular save. The test save stays as it is, for next time. */
export const leaveTestSave = (companionId: string) => inTurn(async () => {
  const s = await readTestSave(companionId)
  return s ? write(companionId, { ...s, active: false }) : null
})
/** One story day on from `fromDay`, the day the tester was looking at. If the day has already moved on (the same advance, tried again), nothing changes. */
export const advanceTestDay = (companionId: string, fromDay: string) => inTurn(async () => {
  const s = await readTestSave(companionId)
  if (!s || s.day !== fromDay) return s
  return write(companionId, { ...s, day: addDays(fromDay, 1) })
})
/** A new run from today: its story starts again. The earlier run's events stay, unread; the regular save is untouched. */
export const resetTestStory = (companionId: string, today: string) => inTurn(async () => {
  const s = await readTestSave(companionId)
  return write(companionId, { schema: 1, active: true, run: (s?.run ?? 0) + 1, day: today, stage: s?.stage ?? null, startedAt: Date.now() })
})
/** The growth stage Story Mode uses in the test save (null: the Cozmling's own). The Cozmling itself doesn't change. */
export const setTestStage = (companionId: string, stage: Stage | null) => inTurn(async () => {
  const s = await readTestSave(companionId)
  return s ? write(companionId, { ...s, stage }) : null
})

/** The test save's story events for this Cozmling. */
export const testEvents = async (companionId: string): Promise<JourneyEvent[]> => (await testRepo()).events(companionId)
/** Keep one event in the test save, once (the same id is refused the second time). */
export async function keepTestEvent(e: JourneyEvent): Promise<{ ok: true; kept: boolean } | { ok: false; detail: string }> {
  const res = await (await testRepo()).write({ events: [e] })
  return res.ok ? { ok: true, kept: true } : res.reason === 'duplicate' ? { ok: true, kept: false } : { ok: false, detail: res.detail }
}
