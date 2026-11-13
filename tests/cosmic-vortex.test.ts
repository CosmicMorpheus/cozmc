/* The Cosmic Vortex's arithmetic: loops that never jump, a pixel budget for phones, the shape of
   the disk, and a repeatable sky. `npm test`. (The drawing itself is checked in a browser, in
   tests/celestial-sky.mjs.) */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { along, diskFor, diskHeight, DISK, dprFor, ORIGIN_PALETTE, ringFade, ringPhase, rng, streakAt, twinkle } from '../src/cozmling/render/cosmicVortex'

test('the same seed always gives the same sky, and a different seed a different one', () => {
  const a = rng('origin'), b = rng('origin'), c = rng('another')
  const xs = Array.from({ length: 50 }, () => a()), ys = Array.from({ length: 50 }, () => b()), zs = Array.from({ length: 50 }, () => c())
  assert.deepEqual(xs, ys)
  assert.notDeepEqual(xs, zs)
  assert.ok(xs.every(x => x >= 0 && x < 1))
})

test('the canvas never goes past its pixel budget, and is never sharper than the screen', () => {
  for (const [w, h, dpr] of [[390, 844, 3], [360, 740, 2], [1280, 900, 1], [1920, 1080, 2], [2560, 1440, 2], [3840, 2160, 1.5]] as const) {
    const d = dprFor(w, h, dpr)
    assert.ok(d <= dpr && d <= 1.5 && d >= 0.5, `${w}×${h}@${dpr}: ${d}`)
    assert.ok(w * h * d * d <= 2_600_000 * 1.0001, `${w}×${h}@${dpr}: ${Math.round(w * h * d * d)} pixels`)
  }
  assert.equal(dprFor(390, 844, 3), 1.5)            // a phone gets a sharp, but not full-resolution, sky
})

test('the disk: wider than the sphere on both sides, reaching above and below it, tilted a little', () => {
  const d = diskFor(100)
  assert.ok(d.rIn > 100 && d.rOut > d.rIn * 2)
  assert.ok(diskHeight(100) > 100, 'some of it shows above and below the wheel')
  assert.ok(DISK.k > 0.2 && DISK.k < 0.6, 'seen from a little above, not edge-on or face-on')
  assert.ok(Math.abs(DISK.tilt) < 0.3)
})

test('the rings drift inward forever, and only ever wrap round while invisible', () => {
  const n = 46, period = 150
  for (let i = 0; i < n; i++) {
    let prev = ringPhase(i, n, 0)
    for (let t = 0.05; t <= period * 1.2; t += 0.05) {
      const s = ringPhase(i, n, t)
      if (Math.abs(s - prev) > 0.5) assert.ok(ringFade(prev) < 0.03 && ringFade(s) < 0.03, `ring ${i} wraps visibly at ${t.toFixed(2)}s`)
      else assert.ok(prev - s >= 0 && prev - s < 0.001, `ring ${i} moves smoothly inward`)
      prev = s
    }
  }
})

test('streaks of light only restart while invisible', () => {
  for (const [period, offset] of [[8, 0], [11.3, 0.4], [14.9, 0.93]]) {
    let prev = streakAt(0, period, offset)
    for (let t = 0.02; t <= period * 2.5; t += 0.02) {
      const now = streakAt(t, period, offset)
      if (now.u < prev.u) assert.ok(prev.alpha < 0.03 && now.alpha < 0.03, `restarts visibly at ${t.toFixed(2)}s`)
      prev = now
    }
  }
})

test('stars twinkle smoothly between dim and bright', () => {
  let prev = twinkle(0, 1.7, 0.3)
  for (let t = 0.01; t < 20; t += 0.01) {
    const k = twinkle(t, 1.7, 0.3)
    assert.ok(k >= 0 && k <= 1 && Math.abs(k - prev) < 0.02)
    prev = k
  }
})

test('the palette is crimson, gold and midnight, as in the references', () => {
  const p = ORIGIN_PALETTE
  assert.ok(p.edge[0] > 2 * p.edge[2], 'cloud edges are crimson')
  assert.ok(p.dust[1][0] > p.dust[1][2] * 1.5 && p.dust[1][1] > 150, 'the disk is gold')
  assert.ok(p.wash[2] > p.wash[0] * 2, 'the dark has midnight blue in it')
  assert.deepEqual(along(p.dust, 0), [...p.dust[0]]); assert.deepEqual(along(p.dust, 1), [...p.dust[p.dust.length - 1]])
  assert.deepEqual([...p.dust[p.dust.length - 1]], [0, 191, 254], 'the disk cools to Nebula Cyan, #00BFFE')
  assert.deepEqual([...p.streak[0]], [0, 191, 254])
})

test('no new library was added for it', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@galaxypay/use-wallet-lute', '@phosphor-icons/react', '@txnlab/use-wallet-defly', '@txnlab/use-wallet-exodus', '@txnlab/use-wallet-pera', '@txnlab/use-wallet-react', 'algosdk', 'astronomy-engine', 'react', 'react-dom'])
})
