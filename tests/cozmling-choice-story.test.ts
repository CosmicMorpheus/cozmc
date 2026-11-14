/* The first choice story, The Bridge After the Rain: every route works, the opening leaves the decision
   to the player, every Starprint gets the same scenes, choices and endings (only its voice lines
   differ), and a reading is kept exactly as it was shown. `npm test`. */
import { test } from 'node:test'
import assert from 'node:assert/strict'

;(globalThis as any).localStorage = { length: 0, key: () => null, getItem: () => null, setItem() {}, removeItem() {} }
const { BRIDGE } = await import('../src/cozmling/story/bridge')
const { scene, next, routes, storyProblems, runRecord, asChoiceRun, choiceEventId } = await import('../src/cozmling/story/choice')
const { VOICES, ARCHETYPES, MOMENTS, voiceOf } = await import('../src/cozmling/story/voices')
const { SIGNS } = await import('../src/cozmling/domain/starprint')
const { newAdventurer } = await import('../src/cozmling/domain/adventurer')

const words = (s: string) => s.trim().split(/\s+/).length
const plain = (sc: ReturnType<typeof scene>) => ({ text: sc.paragraphs.filter(p => !p.voice).map(p => p.text), prompt: sc.prompt, choices: sc.choices, ending: sc.ending })

test('the bridge is a sound story: six routes, four endings, no dead ends or loops', () => {
  assert.deepEqual(storyProblems(BRIDGE, ARCHETYPES), [])
  assert.deepEqual(routes(BRIDGE).map(r => `${r.picks.join(' ')} → ${r.path[r.path.length - 1]}`).sort(), ['A A1 → E1', 'A A2 → E2', 'B B1 → E1', 'B B2 → E3', 'C C1 → E1', 'C C2 → E4'])
  assert.equal(next(BRIDGE, 'S0', 'B'), 'S1B'); assert.equal(next(BRIDGE, 'S0', 'Z'), null)
  for (const id of ['E1', 'E2', 'E3', 'E4']) assert.ok(BRIDGE.nodes[id].ending!.invitation && BRIDGE.nodes[id].ending!.reflection)
  assert.equal(BRIDGE.status, 'draft', 'a draft: shown only on the preview site and in local work')
})

test('the opening leaves the decision to the player: three equally offered first steps, and voices that lean toward none of them', () => {
  const sc = scene(BRIDGE, 'S0', { name: 'Orbi', archetype: 'Pathfinder' })
  assert.deepEqual(sc.choices.map(c => [c.id, c.label]), [['A', 'Look closely at what happened.'], ['B', 'Ask a friend to help make a new plan.'], ['C', 'Rest together and return later.']])
  assert.equal(sc.prompt, 'What would you like to do first?')
  // the voice line sits after the friend arrives, before the question
  assert.deepEqual(sc.paragraphs.map(p => !!p.voice), [false, false, false, true])
  assert.match(sc.paragraphs[0].text, /^Yesterday, Orbi built a small bridge/)
  for (const a of ARCHETYPES) {
    const o = BRIDGE.openings[a]
    assert.ok(words(o) <= 20, `${a}: ${words(o)} words`)
    assert.doesNotMatch(o, /\b(ask|asks|asking|rest|rests|resting|plan|plans|sketch|look closely|inspect|fix)\b/i, `${a}'s opening shouldn't start one of the paths: ${o}`)
  }
  assert.equal(new Set(Object.values(BRIDGE.openings)).size, 12, 'twelve different openings')
  assert.equal(BRIDGE.openings.Pathfinder, 'Oh. This was supposed to be the good part of the morning.')
  assert.equal(BRIDGE.openings['Radiant Heart'], 'It wants to say something brave, then finds it doesn’t have to yet.', 'the one draft line the review kept')
})

test('every Starprint gets the same scenes, choices and endings; only its voice lines differ', () => {
  for (const r of routes(BRIDGE)) {
    let arrivedBy: string | undefined
    r.path.forEach((id, i) => {
      const none = scene(BRIDGE, id, { name: 'Orbi', archetype: null }, arrivedBy)
      const lines = new Set<string>()
      for (const a of ARCHETYPES) {
        const sc = scene(BRIDGE, id, { name: 'Orbi', archetype: a }, arrivedBy)
        assert.deepEqual(plain(sc), plain(none), `${a} at ${id}`)
        const v = sc.paragraphs.filter(p => p.voice).map(p => p.text)
        assert.equal(v.length, BRIDGE.nodes[id].voice ? 1 : 0, `${a} at ${id}`)
        v.forEach(t => lines.add(t))
      }
      if (BRIDGE.nodes[id].voice) assert.equal(lines.size, 12, `twelve voices at ${id}`)
      arrivedBy = r.picks[i]
    })
  }
  // the moments the bridge gives a voice to, after the player has chosen
  const v = (id: string, a: any, by?: string) => scene(BRIDGE, id, { name: 'Orbi', archetype: a }, by).paragraphs.find(p => p.voice)!.text
  assert.equal(v('S1A', 'Keeper', 'A'), VOICES.Keeper.noticing)
  assert.equal(v('S1B', 'Builder', 'B'), VOICES.Builder['asking-for-help'])
  assert.equal(v('S1C', 'Dreamer', 'C'), VOICES.Dreamer.resting)
  assert.equal(v('E1', 'Messenger', 'C1'), VOICES.Messenger['small-win'])
  // and which archetype speaks: its Starprint's
  for (const s of SIGNS) {
    const c = newAdventurer({ name: 'Orbi', birthday: `2026-${String(s.from[0]).padStart(2, '0')}-${String(s.from[1] + 2).padStart(2, '0')}`, look: 'a', skin: 'sky' }, { companionId: `test-voice-${s.sign}`, now: Date.parse('2026-11-13T12:00:00Z') })
    assert.equal(voiceOf(c), s.archetype, s.sign)
  }
})

test('where routes meet, the ending says how you got there; each reading is kept as it was shown', () => {
  const who = { name: 'Orbi', archetype: 'Harmonizer' as const }, times = { startedAt: 1, finishedAt: 2 }
  const a1 = runRecord(BRIDGE, who, ['A', 'A1'], times), b1 = runRecord(BRIDGE, who, ['B', 'B1'], times), c1 = runRecord(BRIDGE, who, ['C', 'C1'], times)
  for (const r of [a1, b1, c1]) assert.equal(r.ending.id, 'E1')
  assert.deepEqual([a1.path, b1.path, c1.path], [['S0', 'S1A', 'E1'], ['S0', 'S1B', 'E1'], ['S0', 'S1C', 'E1']])
  assert.equal(new Set([a1, b1, c1].map(r => r.shown.scenes[2].paragraphs[0])).size, 3, 'three different first lines in “A new plan”')
  assert.equal(new Set([a1, b1, c1].map(r => JSON.stringify(r))).size, 3, 'three different records')
  // the record is the text exactly as shown, with every choice that was offered
  const c2 = runRecord(BRIDGE, who, ['C', 'C2'], times)
  assert.deepEqual(c2.choices, [{ node: 'S0', id: 'C', label: 'Rest together and return later.' }, { node: 'S1C', id: 'C2', label: 'Leave a safe-path note for visitors and stop for today.' }])
  assert.deepEqual(c2.ending, { id: 'E4', title: 'Enough for today', outcome: 'The crossing closed, a safe path marked, and time to rest.' })
  assert.deepEqual(c2.shown.scenes.map(s => s.paragraphs), [scene(BRIDGE, 'S0', who), scene(BRIDGE, 'S1C', who, 'C'), scene(BRIDGE, 'E4', who, 'C2')].map(s => s.paragraphs.map(p => p.text)))
  assert.deepEqual(c2.shown.scenes[0].offered, ['Look closely at what happened.', 'Ask a friend to help make a new plan.', 'Rest together and return later.'])
  assert.equal(c2.shown.invitation, 'If you need a pause, let yourself take one. You can come back later.')
  assert.deepEqual([c2.storyId, c2.version, c2.shown.voice, c2.provenance.label, c2.replayOf], ['bridge-after-rain', 'draft-0.3', 'Harmonizer', 'Original COZMC draft story', null])
  assert.deepEqual(asChoiceRun(JSON.parse(JSON.stringify(c2))), c2, 'it survives being saved')
  // reading it again is a new record that points to the first
  const again = runRecord(BRIDGE, who, ['A', 'A2'], times, 'choice:first')
  assert.equal(again.replayOf, 'choice:first')
  const r1 = { startedAt: 1_700_000_000_000, nonce: 'a1b2c3d4' }, id1 = choiceEventId('c1', BRIDGE, r1)
  assert.match(id1, /^choice:c1:bridge-after-rain@draft-0\.3:/)
  assert.equal(choiceEventId('c1', BRIDGE, { ...r1 }), id1, 'the same reading saved twice (a double tap, a retry) has one id, so it is kept once')
  assert.notEqual(choiceEventId('c1', BRIDGE, { startedAt: r1.startedAt, nonce: 'e5f6a7b8' }), id1, 'two readings, two records, even begun in the same millisecond')
  assert.throws(() => runRecord(BRIDGE, who, ['A'], times)); assert.throws(() => runRecord(BRIDGE, who, ['A', 'Z'], times))
  // nothing in a reading is a reward, a score or a rank
  assert.deepEqual(Object.keys(c2).sort(), ['choices', 'ending', 'finishedAt', 'path', 'provenance', 'replayOf', 'schema', 'shown', 'startedAt', 'storyId', 'title', 'version'])
})

test('the 72 Starprint voice lines: twelve archetypes, six moments, short, and never a forecast', () => {
  assert.equal(ARCHETYPES.length, 12); assert.deepEqual(new Set(ARCHETYPES), new Set(SIGNS.map(s => s.archetype)))
  let n = 0
  for (const a of ARCHETYPES) for (const m of MOMENTS) {
    const line = VOICES[a][m]
    assert.ok(line && words(line) <= 20, `${a} ${m}`)
    assert.doesNotMatch(line, /\b(destined|guarantee[sd]?|you will|will happen|lucky|unlucky)\b|'|\{/i, `${a} ${m}: ${line}`)
    n++
  }
  assert.equal(n, 72)
  for (const m of MOMENTS) assert.equal(new Set(ARCHETYPES.map(a => VOICES[a][m])).size, 12, `twelve different ${m} lines`)
})
