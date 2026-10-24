import type { ArcadeGame, GameHooks, StartOptions } from '../types'
import { TIER_SKINS } from '../types'
import { sfx } from '../sfx'
import { rng } from '../../lib/daily'
import { ASTRO_R as R, HELMETS, SPRITES, astronaut, sprite } from './space'

/* ============================================================
   MOONSHOT: a launch game in the spirit of Kitten Cannon.
   Tap to lock the cannon's angle, tap again to lock its power,
   and the astronaut flies across the moon. Fuel cans blast you on,
   pads bounce you up, black holes swallow you (skim the edge to
   slingshot), octos grab you. Three jetpack puffs to steer.
   Score = metres flown + coin and slingshot bonuses.
   192×144 logical pixels, camera follows the flight.
   ============================================================ */

const W = 192, H = 144, GROUND = 124
const PIVOT_X = 20, PIVOT_Y = GROUND - 9, BARREL = 15
const START_X = PIVOT_X                               // distance is measured from the cannon
const PX_PER_M = 2
const G = 70, V_MIN = 70, V_MAX = 285, V_CAP = 600, ROLL = 88
const ANG_MIN = 12, ANG_MAX = 78, ANG_PERIOD = 1.6, POW_PERIOD = 1.05
const PUFFS = 3
const HOLE_PULL = 26000, HOLE_REACH = 36, HOLE_CORE = 5

type Kind = 'fuel' | 'pad' | 'rock' | 'sat' | 'coin' | 'crater' | 'octo' | 'hole' | 'fire'
interface Obj { kind: Kind; x: number; y: number; used: boolean; t: number; inside?: boolean; minD?: number; squash?: number }
interface Pop { x: number; y: number; text: string; t: number; color: string }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; color: string; g: number }
type Phase = 'aim' | 'power' | 'fly' | 'stopped' | 'grabbed' | 'captured'

/* ---------------- art ---------------- */
const ART: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  fuel: {
    pal: { a: '#7a1408', b: '#ff3d2e', w: '#f1efe6', y: '#ffd13a' },
    rows: ['.aaaaaa.', 'abbbbbba', 'awwwwwwa', 'abbbbbba', 'abbyybba', 'abyyybba', 'abbyybba', 'abbbbbba', 'awwwwwwa', '.aaaaaa.'],
  },
  rock: {
    pal: { a: '#3d3833', b: '#6e655c', c: '#4d463f' },
    rows: ['..aaaaa..', '.abbbbba.', 'abbcbbbba', 'abbbbbcba', 'abcbbbbba', 'abbbbbbba', '.abbbcba.', '..aaaaa..'],
  },
  sat: {
    pal: { p: '#2a4fd6', q: '#59e6ff', e: '#c9ccd6', b: '#9aa0ad', d: '#ff2d2d' },
    rows: ['pppp.....pppp', 'pqqp..e..pqqp', 'ppppebbbepppp', 'pqqp.bbb.pqqp', 'pppp..d..pppp'],
  },
  fire: {
    pal: { a: '#ff2d2d', b: '#ff6a1a', c: '#ffd13a', l: '#5a3a1a' },
    rows: ['....a....', '...aa....', '...aba...', '..abba.a.', '.abbbbaa.', '.abbcbba.', 'abbcccbba', 'abcccccba', '.abcccba.', '..lllll..'],
  },
}
const WEIGHTS = (m: number): [Kind, number][] => {
  const late = Math.min(1, m / 2000)                  // further out, the moon gets meaner
  // nothing that ends a run in the first stretch: no octos before 150 m, no black holes before 300 m
  return [['fuel', 20 - 4 * late], ['pad', 22 - 6 * late], ['rock', 10], ['sat', 6 + 2 * late], ['coin', 16 - 4 * late],
    ['crater', 9 + 4 * late], ['octo', m < 150 ? 0 : 5 + 9 * late], ['hole', m < 300 ? 0 : 3 + 8 * late], ['fire', 6 - 2 * late]]
}
const tri = (x: number) => 1 - Math.abs(((x % 1) + 1) % 1 * 2 - 1)   // 0 → 1 → 0
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s) }
const noise = (x: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i) * (1 - u) + hash(i + 1) * u }

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, size = 8, align: CanvasTextAlign = 'center') {
  ctx.font = `700 ${size}px Silkscreen`; ctx.textAlign = align
  ctx.fillStyle = '#000'; ctx.fillText(s, Math.round(x) + 1, Math.round(y) + 1)
  ctx.fillStyle = color; ctx.fillText(s, Math.round(x), Math.round(y))
  ctx.textAlign = 'left'
}

/** The cannon, pixel by pixel so the rotated barrel stays crisp. */
function cannon(ctx: CanvasRenderingContext2D, x: number, y: number, deg: number, flash = 0) {
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a)
  for (let yy = -BARREL - 3; yy <= 4; yy++) for (let xx = -4; xx <= BARREL + 3; xx++) {
    // local barrel coords: u along the barrel, v across it
    const u = xx * ca - yy * sa, v = xx * sa + yy * ca
    if (u < -2 || u > BARREL || Math.abs(v) > 3.2) continue
    const rim = u > BARREL - 2.5, edge = Math.abs(v) > 2.2
    ctx.fillStyle = rim ? '#d9ffcf' : edge ? '#2c6b1f' : Math.floor(u / 4) % 2 ? '#8dff6a' : '#6fd64f'
    ctx.fillRect(x + xx, y + yy, 1, 1)
  }
  // carriage + wheel
  ctx.fillStyle = '#3a3a41'; ctx.fillRect(x - 7, y + 1, 14, 5)
  ctx.fillStyle = '#55555e'; ctx.fillRect(x - 6, y + 1, 12, 1)
  for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) {
    const d = xx * xx + yy * yy
    if (d <= 10) { ctx.fillStyle = d >= 6 ? '#8c8a82' : d <= 1 ? '#f1efe6' : '#26262b'; ctx.fillRect(x + xx, y + 5 + yy, 1, 1) }
  }
  if (flash > 0) {
    const mx = x + Math.cos(a) * (BARREL + 3), my = y - Math.sin(a) * (BARREL + 3)
    ctx.fillStyle = `rgba(255,209,58,${flash})`
    for (let i = 0; i < 9; i++) { const r = 2 + i * 0.9; ctx.fillRect(Math.round(mx + Math.cos(a) * i - r / 2), Math.round(my - Math.sin(a) * i - r / 2), Math.round(r), Math.round(r)) }
  }
}

function blackHole(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  // the danger zone: a faint rotating ring at its reach
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2 + t * 0.6
    if (i % 2) continue
    ctx.fillStyle = '#4a2a80'; ctx.fillRect(Math.round(x + Math.cos(a) * HOLE_REACH), Math.round(y + Math.sin(a) * HOLE_REACH * 0.92), 1, 1)
  }
  // accretion disk
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + t * 2.4, r = 8 + (i % 3)
    ctx.fillStyle = ['#ff8ad8', '#b06bff', '#ffb020', '#7a3dff'][i % 4]
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.45), 1, 1)
  }
  for (let yy = -5; yy <= 5; yy++) for (let xx = -5; xx <= 5; xx++) {
    const d = xx * xx + yy * yy
    if (d <= 25) { ctx.fillStyle = d >= 18 ? '#b06bff' : '#000'; ctx.fillRect(x + xx, y + yy, 1, 1) }
  }
}

function coin(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const w = Math.max(0.6, Math.abs(Math.cos(t * 5)) * 3)
  for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) {
    if ((xx * xx) / (w * w) + (yy * yy) / 9 > 1) continue
    const rim = (xx * xx) / (w * w) + (yy * yy) / 9 > 0.55
    ctx.fillStyle = rim ? '#a9803c' : yy < 0 ? '#ffe27a' : '#ffd13a'
    ctx.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1)
  }
}

export const moonshot: ArcadeGame = {
  id: 'moonshot',
  title: 'Moonshot',
  tagline: 'Fire the astronaut. How far can it go?',
  controls: ['Space / tap: lock the angle, then the power', 'In flight: tap for a jetpack puff (3 per launch)', 'Fuel cans and pads boost you', 'Skim a black hole to slingshot; octos grab'],
  width: W, height: H,
  maxScore: 250_000,
  maxPerSecond: 650,
  maxLives: 0,
  levelLabel: 'Fuel',
  touch: ['tap'],
  skins: TIER_SKINS,

  drawCover(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 40; i++) { ctx.fillStyle = hash(i) < 0.2 ? '#e8e8e0' : '#4a4a46'; ctx.fillRect(Math.floor(hash(i + 9) * W), Math.floor(hash(i + 19) * (GROUND - 10)), 1, 1) }
    drawEarth(ctx, 160, 22)
    hills(ctx, 0, 0)
    groundBand(ctx, 0, 0)
    // the arc of a good launch
    for (let i = 0; i < 26; i++) { const x = PIVOT_X + 12 + i * 5.4, y = PIVOT_Y - 10 - Math.sin((i / 26) * Math.PI * 0.95) * 70; ctx.fillStyle = i % 2 ? 'rgba(241,239,230,.25)' : 'rgba(141,255,106,.5)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1) }
    cannon(ctx, PIVOT_X, PIVOT_Y, 42)
    blackHole(ctx, 128, 46, 0.4)
    sprite(ctx, ART.fuel.rows, ART.fuel.pal, 168, GROUND - 5)
    sprite(ctx, SPRITES.octo.rows, SPRITES.octo.pal, 70, GROUND - 6)
    ;[0, 1, 2].forEach(i => coin(ctx, 96 + i * 9, 30 + Math.abs(i - 1) * 3, i))
    astronaut(ctx, 152, 70, 1.1, 0.9, 1)
    text(ctx, '1,240 M', W / 2, 17, '#8dff6a', 16)
  },

  create(canvas, hooks: GameHooks, opts) {
    const ctx = canvas.getContext('2d')!
    canvas.width = W; canvas.height = H
    ctx.imageSmoothingEnabled = false

    let raf = 0, last = 0, t0 = 0, running = false
    let phase: Phase = 'aim', phaseT = 0, angle = 40, power = 0
    let rand = Math.random
    let skin = opts?.skin ?? 'classic'
    const p = { x: PIVOT_X, y: PIVOT_Y, vx: 0, vy: 0, sx: 1, sy: 1, look: 1, rolling: false }
    let maxX = START_X, bonus = 0, puffs = PUFFS, booms = 0, stopT = 0, shake = 0, flash = 0
    let camX = 0, camY = 0, nextX = 0, hold: Obj | null = null
    let objs: Obj[] = [], pops: Pop[] = [], bits: Bit[] = []
    const trail: { x: number; y: number }[] = []
    let trailT = 0

    const metres = () => Math.max(0, Math.floor((maxX - START_X) / PX_PER_M))
    const score = () => metres() + bonus
    const hud = () => hooks.onHud({ score: score(), lives: 0, level: puffs })
    const pop = (x: number, y: number, s: string, color: string) => pops.push({ x, y, text: s, t: 0, color })
    const burst = (x: number, y: number, n: number, colors: string[], speed = 50, g = 90) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 10 + Math.random() * speed
        bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 15, life: 0.3 + Math.random() * 0.5, color: colors[i % colors.length], g })
      }
    }

    /* the course: laid out ahead of the camera from the seeded generator, always in x order */
    function generate(upto: number) {
      while (nextX < upto) {
        const ws = WEIGHTS(nextX / PX_PER_M), tot = ws.reduce((s, [, w]) => s + w, 0)
        let r = rand() * tot, kind: Kind = 'pad'
        for (const [k, w] of ws) { if ((r -= w) <= 0) { kind = k; break } }
        const o = (k: Kind, x: number, y: number): Obj => ({ kind: k, x, y, used: false, t: rand() * 6 })
        if (kind === 'coin') {
          const y = GROUND - 22 - rand() * 70
          for (let i = 0; i < 4; i++) objs.push(o('coin', nextX + i * 9, y - Math.sin((i / 3) * Math.PI) * 8))
        } else if (kind === 'rock') objs.push(o('rock', nextX, GROUND - 24 - rand() * 74))
        else if (kind === 'sat') objs.push(o('sat', nextX, GROUND - 40 - rand() * 84))
        else if (kind === 'hole') objs.push(o('hole', nextX, GROUND - 40 - rand() * 64))
        else objs.push(o(kind, nextX, GROUND))
        nextX += 60 + rand() * 120
      }
    }

    function act() {
      if (!running) return
      if (phase === 'aim') { phase = 'power'; phaseT = 0; sfx.tone(440, 0.05, 'square', 0.04); return }
      if (phase === 'power') { fire(); return }
      if (phase === 'fly' && puffs > 0) {
        puffs--
        p.vy = Math.min(p.vy, 0) - 92; p.vx += 26; p.rolling = false; stopT = 0
        burst(p.x - 4, p.y + 4, 12, ['#f1efe6', '#a3a199', '#59e6ff'], 30, 20)
        sfx.noise(0.12, 0.05); sfx.tone(220, 0.08, 'triangle', 0.04, 160)
        pop(p.x, p.y - 12, puffs ? 'PUFF' : 'LAST PUFF', '#59e6ff')
        hud()
      }
    }

    function fire() {
      const a = (angle * Math.PI) / 180, v = V_MIN + power * (V_MAX - V_MIN)
      p.x = PIVOT_X + Math.cos(a) * BARREL; p.y = PIVOT_Y - Math.sin(a) * BARREL
      p.vx = Math.cos(a) * v; p.vy = -Math.sin(a) * v; p.rolling = false
      phase = 'fly'; phaseT = 0; flash = 1; shake = 0.25
      burst(p.x, p.y, 18, ['#ffd13a', '#ff5a1f', '#f1efe6'], 60)
      sfx.noise(0.35, 0.12); sfx.tone(90, 0.3, 'sawtooth', 0.07, -50)
      hooks.onEvent?.('launch', 1)
      pop(p.x + 10, p.y - 10, power > 0.92 ? 'MAX POWER!' : 'LAUNCH!', power > 0.92 ? '#ffb020' : '#8dff6a')
    }

    function end(how: Phase) {
      if (phase === 'stopped' || phase === 'grabbed' || phase === 'captured') return
      phase = how; phaseT = 0
      hooks.onEvent?.('distance', metres())
      if (how === 'stopped') { pop(p.x, p.y - 16, `${metres().toLocaleString('en-US')} M`, '#8dff6a'); sfx.level() }
      if (how === 'grabbed') { pop(p.x, p.y - 16, 'GRABBED!', '#ff6a8a'); shake = 0.4; sfx.hit() }
      if (how === 'captured') { pop(p.x, p.y - 16, 'SPAGHETTIFIED', '#b06bff'); sfx.tone(520, 0.8, 'sine', 0.06, -480) }
    }

    function physics(dt: number) {
      // black holes pull, and swallow anything that reaches the core
      for (const o of objs) {
        if (o.kind !== 'hole' || o.used) continue
        const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy)
        if (d < HOLE_REACH) {
          if (!o.inside) { o.inside = true; o.minD = d }
          o.minD = Math.min(o.minD!, d)
          const a = HOLE_PULL / Math.max(d * d, 80)
          p.vx += (dx / d) * a * dt; p.vy += (dy / d) * a * dt
          if (d < HOLE_CORE + 1) { o.used = true; hold = o; end('captured'); return }
        } else if (o.inside) {
          o.inside = false
          if (o.minD! < 16) {                              // skimmed it: slingshot
            o.used = true
            p.vx *= 1.32; p.vy *= 1.32; bonus += 100
            pop(p.x, p.y - 12, 'SLINGSHOT! +100', '#ff8ad8'); hooks.onEvent?.('slingshot', 1)
            ;[523, 659, 784, 1046].forEach((f, i) => setTimeout(() => sfx.tone(f, 0.07, 'square', 0.04), i * 50))
          }
        }
      }
      p.vy += G * dt
      const sp = Math.hypot(p.vx, p.vy)
      if (sp > V_CAP) { p.vx *= V_CAP / sp; p.vy *= V_CAP / sp }
      p.x += p.vx * dt; p.y += p.vy * dt
      maxX = Math.max(maxX, p.x)

      // the ground: bounce, then roll to a stop
      if (p.y + R >= GROUND) {
        p.y = GROUND - R
        const crater = objs.find(o => o.kind === 'crater' && !o.used && Math.abs(p.x - o.x) < 14)
        if (crater) { crater.used = true; p.vx *= 0.45; p.vy *= 0.4; pop(p.x, p.y - 12, 'THUD', '#a3a199'); burst(p.x, GROUND, 14, ['#6e655c', '#3d3833'], 34) }
        if (p.vy > 45) {
          p.vy = -p.vy * 0.48; p.vx *= 0.82; p.sx = 1.4; p.sy = 0.65; p.rolling = false
          burst(p.x, GROUND, 6, ['#6e655c', '#8c8a82'], 24)
          sfx.tone(110, 0.06, 'triangle', 0.05)
        } else { p.vy = 0; p.rolling = true }
      } else if (p.y + R < GROUND - 1) p.rolling = false
      if (p.rolling) {
        const s = Math.sign(p.vx), m = Math.max(0, Math.abs(p.vx) - ROLL * dt)
        p.vx = s * m
        if (m < 5) { stopT += dt; if (stopT > 0.5) end('stopped') } else stopT = 0
      }

      // everything else on the course
      for (const o of objs) {
        const dx = p.x - o.x
        if (Math.abs(dx) > 30) continue
        if (o.kind === 'fuel' && !o.used && Math.hypot(dx, p.y - (GROUND - 5)) < R + 5) {
          o.used = true; booms++
          p.vx = Math.max(p.vx, 0) + 110; p.vy = Math.min(p.vy, 0) - 150; p.rolling = false; stopT = 0
          shake = 0.3; flash = 0.6
          burst(o.x, GROUND - 5, 26, ['#ffd13a', '#ff5a1f', '#ff2d2d', '#f1efe6'], 70)
          sfx.noise(0.3, 0.1); sfx.tone(70, 0.25, 'sawtooth', 0.06, -30)
          pop(o.x, GROUND - 22, booms >= 3 ? `BOOM x${booms}!` : 'BOOM!', '#ffb020')
          hooks.onEvent?.('boom', booms)
        }
        if (o.kind === 'pad' && Math.abs(dx) < 10 && p.y + R >= GROUND - 4 && p.vy >= 0) {
          p.vy = -Math.max(Math.abs(p.vy) * 1.05, 172); p.vx += 15; p.rolling = false; stopT = 0; o.squash = 1
          p.sx = 0.7; p.sy = 1.35
          sfx.tone(196, 0.12, 'square', 0.05, 330)
          pop(o.x, GROUND - 16, 'BOING!', '#59e6ff')
        }
        if ((o.kind === 'rock' || o.kind === 'sat') && !o.used) {
          const rr = o.kind === 'rock' ? 5 : 7, ddx = p.x - o.x, ddy = p.y - o.y, d = Math.hypot(ddx, ddy)
          if (d < R + rr) {
            const nx = ddx / d, ny = ddy / d, dot = p.vx * nx + p.vy * ny
            if (dot < 0) { p.vx -= 1.9 * dot * nx; p.vy -= 1.9 * dot * ny }
            p.x = o.x + nx * (R + rr + 0.5); p.y = o.y + ny * (R + rr + 0.5)
            p.sx = 1.3; p.sy = 0.75
            burst(p.x - nx * R, p.y - ny * R, 8, o.kind === 'rock' ? ['#6e655c', '#3d3833'] : ['#59e6ff', '#c9ccd6'], 30)
            sfx.tone(o.kind === 'rock' ? 150 : 600, 0.06, 'square', 0.04)
            if (o.kind === 'sat') pop(o.x, o.y - 10, 'PING!', '#59e6ff')
          }
        }
        if (o.kind === 'coin' && !o.used && Math.hypot(dx, p.y - o.y) < R + 3) {
          o.used = true; bonus += 25; p.vx += 8
          sfx.pickup(); pop(o.x, o.y - 8, '+25', '#ffd13a')
        }
        if (o.kind === 'fire' && !o.used && Math.hypot(dx, p.y - (GROUND - 6)) < R + 7) {
          o.used = true
          p.vy = Math.min(p.vy, 0) - 125; p.vx += 40; p.rolling = false; stopT = 0
          burst(o.x, GROUND - 8, 20, ['#ff2d2d', '#ff6a1a', '#ffd13a'], 50, -40)
          sfx.tone(300, 0.2, 'sawtooth', 0.05, 400)
          pop(o.x, GROUND - 22, 'BONFIRE HEAT!', '#ff5a1f')
        }
        if (o.kind === 'octo' && Math.hypot(dx, p.y - (GROUND - 6)) < R + 5) { hold = o; end('grabbed'); return }
      }
    }

    function step(now: number) {
      raf = requestAnimationFrame(step)
      const dt = Math.min(0.033, (now - last) / 1000 || 0)
      last = now
      if (!running) return
      phaseT += dt
      for (const o of objs) { o.t += dt; if (o.squash) o.squash = Math.max(0, o.squash - dt * 4) }
      bits.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += b.g * dt; b.life -= dt }); bits = bits.filter(b => b.life > 0)
      pops.forEach(q => { q.t += dt; q.y -= 12 * dt }); pops = pops.filter(q => q.t < 1.1)
      shake = Math.max(0, shake - dt); flash = Math.max(0, flash - dt * 3)

      if (phase === 'aim') angle = ANG_MIN + tri(phaseT / ANG_PERIOD) * (ANG_MAX - ANG_MIN)
      if (phase === 'power') power = tri(phaseT / POW_PERIOD)
      if (phase === 'fly') {
        for (let i = 0; i < 3; i++) { physics(dt / 3); if (phase !== 'fly') break }
        p.sx += (1 - p.sx) * Math.min(1, dt * 9); p.sy += (1 - p.sy) * Math.min(1, dt * 9)
        if ((trailT += dt) > 0.05) { trailT = 0; trail.push({ x: p.x, y: p.y }); if (trail.length > 40) trail.shift() }
        if (phaseT > 120) end('stopped')                  // nobody flies forever
      }
      if (phase === 'grabbed' && hold) { p.x = hold.x + Math.sin(phaseT * 30) * 1.5; p.y = GROUND - 9 }
      if (phase === 'captured' && hold) {
        const k = Math.min(1, phaseT / 0.8), a = phaseT * 14, r = (1 - k) * 8
        p.x = hold.x + Math.cos(a) * r; p.y = hold.y + Math.sin(a) * r * 0.6; p.sx = p.sy = 1 - k * 0.9
      }
      if ((phase === 'stopped' || phase === 'grabbed' || phase === 'captured') && phaseT > 1.1) {
        running = false; sfx.over(); hooks.onOver({ score: score(), ms: now - t0 })
      }

      // camera: keep the astronaut a third of the way in, rise with it when it climbs
      if (phase === 'fly' || phase === 'stopped' || phase === 'grabbed' || phase === 'captured') {
        camX += (Math.max(0, p.x - 64) - camX) * Math.min(1, dt * 10)
        camY += (Math.min(0, p.y - 46) - camY) * Math.min(1, dt * 6)
      }
      generate(camX + W * 2)
      objs = objs.filter(o => o.x > camX - 50)
      draw(); hud()
    }

    function draw() {
      ctx.save()
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
      if (shake) ctx.translate(Math.round((Math.random() - 0.5) * 6 * shake), Math.round((Math.random() - 0.5) * 6 * shake))
      // sky: two star layers that scroll slower than the ground
      for (const [f, n, c] of [[0.08, 30, '#4a4a46'], [0.2, 16, '#e8e8e0']] as [number, number, string][]) {
        for (let i = 0; i < n; i++) {
          const x = (((hash(i * 7 + f * 100) * W - camX * f) % W) + W) % W, y = (((hash(i * 13 + f * 50) * (H - 20) - camY * f * 0.6) % H) + H) % H
          ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
        }
      }
      drawEarth(ctx, 160, 22 - camY * 0.04)
      hills(ctx, camX, camY)
      groundBand(ctx, camX, camY)
      ctx.translate(-Math.round(camX), -Math.round(camY))

      // distance flags every 100 m
      const m0 = Math.floor((camX - START_X) / PX_PER_M / 100) * 100
      for (let m = Math.max(100, m0); m <= m0 + 300; m += 100) {
        const x = START_X + m * PX_PER_M
        ctx.fillStyle = '#55555e'; ctx.fillRect(x, GROUND - 12, 1, 12)
        ctx.fillStyle = m % 1000 === 0 ? '#ffb020' : '#2c6b1f'; ctx.fillRect(x + 1, GROUND - 12, 5, 3)
        text(ctx, `${m}`, x + 1, GROUND - 15, m % 1000 === 0 ? '#ffb020' : '#4aa83a', 8)
      }

      for (const o of objs) {
        if (o.x < camX - 40 || o.x > camX + W + 40) continue
        if (o.kind === 'crater') {
          for (let xx = -14; xx <= 14; xx++) { const d = 1 - (xx * xx) / 196; ctx.fillStyle = '#141418'; ctx.fillRect(o.x + xx, GROUND, 1, Math.max(1, Math.round(d * 5))); ctx.fillStyle = '#55555e'; if (Math.abs(xx) > 11) ctx.fillRect(o.x + xx, GROUND - 1, 1, 1) }
        }
        if (o.kind === 'fuel' && !o.used) sprite(ctx, ART.fuel.rows, ART.fuel.pal, o.x, GROUND - 5)
        if (o.kind === 'fuel' && o.used) { ctx.fillStyle = '#2a2a2a'; ctx.fillRect(o.x - 4, GROUND - 2, 8, 2) }
        if (o.kind === 'pad') {
          const sq = (o.squash ?? 0) * 3
          ctx.fillStyle = '#3a3a41'; ctx.fillRect(o.x - 8, GROUND - 1, 16, 1)
          ctx.fillStyle = '#8c8a82'; for (const sx of [-6, 0, 6]) for (let yy = 0; yy < 3 - sq / 1.5; yy++) ctx.fillRect(o.x + sx + (yy % 2), GROUND - 2 - yy, 1, 1)
          ctx.fillStyle = '#59e6ff'; ctx.fillRect(o.x - 8, Math.round(GROUND - 5 + sq), 16, 2)
        }
        if (o.kind === 'rock') sprite(ctx, ART.rock.rows, ART.rock.pal, o.x, o.y + Math.sin(o.t * 1.5) * 1)
        if (o.kind === 'sat') {
          const pal = Math.floor(o.t * 3) % 2 ? ART.sat.pal : { ...ART.sat.pal, d: '#5a1010' }
          sprite(ctx, ART.sat.rows, pal, o.x, o.y + Math.sin(o.t) * 1.5)
        }
        if (o.kind === 'coin' && !o.used) coin(ctx, o.x, o.y + Math.sin(o.t * 3) * 1, o.t)
        if (o.kind === 'hole') blackHole(ctx, o.x, o.y, o.t)
        if (o.kind === 'fire') {
          const pal = Math.floor(o.t * 8) % 2 ? ART.fire.pal : { ...ART.fire.pal, b: '#ff8a1f', c: '#fff0a0' }
          sprite(ctx, ART.fire.rows, pal, o.x, GROUND - 5, Math.floor(o.t * 5) % 2 === 1)
        }
        if (o.kind === 'octo') {
          const grab = hold === o && phase === 'grabbed'
          sprite(ctx, SPRITES.octo.rows, SPRITES.octo.pal, o.x, GROUND - 6 + (Math.floor(o.t * 4) % 2), false, grab ? 0.85 : 1)
        }
      }

      cannon(ctx, PIVOT_X, PIVOT_Y, angle, flash)

      // flight path: the classic dotted trail
      for (let i = 0; i < trail.length; i++) { ctx.fillStyle = i % 2 ? 'rgba(241,239,230,.35)' : 'rgba(141,255,106,.55)'; ctx.fillRect(Math.round(trail[i].x), Math.round(trail[i].y), 1, 1) }
      const tr = HELMETS[skin]?.trail
      if (tr && phase === 'fly') { ctx.fillStyle = tr; ctx.globalAlpha = 0.6; ctx.fillRect(Math.round(p.x - p.vx * 0.02) - 1, Math.round(p.y - p.vy * 0.02) - 1, 2, 2); ctx.globalAlpha = 1 }
      if (phase === 'fly' || phase === 'stopped' || phase === 'grabbed' || phase === 'captured') {
        astronaut(ctx, p.x, p.y, p.sx, p.sy, p.vx >= 0 ? 1 : -1, skin, performance.now() / 1000)
      }
      bits.forEach(b => { ctx.fillStyle = b.color; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1) })
      for (const q of pops) { ctx.globalAlpha = Math.max(0, 1 - q.t / 1.1); text(ctx, q.text, q.x, q.y, q.color) }
      ctx.globalAlpha = 1
      ctx.restore()

      // HUD on the glass
      if (phase === 'aim' || phase === 'power') {
        const a = (angle * Math.PI) / 180
        for (let i = 0; i < 8; i++) { const d = BARREL + 6 + i * 4; ctx.fillStyle = i % 2 ? 'rgba(141,255,106,.35)' : 'rgba(141,255,106,.7)'; ctx.fillRect(Math.round(PIVOT_X + Math.cos(a) * d - camX), Math.round(PIVOT_Y - Math.sin(a) * d - camY), 1, 1) }
        // power meter
        ctx.fillStyle = '#26262b'; ctx.fillRect(4, GROUND - 58, 6, 46)
        const h = Math.round((phase === 'power' ? power : 0) * 44)
        ctx.fillStyle = power > 0.85 ? '#ff5a1f' : power > 0.55 ? '#ffb020' : '#8dff6a'
        if (phase === 'power') ctx.fillRect(5, GROUND - 13 - h, 4, h)
        text(ctx, `${Math.round(angle)}°`, 34, GROUND - 34, '#8dff6a', 8, 'left')
        const blink = Math.floor(performance.now() / 300) % 2
        if (blink) text(ctx, phase === 'aim' ? 'TAP TO SET ANGLE' : 'TAP TO FIRE!', W / 2 + 14, 40, phase === 'aim' ? '#f1efe6' : '#ffb020')
      } else {
        text(ctx, `${metres().toLocaleString('en-US')} M`, W / 2, 17, '#8dff6a', 16)
        for (let i = 0; i < PUFFS; i++) { ctx.fillStyle = i < puffs ? '#59e6ff' : '#26262b'; ctx.fillRect(5 + i * 6, 5, 4, 6); ctx.fillStyle = i < puffs ? '#bff3ff' : '#26262b'; ctx.fillRect(5 + i * 6, 5, 4, 1) }
        if (p.y < -10) text(ctx, `ALT ${Math.round((GROUND - p.y) / PX_PER_M)} M`, W / 2, 28, '#a3a199')
        if (bonus) text(ctx, `+${bonus}`, W - 4, H - 6, '#ffd13a', 8, 'right')
      }
    }

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (![' ', 'arrowup', 'w', 'x', 'z'].includes(k)) return
      e.preventDefault()
      if (e.type === 'keydown' && !e.repeat) act()
    }
    const onPointer = (e: PointerEvent) => { if (running) { e.preventDefault(); act() } }

    function reset() {
      objs = []; pops = []; bits = []; trail.length = 0; hold = null
      phase = 'aim'; phaseT = 0; angle = 40; power = 0
      p.x = PIVOT_X; p.y = PIVOT_Y; p.vx = p.vy = 0; p.sx = p.sy = 1; p.rolling = false
      maxX = START_X; bonus = 0; puffs = PUFFS; booms = 0; stopT = 0; shake = 0; flash = 0
      camX = 0; camY = 0; nextX = 200
    }

    const idle = () => {
      reset(); generate(W * 2)
      draw()
      astronaut(ctx, PIVOT_X + 14, GROUND - R, 1, 1, 1, skin, 0)
    }

    addEventListener('keydown', onKey)
    canvas.addEventListener('pointerdown', onPointer)
    if (import.meta.env.DEV) (window as any).__moonshot = { p, phase: () => phase, objs: () => objs, act, metres, score }
    idle()
    raf = requestAnimationFrame(step)

    return {
      start(o?: StartOptions) {
        rand = o?.seed != null ? rng(o.seed) : Math.random
        reset()
        t0 = last = performance.now(); running = true
        sfx.start(); hud()
      },
      destroy() { cancelAnimationFrame(raf); running = false; removeEventListener('keydown', onKey); canvas.removeEventListener('pointerdown', onPointer) },
      setMuted(m) { sfx.setMuted(m) },
      setSkin(id) { skin = id; if (!running) idle() },
    }
  },
}

/* ---------------- scenery ---------------- */
function drawEarth(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  cy = Math.round(cy)
  const R = 9, blob = (x: number, y: number, bx: number, by: number, rx: number, ry: number) => ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 <= 1
  for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) {
    const d2 = xx * xx + yy * yy
    if (d2 > R * R) continue
    const land = blob(xx, yy, -3, -1, 2.6, 4.4) || blob(xx, yy, 3.5, 2, 2.4, 3.4) || blob(xx, yy, 4, -5, 1.8, 1.2)
    let c = land ? (yy < 0 ? '#5fbf3c' : '#3f9a2c') : '#2a6fd6'
    if (Math.abs(yy) >= R - 1) c = '#e8f4ff'                                   // ice caps
    if (!land && (xx + 2 * yy + 30) % 7 === 0 && Math.abs(xx) < 6) c = '#cfe3f5'   // cloud streaks
    if (d2 > (R - 1) ** 2 && xx + yy < -4) c = '#9fd8ff'                       // sunlit rim
    if (xx + yy > 6) c = land ? '#1f4d16' : '#16386e'                          // night side
    ctx.fillStyle = c; ctx.fillRect(cx + xx, cy + yy, 1, 1)
  }
}
function hills(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
  for (let x = 0; x < W; x++) {
    const wx = x + camX * 0.35, h = 10 + noise(wx / 38) * 14 + noise(wx / 11) * 4
    const top = Math.round(GROUND - h - camY * 0.9), bottom = Math.round(GROUND - camY)
    if (top >= H) continue
    ctx.fillStyle = '#17171c'; ctx.fillRect(x, top, 1, Math.max(0, bottom - top))
    ctx.fillStyle = '#26262d'; ctx.fillRect(x, top, 1, 1)
  }
}
function groundBand(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
  const y0 = Math.round(GROUND - camY)
  if (y0 >= H) return
  ctx.fillStyle = '#2a2a30'; ctx.fillRect(0, y0, W, H - y0)
  ctx.fillStyle = '#4a4a52'; ctx.fillRect(0, y0, W, 1)
  const c0 = Math.floor(camX / 8)
  for (let c = c0; c < c0 + W / 8 + 2; c++) {
    const h = hash(c), x = Math.round(c * 8 - camX)
    if (h < 0.3) { ctx.fillStyle = '#1d1d22'; ctx.fillRect(x, y0 + 4 + Math.floor(hash(c + 3) * 12), 3 + Math.floor(h * 10), 1) }
    else if (h > 0.85) { ctx.fillStyle = '#3d3d45'; ctx.fillRect(x + 2, y0 + 2 + Math.floor(hash(c + 7) * 14), 1, 1) }
  }
}
