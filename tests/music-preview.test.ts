/* The two-second music preview: measured from actual playback, paused once, out of the way when the
   visitor takes over. `npm test`. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPreview } from '../src/lib/musicPreview'

// a fake clock and a player whose position only advances while it plays
function rig() {
  let now = 0, position = 10, playing = false, pauses = 0, notes = 0
  const due: { at: number; fn: () => void; id: number }[] = []
  let ids = 0
  const timers = {
    set: (fn: () => void, ms: number) => { const id = ++ids; due.push({ at: now + ms, fn, id }); return id },
    clear: (id: unknown) => { const i = due.findIndex(d => d.id === id); if (i >= 0) due.splice(i, 1) },
  }
  const player = { position: () => position, pause: () => { pauses++; playing = false } }
  const preview = createPreview(player, () => { notes++ }, timers)
  const advance = (ms: number) => {
    const end = now + ms
    for (;;) {
      due.sort((a, b) => a.at - b.at)
      const next = due[0]
      if (!next || next.at > end) break
      if (playing) position += (next.at - now) / 1000
      now = next.at
      due.shift()
      next.fn()
    }
    if (playing) position += (end - now) / 1000
    now = end
  }
  return {
    preview, advance,
    play: () => { playing = true; preview.playing() },
    stall: () => { playing = false; preview.stalled() },
    get pauses() { return pauses }, get notes() { return notes }, get position() { return position },
  }
}

test('nothing happens until the music actually plays', () => {
  const r = rig()
  r.advance(10_000)            // loading, or autoplay blocked: no pause, no note
  assert.equal(r.preview.state, 'waiting')
  assert.deepEqual([r.pauses, r.notes], [0, 0])
})

test('two seconds after sound starts, it pauses once and shows the note', () => {
  const r = rig()
  r.advance(3000)              // the player takes three seconds to load: that doesn't count
  r.play()
  r.advance(1900)
  assert.deepEqual([r.pauses, r.notes], [0, 0])
  r.advance(200)
  assert.deepEqual([r.pauses, r.notes], [1, 1])
  assert.equal(r.preview.state, 'paused')
  assert.ok(Math.abs(r.position - 12) < 0.05, `paused after two seconds of music (${r.position})`)
  r.advance(10_000)
  assert.deepEqual([r.pauses, r.notes], [1, 1], 'only once')
})

test('buffering in the middle does not count toward the two seconds', () => {
  const r = rig()
  r.play(); r.advance(1200)
  r.stall(); r.advance(5000)   // buffering for five seconds
  assert.deepEqual([r.pauses, r.notes], [0, 0])
  r.play(); r.advance(700)
  assert.equal(r.pauses, 0)
  r.advance(200)
  assert.deepEqual([r.pauses, r.notes], [1, 1])
})

test('when the visitor takes over, the preview never pauses for them', () => {
  const r = rig()
  r.play(); r.advance(1000)
  r.preview.takeOver()
  r.advance(10_000)
  assert.deepEqual([r.pauses, r.notes], [0, 0])
  assert.equal(r.preview.state, 'off')
  // and playing again later is just playing
  r.play(); r.advance(10_000)
  assert.equal(r.pauses, 0)
})
