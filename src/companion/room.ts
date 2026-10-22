/* ============================================================
   THE ROOM — the Cozmling's little world: it wanders, eats what
   drops in, bounces a star ball, naps with the lights off, and
   hatches with a flash. The care rules live in care.ts; this file
   only animates what they allow.
   ============================================================ */
import { ANCHOR, drawBulbGlow, drawCozmling, type Look, type Pose, type Stage } from './look'
import { drawHome, drawNight, FLOOR_Y, H, W } from './scene'
import type { HomeId, Need } from './care'
import { sfx } from '../arcade/sfx'

type Art = { rows: string[]; pal: Record<string, string> }
export const ART: Record<string, Art> = {
  cheese: { rows: ['....aa', '..aaba', 'aaaaaa', 'abaaba', 'aaaaaa'], pal: { a: '#ffd13a', b: '#c9921a' } },
  starfruit: { rows: ['..a..', '.aaa.', 'aabaa', '.aaa.', 'a...a'], pal: { a: '#c6ff4a', b: '#7fc41a' } },
  cookie: { rows: ['.aaaa.', 'aabaca', 'aaaaaa', 'acaaba', '.aaaa.'], pal: { a: '#c98a5f', b: '#59e6ff', c: '#6b4428' } },
  ball: { rows: ['.aaa.', 'abaaa', 'aaaaa', 'aaaca', '.aaa.'], pal: { a: '#ffb020', b: '#fff3c4', c: '#c97a10' } },
  heart: { rows: ['.a.a.', 'aaaaa', 'aaaaa', '.aaa.', '..a..'], pal: { a: '#ff6a8a' } },
  z: { rows: ['aaaa', '..a.', '.a..', 'aaaa'], pal: { a: '#cfe3ff' } },
  spark: { rows: ['.a.', 'aaa', '.a.'], pal: { a: '#ffffff' } },
}
const NEED_ICON: Record<Need, string> = { food: 'cheese', fun: 'ball', energy: 'z' }

const HEAD = (s: Stage) => ANCHOR[s].top, MOUTH = (s: Stage) => ANCHOR[s].mouth

interface Part { art: string; x: number; y: number; vx: number; vy: number; g: number; age: number; life: number; tint?: string }

export interface Frame { home: HomeId; look: Look; stage: Stage; asleep: boolean; low: boolean; need: Need | null; crack: number }

function stamp(ctx: CanvasRenderingContext2D, a: Art, x: number, y: number, tint?: string) {
  const w = a.rows[0].length, h = a.rows.length
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const ch = a.rows[r][c]
    if (ch === '.') continue
    ctx.fillStyle = tint ?? a.pal[ch]; ctx.fillRect(Math.round(x - w / 2) + c, Math.round(y - h / 2) + r, 1, 1)
  }
}

export class Room {
  x = W / 2 + 8
  dir: 1 | -1 = -1
  private goal = this.x
  private rest = 1.5
  private act: { pose: Pose; until: number } | null = null
  private parts: Part[] = []
  private item: { art: string; kind: 'food' | 'ball'; x: number; y: number; vy: number; born: number; until: number } | null = null
  private flash = 0
  private shake = 0
  private last = 0
  private zAt = 0
  private chewAt = 0
  private stage: Stage = 'egg'
  private ctx: CanvasRenderingContext2D
  private layer = Object.assign(document.createElement('canvas'), { width: W, height: H })   // the Cozmling, dimmed on its own at night

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = W; canvas.height = H
    this.ctx = canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false
  }

  private now() { return performance.now() / 1000 }
  private burst(n: number, x: number, y: number, art: string, opts: { speed?: number; up?: number; g?: number; life?: number; tints?: string[] } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (opts.speed ?? 30) * (0.4 + Math.random() * 0.6)
      this.parts.push({ art, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up ?? 0), g: opts.g ?? 0, age: 0, life: (opts.life ?? 0.8) * (0.7 + Math.random() * 0.5), tint: opts.tints?.[i % opts.tints.length] })
    }
  }
  private hold() { this.goal = this.x }

  /* ---- reactions (call these after care.ts says yes) ---- */
  feed(food: string) {
    this.hold()
    this.item = { art: food, kind: 'food', x: this.x + this.dir * 1, y: -6, vy: 0, born: this.now(), until: Infinity }
    sfx.tone(660, 0.05, 'triangle', 0.04, 220)
  }
  play() {
    const t = this.now()
    this.hold()
    this.act = { pose: 'play', until: t + 2.8 }
    this.item = { art: 'ball', kind: 'ball', x: this.x, y: 0, vy: 0, born: t, until: t + 2.8 }
    sfx.level()
  }
  pat() {
    this.hold()
    this.act = { pose: 'happy', until: this.now() + 1.3 }
    this.burst(3, this.x, FLOOR_Y - HEAD(this.stage) - 2, 'heart', { speed: 10, up: 22, life: 1.1 })
    sfx.tone(880, 0.07, 'triangle', 0.05); setTimeout(() => sfx.tone(1175, 0.09, 'triangle', 0.05), 80)
  }
  refuse() {
    this.act = { pose: 'sad', until: this.now() + 0.9 }
    this.shake = 0.4
    sfx.tone(220, 0.14, 'triangle', 0.05, -60)
  }
  sleep() { [523, 440, 349].forEach((f, i) => setTimeout(() => sfx.tone(f, 0.18, 'triangle', 0.05), i * 160)) }
  wake() {
    this.act = { pose: 'happy', until: this.now() + 1 }
    ;[349, 440, 523].forEach((f, i) => setTimeout(() => sfx.tone(f, 0.12, 'triangle', 0.05), i * 110))
  }
  crack() {
    this.shake = 0.35
    this.burst(4, W / 2, FLOOR_Y - 14, 'spark', { speed: 26, life: 0.4 })
    sfx.noise(0.08, 0.05); sfx.tone(240, 0.06, 'square', 0.04)
  }
  hatch(glow: string) {
    this.flash = 1
    this.act = { pose: 'happy', until: this.now() + 2 }
    this.burst(26, W / 2, FLOOR_Y - 16, 'spark', { speed: 60, life: 1.2, tints: ['#ffffff', '#ffd13a', glow] })
    sfx.start(); setTimeout(() => sfx.pickup(), 320)
  }

  /** Is this point (in room pixels) on the Cozmling? */
  hit(sx: number, sy: number) {
    return Math.abs(sx - this.x) < 12 && sy > FLOOR_Y - HEAD(this.stage) - 2 && sy < FLOOR_Y + 3
  }

  draw(f: Frame) {
    const t = this.now(), dt = this.last ? Math.min(0.05, t - this.last) : 0
    this.last = t
    this.stage = f.stage
    const ctx = this.ctx
    if (this.act && t > this.act.until) this.act = null
    const pose: Pose = this.act?.pose ?? (f.asleep ? 'sleep' : f.low ? 'sad' : 'idle')

    // wander about when nothing is going on
    let moving = false
    if (f.stage === 'egg') this.x = W / 2
    else if (!this.act && !f.asleep && !this.item) {
      if (Math.abs(this.goal - this.x) > 0.6) {
        this.dir = this.goal > this.x ? 1 : -1
        this.x += this.dir * (f.low ? 6 : 11) * dt
        moving = true
      } else if ((this.rest -= dt) <= 0) {
        this.goal = 34 + Math.random() * (W - 68)
        this.rest = (f.low ? 6 : 2) + Math.random() * 4
      }
    }
    const shakeX = this.shake > 0 ? Math.round(Math.sin(t * 60) * 1.2) : 0
    this.shake = Math.max(0, this.shake - dt)
    const y = FLOOR_Y - (moving && Math.floor(t * 8) % 2 ? 1 : 0)

    drawHome(ctx, f.home, t)
    let bulb
    if (f.asleep) {
      // lights out: the room dims (its own lights still glow), then the Cozmling, dimmed the same, on top
      drawNight(ctx, f.home, t)
      const l = this.layer.getContext('2d')!
      l.clearRect(0, 0, W, H)
      bulb = drawCozmling(l, this.x + shakeX, y, f.look, f.stage, pose, t, { flip: this.dir < 0, crack: f.crack })
      l.globalCompositeOperation = 'source-atop'; l.fillStyle = 'rgba(3,2,14,.62)'; l.fillRect(0, 0, W, H)
      l.globalCompositeOperation = 'source-over'
      ctx.drawImage(this.layer, 0, 0)
      drawBulbGlow(ctx, bulb, t, 1.5, true)      // its antenna is a night light
    } else {
      bulb = drawCozmling(ctx, this.x + shakeX, y, f.look, f.stage, pose, t, { flip: this.dir < 0, crack: f.crack })
      drawBulbGlow(ctx, bulb, t)
    }

    // food drops in; the ball bounces over the head
    const it = this.item
    if (it) {
      const mouth = FLOOR_Y - MOUTH(f.stage)
      if (it.kind === 'food') {
        it.vy += 220 * dt; it.y += it.vy * dt
        if (it.y >= mouth - 2) {
          this.item = null
          this.act = { pose: 'eat', until: t + 1.6 }
          this.chewAt = t
        } else stamp(ctx, ART[it.art], it.x, it.y)
      } else {
        const k = t - it.born
        const top = FLOOR_Y - HEAD(f.stage) - 4
        const by = top - Math.abs(Math.sin(k * 4.4)) * 20
        stamp(ctx, ART.ball, this.x + Math.sin(k * 2.2) * 5, by)
        if (Math.abs(Math.sin(k * 4.4)) < 0.08 && Math.random() < 0.5) this.burst(2, this.x, top, 'spark', { speed: 18, life: 0.35, tints: ['#ffd13a'] })
        if (t > it.until) { this.item = null; this.burst(10, this.x, top - 6, 'spark', { speed: 34, life: 0.7, tints: ['#ffd13a', '#ffffff'] }) }
      }
    }
    // chewing crumbs and munch sounds
    if (this.act?.pose === 'eat' && t - this.chewAt > 0.26) {
      this.chewAt = t
      this.burst(2, this.x, FLOOR_Y - MOUTH(f.stage) + 1, 'spark', { speed: 14, g: 120, life: 0.5, tints: ['#ffd13a', '#c98a5f'] })
      sfx.tone(260 + Math.random() * 90, 0.04, 'square', 0.035)
    }

    if (f.asleep) {
      if (t - this.zAt > 1.3) { this.zAt = t; this.parts.push({ art: 'z', x: this.x + 6, y: FLOOR_Y - HEAD(f.stage) + 6, vx: 5, vy: -9, g: 0, age: 0, life: 2.6 }) }
    }

    // a thought bubble when something is badly needed
    if (f.need && f.low && !f.asleep && !this.act && !this.item && f.stage !== 'egg') {
      const bx = Math.round(this.x + 11), by = Math.round(FLOOR_Y - HEAD(f.stage) - 4 + Math.sin(t * 3) * 1)
      ctx.fillStyle = '#120d14'; ctx.fillRect(bx - 6, by - 6, 13, 11)
      ctx.fillStyle = '#f1efe6'; ctx.fillRect(bx - 5, by - 5, 11, 9)
      ctx.fillRect(bx - 4, by + 4, 2, 1); ctx.fillStyle = '#120d14'; ctx.fillRect(bx - 5, by + 5, 1, 1)
      stamp(ctx, ART[NEED_ICON[f.need]], bx + 0.5, by - 0.5, f.need === 'energy' ? '#5d6680' : undefined)
    }

    // particles
    this.parts = this.parts.filter(p => (p.age += dt) < p.life)
    for (const p of this.parts) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt
      if (p.art === 'heart' || p.art === 'z') p.x += Math.sin((p.age + p.y) * 4) * 0.15
      ctx.globalAlpha = Math.min(1, (p.life - p.age) / 0.35)
      stamp(ctx, ART[p.art], p.x, p.y, p.tint)
    }
    ctx.globalAlpha = 1

    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash.toFixed(3)})`; ctx.fillRect(0, 0, W, H); this.flash = Math.max(0, this.flash - dt * 1.3) }
  }
}
