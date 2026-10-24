import type { ArcadeGame, GameHooks, StartOptions } from '../types'
import { TIER_SKINS } from '../types'
import { sfx } from '../sfx'
import { rng } from '../../lib/daily'
import { HELMETS, SPRITES, astronaut, sprite, type Kind } from './space'

/* ============================================================
   MOON BOUNCE — a COZMC take on PapiTrampoline (Sunflat).
   You're a little astronaut on a moon trampoline. Stomp the aliens
   from above, chain stomps without landing for big combos. Touch one
   from the side or below and it's over. 192×144 logical pixels
   (chunky on purpose: big, readable characters).
   ============================================================ */

const W = 192, H = 144, FLOOR = 128
const G = 336, HOP = 105, JUMP = 204, STOMP = 180, STOMP_HI = 240, ACC = 570, MAXV = 81, R = 6

interface Foe { kind: Kind; x: number; y: number; vx: number; vy: number; w: number; h: number; t: number; base: number; dead: boolean; dy: number }
interface Pop { x: number; y: number; text: string; t: number; color: string }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; color: string }

function makeStars() {
  return Array.from({ length: 45 }, () => ({ x: Math.random() * W, y: Math.random() * (FLOOR - 10), z: Math.random() < 0.8 ? 1 : 2 }))
}
function sky(ctx: CanvasRenderingContext2D, s: { x: number; y: number; z: number }[]) {
  for (const p of s) { ctx.fillStyle = p.z === 2 ? '#e8e8e0' : '#4a4a46'; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1) }
  // a ringed planet hanging in the sky
  const cx = 163, cy = 27, r = 10
  for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) {
    const d = xx * xx + yy * yy
    if (d <= r * r) { ctx.fillStyle = xx + yy > 6 ? '#2a1a5c' : (yy + 20) % 7 < 3 ? '#6d4fc4' : '#8a6ee0'; ctx.fillRect(cx + xx, cy + yy, 1, 1) }
  }
  ctx.fillStyle = '#d9b26a'
  for (let xx = -17; xx <= 17; xx++) { const yy = Math.round(xx * -0.22); if (Math.abs(xx) > 9 || yy + cy > cy + 2) ctx.fillRect(cx + xx, cy + yy + 2, 1, 1) }
}

/** Moon ground + a trampoline whose net dips where you land. */
function ground(ctx: CanvasRenderingContext2D, dipX: number, dip: number) {
  ctx.fillStyle = '#26262b'; ctx.fillRect(0, FLOOR + 6, W, H - FLOOR - 6)
  ctx.fillStyle = '#3a3a41'
  for (const [x, y, w] of [[10, 136, 9], [42, 140, 5], [77, 135, 11], [114, 141, 6], [144, 137, 9], [178, 140, 5]]) {
    ctx.fillRect(x, y, w, 2); ctx.fillStyle = '#17171b'; ctx.fillRect(x + 1, y + 2, w - 2, 1); ctx.fillStyle = '#3a3a41'
  }
  ctx.fillStyle = '#55555e'; for (let x = 6; x < W; x += 16) ctx.fillRect(x, FLOOR + 2, 2, 5)   // springs/legs
  for (let x = 0; x < W; x++) {
    const d = Math.max(0, 1 - Math.abs(x - dipX) / 26)
    ctx.fillStyle = x % 4 === 0 ? '#59e6ff' : '#2a8fa6'
    ctx.fillRect(x, Math.round(FLOOR + dip * d * d), 1, 2)
  }
}

export const moonBounce: ArcadeGame = {
  id: 'moon-bounce',
  title: 'Moon Bounce',
  tagline: 'Stomp the aliens. Never touch their sides.',
  controls: ['← → or A / D to move', 'Space / ↑ to jump, hold to go higher', 'Stomp from above, chain for combos', 'Side hit = game over'],
  width: W, height: H,
  maxScore: 5_000_000,
  maxPerSecond: 4000,
  maxLives: 1,
  touch: ['left', 'jump', 'right'],
  skins: TIER_SKINS,

  drawCover(ctx) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    sky(ctx, makeStars())
    ground(ctx, 72, 3)
    sprite(ctx, SPRITES.ufo.rows, SPRITES.ufo.pal, 92, 76)
    sprite(ctx, SPRITES.probe.rows, SPRITES.probe.pal, 150, 58)
    sprite(ctx, SPRITES.alien.rows, SPRITES.alien.pal, 40, 122, true)
    sprite(ctx, SPRITES.octo.rows, SPRITES.octo.pal, 46, 40)
    ctx.fillStyle = 'rgba(241,239,230,.3)'; [0, 1, 2].forEach(i => ctx.fillRect(91 - i, 64 + i * 4, 1, 3))
    astronaut(ctx, 92, 62, 0.9, 1.15, 1)
    ctx.font = '700 16px Silkscreen'; ctx.fillStyle = '#ffb020'; ctx.fillText('x7', 104, 58)
  },

  create(canvas, hooks: GameHooks, opts) {
    const ctx = canvas.getContext('2d')!
    canvas.width = W; canvas.height = H
    ctx.imageSmoothingEnabled = false

    let raf = 0, last = 0, t0 = 0, running = false, dying = 0, freeze = 0
    let score = 0, combo = 0, best = 0, level = 1, spawnT = 0
    const p = { x: W / 2, y: FLOOR - 24, vx: 0, vy: 0, look: 1, sx: 1, sy: 1 }
    let prevY = p.y, dipX = W / 2, dip = 0, jumpBuf = -1, shake = 0
    let foes: Foe[] = [], pops: Pop[] = [], bits: Bit[] = []
    const bg = makeStars()
    const keys = new Set<string>()
    const held = (...k: string[]) => k.some(x => keys.has(x))
    let skin = opts?.skin ?? 'classic'
    const trail: { x: number; y: number }[] = []
    // gameplay randomness: seeded for the Daily Challenge (spawns and hops on separate streams)
    let rand = Math.random, hopRand = Math.random

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if (!['arrowleft', 'arrowright', 'arrowup', 'a', 'd', 'w', ' '].includes(k)) return
      e.preventDefault()
      if (e.type === 'keydown') { if (!keys.has(k) && (k === ' ' || k === 'arrowup' || k === 'w')) jumpBuf = performance.now(); keys.add(k) }
      else keys.delete(k)
    }
    const jumpHeld = () => held(' ', 'arrowup', 'w')

    const burst = (x: number, y: number, n: number, colors: string[], speed = 42) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = 12 + Math.random() * speed
        bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 18, life: 0.35 + Math.random() * 0.45, color: colors[i % colors.length] })
      }
    }
    const hud = () => hooks.onHud({ score, lives: dying ? 0 : 1, level })

    function spawn(elapsed: number) {
      const kinds: Kind[] = ['ufo']
      if (elapsed > 10) kinds.push('alien')
      if (elapsed > 25) kinds.push('probe')
      if (elapsed > 40) kinds.push('octo')
      const kind = kinds[Math.floor(rand() * kinds.length)]
      const fromLeft = rand() < 0.5, dir = fromLeft ? 1 : -1, speedUp = 1 + Math.min(1.2, elapsed / 120)
      const s = SPRITES[kind].rows, w = s[0].length, h = s.length
      const f: Foe = { kind, x: fromLeft ? -w : W + w, y: 0, vx: 0, vy: 0, w, h, t: rand() * 6, base: 0, dead: false, dy: 0 }
      if (kind === 'ufo') { f.base = 36 + rand() * 66; f.y = f.base; f.vx = dir * (17 + rand() * 16) * speedUp }
      if (kind === 'alien') { f.y = FLOOR - h / 2; f.vx = dir * (19 + rand() * 17) * speedUp; f.vy = -(72 + rand() * 72) }
      if (kind === 'probe') { f.x = rand() * W; f.y = -8; f.vx = dir * (27 + rand() * 21) * speedUp; f.vy = (24 + rand() * 24) * speedUp }
      if (kind === 'octo') { f.base = 54 + rand() * 42; f.y = f.base; f.vx = dir * (12 + rand() * 11) * speedUp }
      foes.push(f)
    }

    function stomp(f: Foe) {
      f.dead = true; f.dy = -36
      combo++; best = Math.max(best, combo)
      hooks.onEvent?.('stomp', combo)
      const pts = 100 * combo
      score += pts
      pops.push({ x: f.x, y: f.y - 8, text: `+${pts}`, t: 0, color: combo >= 10 ? '#ff8ad8' : combo >= 5 ? '#ffb020' : '#8dff6a' })
      if (combo === 5) pops.push({ x: W / 2, y: 42, text: 'NICE CHAIN', t: 0, color: '#ffb020' })
      if (combo === 10) pops.push({ x: W / 2, y: 42, text: 'COSMIC!', t: 0, color: '#ff8ad8' })
      if (combo === 15) pops.push({ x: W / 2, y: 42, text: 'LEGENDARY!', t: 0, color: '#59e6ff' })
      p.vy = jumpHeld() ? -STOMP_HI : -STOMP
      p.sx = 1.35; p.sy = 0.65
      burst(f.x, f.y, 10, SPRITES[f.kind].burst)
      freeze = 0.035
      sfx.tone(330 * Math.pow(2, Math.min(combo, 24) / 12), 0.09, 'square', 0.06, 120)   // each link in the chain rings a semitone higher
    }

    function die(now: number) {
      dying = now; shake = 0.4
      burst(p.x, p.y, 30, ['#f1efe6', '#59e6ff', '#ff5a1f', '#ffb020'], 66)
      sfx.hit()
      hud()
    }

    function step(now: number) {
      raf = requestAnimationFrame(step)
      const dt = Math.min(0.033, (now - last) / 1000 || 0)
      last = now
      if (!running) return
      if (freeze > 0) { freeze -= dt; draw(); return }
      const elapsed = (now - t0) / 1000

      bits.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 132 * dt; b.life -= dt })
      bits = bits.filter(b => b.life > 0)
      pops.forEach(q => { q.t += dt; q.y -= 14 * dt })
      pops = pops.filter(q => q.t < 0.9)
      shake = Math.max(0, shake - dt)

      if (dying) {
        if (now - dying > 900) { running = false; sfx.over(); hooks.onOver({ score, ms: dying - t0 }) }
        draw(); return
      }

      const nl = 1 + Math.floor(elapsed / 20)
      if (nl !== level) { level = nl; hooks.onEvent?.('wave', level); sfx.level(); pops.push({ x: W / 2, y: 36, text: `WAVE ${level}`, t: 0, color: '#59e6ff' }) }

      // --- astronaut ---
      const ax = (held('arrowleft', 'a') ? -1 : 0) + (held('arrowright', 'd') ? 1 : 0)
      if (ax) { p.vx += ax * ACC * dt; p.look = ax } else p.vx *= Math.pow(0.03, dt)
      p.vx = Math.max(-MAXV, Math.min(MAXV, p.vx))
      p.vy += G * (jumpHeld() && p.vy < 0 ? 0.62 : 1) * dt   // hold jump to float higher
      prevY = p.y
      trail.push({ x: p.x, y: p.y }); if (trail.length > 6) trail.shift()
      p.x += p.vx * dt; p.y += p.vy * dt
      if (p.x < -R) p.x += W + 2 * R
      if (p.x > W + R) p.x -= W + 2 * R
      p.sx += (1 - p.sx) * Math.min(1, dt * 10); p.sy += (1 - p.sy) * Math.min(1, dt * 10)
      if (p.vy < -150) { p.sy = Math.max(p.sy, 1.15); p.sx = Math.min(p.sx, 0.9) }

      if (p.y + R >= FLOOR && p.vy > 0) {                     // the trampoline
        p.y = FLOOR - R
        if (combo >= 2) pops.push({ x: p.x, y: p.y - 14, text: `CHAIN x${combo}`, t: 0, color: '#a3a199' })
        combo = 0
        const big = jumpHeld() || now - jumpBuf < 140
        p.vy = big ? -JUMP : -HOP
        p.sx = 1.4; p.sy = 0.6
        dipX = p.x; dip = big ? 6 : 3
        sfx.tone(big ? 196 : 147, 0.1, 'triangle', 0.05, big ? 220 : 90)
      }
      dip *= Math.pow(0.004, dt)

      // --- aliens ---
      spawnT -= dt
      const cap = Math.min(10, 3 + Math.floor(elapsed / 14))
      if (spawnT <= 0 && foes.filter(f => !f.dead).length < cap) {
        spawn(elapsed)
        spawnT = Math.max(0.45, 1.6 - elapsed * 0.009) * (0.7 + rand() * 0.6)
      }
      for (const f of foes) {
        f.t += dt
        if (f.dead) { f.dy += 300 * dt; f.y += f.dy * dt; continue }
        if (f.kind === 'ufo') { f.x += f.vx * dt; f.y = f.base + Math.sin(f.t * 3) * 3 }
        if (f.kind === 'octo') { f.x += f.vx * dt; f.y = f.base + Math.sin(f.t * 1.7) * 29 }
        if (f.kind === 'alien') {
          f.x += f.vx * dt; f.vy += 252 * dt; f.y += f.vy * dt
          if (f.y + f.h / 2 >= FLOOR) { f.y = FLOOR - f.h / 2; f.vy = -(78 + hopRand() * 78) }
        }
        if (f.kind === 'probe') {
          f.x += f.vx * dt; f.y += f.vy * dt
          if (f.y + f.h / 2 >= FLOOR) f.vy = -Math.abs(f.vy)
          if (f.y < 14 && f.vy < 0) f.vy = Math.abs(f.vy)
        }
      }
      foes = foes.filter(f => (f.dead ? f.y < H + 16 : f.x > -24 && f.x < W + 24))

      // --- contact: from above is a stomp, anything else ends the run ---
      for (const f of foes) {
        if (f.dead) continue
        const dx = Math.abs(p.x - f.x), dy = p.y - f.y
        if (dx < f.w / 2 + R - 2 && Math.abs(dy) < f.h / 2 + R - 2) {
          const top = f.y - f.h / 2
          if (p.vy > 0 && prevY + R <= top + 4) stomp(f)
          else { die(now); break }
        }
      }

      draw(); hud()
    }

    function draw() {
      ctx.save()
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
      if (shake) ctx.translate(Math.round((Math.random() - 0.5) * 5 * shake), Math.round((Math.random() - 0.5) * 5 * shake))
      sky(ctx, bg)
      ground(ctx, dipX, dip)
      const blink = Math.floor(performance.now() / 160) % 2
      for (const f of foes) {
        const s = SPRITES[f.kind]
        const pal = f.kind === 'ufo' && blink ? { ...s.pal, l: '#ff5a1f' } : s.pal
        const bob = (f.kind === 'probe' || f.kind === 'octo') && Math.floor(f.t * 8) % 2 ? 1 : 0
        sprite(ctx, s.rows, pal, f.x, f.y + bob, f.vx > 0, f.dead ? 0.4 : 1)
      }
      if (!dying) {
        const tr = HELMETS[skin]?.trail
        if (tr) trail.forEach((q, i) => { ctx.globalAlpha = (i + 1) / (trail.length + 2) * 0.6; ctx.fillStyle = tr; ctx.fillRect(Math.round(q.x) - 1, Math.round(q.y) - 1, 2, 2) })
        ctx.globalAlpha = 1
        astronaut(ctx, p.x, p.y, p.sx, p.sy, p.look, skin, performance.now() / 1000)
        if (p.y < -R) { ctx.fillStyle = '#f1efe6'; ctx.fillRect(Math.round(p.x) - 1, 2, 3, 2); ctx.fillRect(Math.round(p.x), 0, 1, 2) }
      }
      bits.forEach(b => { ctx.fillStyle = b.color; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1) })
      ctx.textAlign = 'center'
      for (const q of pops) {
        ctx.globalAlpha = Math.max(0, 1 - q.t / 0.9)
        ctx.font = '700 8px Silkscreen'
        ctx.fillStyle = '#000'; ctx.fillText(q.text, Math.round(q.x) + 1, Math.round(q.y) + 1)
        ctx.fillStyle = q.color; ctx.fillText(q.text, Math.round(q.x), Math.round(q.y))
      }
      ctx.globalAlpha = 1
      if (combo >= 2 && !dying) {
        ctx.font = '700 16px Silkscreen'
        ctx.fillStyle = combo >= 10 ? '#ff8ad8' : combo >= 5 ? '#ffb020' : '#8dff6a'
        ctx.fillText(`x${combo}`, W / 2, 20)
      }
      ctx.textAlign = 'left'
      ctx.restore()
    }

    addEventListener('keydown', onKey); addEventListener('keyup', onKey)
    if (import.meta.env.DEV) (window as any).__bounce = { p, foes: () => foes, combo: () => combo, best: () => best, score: () => score, dying: () => dying }
    const idle = () => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); sky(ctx, bg); ground(ctx, W / 2, 0); astronaut(ctx, W / 2, FLOOR - R, 1, 1, 1, skin, 0) }
    idle()
    raf = requestAnimationFrame(step)

    return {
      start(o?: StartOptions) {
        if (o?.seed != null) { rand = rng(o.seed); hopRand = rng(o.seed ^ 0x9e3779b9) } else { rand = Math.random; hopRand = Math.random }
        trail.length = 0
        foes = []; pops = []; bits = []; score = 0; combo = 0; best = 0; level = 1; spawnT = 1.2; dying = 0; freeze = 0; shake = 0
        p.x = W / 2; p.y = FLOOR - 30; p.vx = 0; p.vy = 0; p.sx = p.sy = 1; keys.clear()
        t0 = last = performance.now(); running = true
        sfx.start(); hud()
      },
      destroy() { cancelAnimationFrame(raf); running = false; removeEventListener('keydown', onKey); removeEventListener('keyup', onKey) },
      setMuted(m) { sfx.setMuted(m) },
      setSkin(id) { skin = id; if (!running) idle() },
    }
  },
}
