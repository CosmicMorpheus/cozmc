/* ============================================================
   COZMLING ART — a little alien, drawn in code on a 40×44 pixel
   grid so every colour is swappable and every pose comes from the
   same parts: a big round head with glossy eyes, one antenna with a
   glowing bulb, and (for girls) axolotl-style fins on the head.
   Stages: Star Egg → Sprout (baby) → Cadet (child) → Explorer (adult) → Guardian.
   ============================================================ */

export type Form = 'boy' | 'girl'
export type Stage = 'egg' | 'sprout' | 'cadet' | 'explorer' | 'guardian'
export const STAGES: Stage[] = ['egg', 'sprout', 'cadet', 'explorer', 'guardian']
export const STAGE_NAME: Record<Stage, string> = { egg: 'Star Egg', sprout: 'Sprout', cadet: 'Cadet', explorer: 'Explorer', guardian: 'Guardian' }

export interface Look { form: Form; body: number; glow: number; eyes: number }
export type Pose = 'idle' | 'happy' | 'eat' | 'sleep' | 'sad' | 'play'

export const BODIES = ['#6fe3c4', '#7cc8ff', '#c6a2ee', '#ff9ccf', '#b4f06a', '#ffb98a', '#8dff6a', '#d9d4ec']
export const GLOWS = ['#4aa8ff', '#ff5ab4', '#ffd13a', '#8dff6a', '#59e6ff', '#b06bff', '#ff6a4a', '#ffffff']
export const EYES = ['#4a50c8', '#8a4ad8', '#2f9a7e', '#c84a7a', '#55556a']
export const DEFAULT_LOOK: Record<Form, Look> = {
  boy: { form: 'boy', body: 0, glow: 0, eyes: 0 },
  girl: { form: 'girl', body: 2, glow: 1, eyes: 1 },
}

/** The sprite grid; the feet stand on its bottom row. */
export const SW = 40, SH = 44
/** Pixels above the feet: the top of the antenna, and the mouth (where food goes). */
export const ANCHOR: Record<Stage, { top: number; mouth: number }> = {
  egg: { top: 26, mouth: 16 },
  sprout: { top: 33, mouth: 11 },
  cadet: { top: 42, mouth: 18 },
  explorer: { top: 47, mouth: 25 },
  guardian: { top: 51, mouth: 28 },
}

export const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))))
  return '#' + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join('')
}
const mix = (a: string, b: string, f: number) => {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const A = p(a), B = p(b)
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * f).toString(16).padStart(2, '0')).join('')
}

interface Tones { dark: string; base: string; light: string; hi: string; line: string }
const tones = (c: string): Tones => ({ dark: shade(c, -0.3), base: c, light: shade(c, 0.3), hi: shade(c, 0.7), line: shade(c, -0.72) })

/* --- tiny pixel kit (grid coordinates, offset by the sprite origin) --- */
function kit(ctx: CanvasRenderingContext2D, ox: number, oy: number) {
  const px = (x: number, y: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(ox + x), Math.round(oy + y), 1, 1) }
  const rect = (x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(Math.round(ox + x), Math.round(oy + y), w, h) }
  const rows = (x: number, y: number, art: string[], pal: Record<string, string>, flip = false) => {
    const w = art[0].length
    art.forEach((r, j) => { for (let i = 0; i < w; i++) { const ch = r[flip ? w - 1 - i : i]; if (ch !== '.' && pal[ch]) px(x + i, y + j, pal[ch]) } })
  }
  /** a lit ellipse: highlight upper left, shadow lower right, with a little gloss spot */
  const ball = (cx: number, cy: number, rx: number, ry: number, T: Tones, gloss = true) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d = nx * nx + ny * ny
      if (d > 1) continue
      const l = -0.5 * nx - 0.62 * ny + 0.6 * Math.sqrt(1 - d)
      px(x, y, gloss && l > 0.955 ? T.hi : l > 0.72 ? T.light : l > 0.2 ? T.base : T.dark)
    }
  }
  /** a rounded limb from (x0,y0) to (x1,y1), shaded on its right side */
  const limb = (x0: number, y0: number, x1: number, y1: number, r: number, T: Tones) => {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1
    for (let y = Math.floor(Math.min(y0, y1) - r); y <= Math.ceil(Math.max(y0, y1) + r); y++) for (let x = Math.floor(Math.min(x0, x1) - r); x <= Math.ceil(Math.max(x0, x1) + r); x++) {
      const qx = x + 0.5, qy = y + 0.5
      const f = Math.max(0, Math.min(1, ((qx - x0) * dx + (qy - y0) * dy) / L2))
      const ex = qx - (x0 + dx * f), ey = qy - (y0 + dy * f)
      if (ex * ex + ey * ey > r * r) continue
      px(x, y, ex > r * 0.35 ? T.dark : ex < -r * 0.55 ? T.light : T.base)
    }
  }
  return { px, rect, rows, ball, limb }
}
type Kit = ReturnType<typeof kit>

/* --- the face --- */
const EYE_OPEN = ['.dddd.', 'dwwddd', 'dwwddd', 'dddddd', 'dnnnwd', 'dmmmmd', '.mmmm.']
const EYE_SAD = ['......', 'llllll', 'dwdddd', 'dddddd', 'dnnnwd', 'dmmmmd', '.mmmm.']
const EYE_SHUT = ['......', '......', '......', 'd....d', '.dddd.', '......', '......']   // asleep / blinking
const EYE_JOY = ['......', '......', '.dddd.', 'd....d', '......', '......', '......']    // ^ ^
const MOUTH: Record<string, string[]> = {
  idle: ['d..d', '.dd.'],
  happy: ['dddd', 'dppd', '.dd.'],
  eatOpen: ['.dd.', 'dppd', '.dd.'],
  eatShut: ['....', 'dddd'],
  sad: ['.dd.', 'd..d'],
  sleep: ['....', '.dd.'],
}

function face(k: Kit, pose: Pose, t: number, lx: number, rx: number, ey: number, mx: number, my: number, T: Tones, iris: string, girl: boolean) {
  const blink = pose !== 'sleep' && t % 3.8 < 0.13
  const art = pose === 'sleep' || blink ? EYE_SHUT : pose === 'happy' || pose === 'play' ? EYE_JOY : pose === 'sad' ? EYE_SAD : EYE_OPEN
  const pal = { d: '#14143a', w: '#ffffff', m: iris, n: mix('#14143a', iris, 0.45), l: T.line }
  k.rows(lx, ey, art, pal); k.rows(rx, ey, art, pal)
  if (girl) {   // lashes on the outer corners
    const open = art === EYE_OPEN || art === EYE_SAD
    const ly = open ? ey + 1 : ey + 3
    k.px(lx - 1, ly, '#14143a'); k.px(lx - 1, ly - 1, '#14143a'); k.px(rx + 6, ly, '#14143a'); k.px(rx + 6, ly - 1, '#14143a')
  }
  if (pose === 'sad') { const ty = ey + 7 + (Math.floor(t * 2.5) % 3); k.px(lx, ty, '#8fe0ff'); k.px(lx, ty + 1, '#c9f2ff') }
  // cheeks
  const blush = mix(T.base, '#ff4f8a', 0.42)
  k.rect(lx - 1, ey + 7, 2, 1, blush); k.rect(rx + 5, ey + 7, 2, 1, blush)
  const m = pose === 'eat' ? (Math.floor(t * 8) % 2 ? MOUTH.eatOpen : MOUTH.eatShut) : pose === 'play' ? MOUTH.happy : MOUTH[pose] ?? MOUTH.idle
  k.rows(mx, my, m, { d: T.line, p: '#ff7a9a' })
}

/** The antenna: a thin stalk curving up to a glowing bulb. Returns the bulb's centre. */
function antenna(k: Kit, bx: number, by: number, len: number, t: number, pose: Pose, T: Tones, glow: string, star: boolean) {
  const droop = pose === 'sad' || pose === 'sleep'
  const perk = pose === 'happy' || pose === 'play'
  const sway = Math.sin(t * 2.3) * (perk ? 1.4 : 0.7)
  let tx = bx, ty = by
  for (let i = 0; i <= len; i++) {
    const f = i / len
    tx = Math.round(bx + (droop ? f * f * 5 : f * f * 2 + sway * f))
    ty = Math.round(by - i * (droop ? 0.62 : 1) + (droop ? f * f * 2.5 : 0))
    k.px(tx, ty, T.dark)
  }
  const G = tones(glow)
  if (star) k.rows(tx - 2, ty - 4, ['..a..', '.aba.', 'abcba', '.aba.', '..a..'], { a: G.base, b: G.light, c: '#ffffff' })
  else k.rows(tx - 2, ty - 3, ['.bb.', 'bcbb', 'bbba', '.aa.'], { a: G.dark, b: G.base, c: '#ffffff' })
  return star ? { x: tx, y: ty - 2 } : { x: tx - 0.5, y: ty - 1.5 }
}

/** Girls have frilly fins on the sides of the head (they flutter a little). */
const FIN = ['aa....', '.ab...', '..bbcc', 'aabbcc', '..bbcc', '.ab...', 'aa....']
function fins(k: Kit, x0: number, y0: number, t: number, pose: Pose, glow: string) {
  const G = tones(glow)
  const pal = { a: G.light, b: G.base, c: G.dark }
  const dy = pose === 'sad' || pose === 'sleep' ? 1 : Math.round(Math.sin(t * 3.2) * 0.6)
  k.rows(x0, y0 + dy, FIN, pal)
  k.rows(SW - x0 - FIN[0].length, y0 + dy, FIN, pal, true)
}

/* the sprite is painted into a small buffer first, so it can get a 1px outline and be mirrored */
const PAD = 6, BW = SW + PAD * 2, BH = SH + PAD * 2
let buf: HTMLCanvasElement | null = null, sil: HTMLCanvasElement | null = null

export interface DrawOpts { flip?: boolean; crack?: number }

/**
 * Draw a Cozmling standing with its feet at (x, y). `t` (seconds) drives breathing,
 * blinks and the pose animation. Returns where its antenna bulb is, so a room can
 * let it glow in the dark.
 */
export function drawCozmling(ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, stage: Stage, pose: Pose = 'idle', t = 0, opts: DrawOpts = {}) {
  let dy = Math.round(Math.sin(t * 2.6) * 0.6)
  if (pose === 'happy' || pose === 'play') dy = -Math.round(Math.abs(Math.sin(t * 5)) * 4)
  if (pose === 'sleep' || pose === 'sad') dy = 0
  if (stage === 'egg') dy = 0
  if (stage === 'guardian') dy += pose === 'sleep' ? -1 : -3 + Math.round(Math.sin(t * 1.8) * 1.2)   // it floats
  const rx = Math.round(x), ry = Math.round(y)
  const body = BODIES[look.body] ?? BODIES[0], glow = GLOWS[look.glow] ?? GLOWS[0]

  // a soft shadow on the ground, smaller while it's in the air
  const sw = ({ egg: 16, sprout: 22, cadet: 16, explorer: 14, guardian: 12 } as const)[stage] + Math.min(0, dy)
  ctx.fillStyle = 'rgba(0,0,0,.28)'
  ctx.fillRect(rx - sw / 2 + 1, ry - 2, sw - 2, 2); ctx.fillRect(rx - sw / 2, ry - 1, sw, 1)

  const X = rx - SW / 2 - PAD, Y = ry - SH + dy - PAD

  buf ??= Object.assign(document.createElement('canvas'), { width: BW, height: BH })
  sil ??= Object.assign(document.createElement('canvas'), { width: BW, height: BH })
  const b = buf.getContext('2d')!, s = sil.getContext('2d')!
  b.clearRect(0, 0, BW, BH)
  const tip = paint(b, PAD, PAD, look, stage, pose, t, opts.crack ?? 0)
  s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, BW, BH); s.drawImage(buf, 0, 0)
  s.globalCompositeOperation = 'source-in'; s.fillStyle = stage === 'egg' ? '#3a2f3a' : tones(body).line; s.fillRect(0, 0, BW, BH)
  s.globalCompositeOperation = 'source-over'

  ctx.save()
  if (opts.flip) { ctx.translate(rx * 2, 0); ctx.scale(-1, 1) }
  for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(sil, X + ddx, Y + ddy)
  ctx.drawImage(buf, X, Y)
  ctx.restore()

  if (stage === 'guardian') {
    // three little sparkles orbit the Guardian
    for (let i = 0; i < 3; i++) {
      const a = t * 1.3 + i * 2.094, sx = Math.round(rx + Math.cos(a) * 14), sy = Math.round(ry - 24 + dy + Math.sin(a) * 5)
      ctx.globalAlpha = Math.sin(a) > 0 ? 0.95 : 0.45
      ctx.fillStyle = glow; ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillRect(sx, sy - 1, 1, 3)
      ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, sy, 1, 1)
    }
    ctx.globalAlpha = 1
  }

  if (!tip) return null
  const gx = opts.flip ? rx * 2 - (X + PAD + tip.x) : X + PAD + tip.x, gy = Y + PAD + tip.y
  return { x: gx, y: gy, color: glow }
}

/** A soft glow around the antenna bulb (drawn over the room, so it shows in the dark too). */
export function drawBulbGlow(ctx: CanvasRenderingContext2D, g: { x: number; y: number; color: string } | null, t: number, strength = 1, core = false) {
  if (!g) return
  const p = (0.5 + 0.5 * Math.sin(t * 3)) * strength
  ctx.fillStyle = g.color
  for (const [r, a] of [[4, 0.1], [2.6, 0.16]] as const) {
    ctx.globalAlpha = a * (0.7 + 0.6 * p)
    for (let j = -Math.floor(r); j <= Math.floor(r); j++) { const w = Math.round(Math.sqrt(r * r - j * j)); ctx.fillRect(Math.round(g.x - w), Math.round(g.y + j), w * 2 + 1, 1) }
  }
  ctx.globalAlpha = 1
  if (core) { ctx.fillStyle = g.color; ctx.fillRect(Math.round(g.x - 1), Math.round(g.y - 1), 2, 2); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(g.x - 1), Math.round(g.y - 1), 1, 1) }
}

/* The pixel art itself, on the 40×44 grid with its top-left at (ox, oy). */
function paint(ctx: CanvasRenderingContext2D, ox: number, oy: number, look: Look, stage: Stage, pose: Pose, t: number, crack: number) {
  const T = tones(BODIES[look.body] ?? BODIES[0])
  const glow = GLOWS[look.glow] ?? GLOWS[0]
  const iris = EYES[look.eyes] ?? EYES[0]
  const girl = look.form === 'girl'
  const k = kit(ctx, ox, oy)
  const up = pose === 'happy' || pose === 'play'

  if (stage === 'egg') {
    const wob = Math.round(Math.sin(t * 2) * (pose === 'happy' || crack ? 1.5 : 0.6))
    const e = kit(ctx, ox + wob, oy)
    e.ball(20, 31, 9.5, 12.5, tones('#f4ead8'))
    const G = tones(glow)
    ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 2.4)
    for (const [sx, sy] of [[16, 25], [23, 29], [18, 35], [24, 38], [15, 31]]) { e.px(sx, sy, G.base); e.px(sx - 1, sy, G.light); e.px(sx + 1, sy, G.light); e.px(sx, sy - 1, G.light); e.px(sx, sy + 1, G.light) }
    ctx.globalAlpha = 1
    const CRACK = [[20, 19], [21, 20], [20, 21], [21, 22], [22, 23], [23, 24], [19, 22], [18, 23], [17, 24], [24, 25], [16, 25], [25, 26]]
    CRACK.slice(0, Math.min(CRACK.length, crack * 3)).forEach(([cx, cy]) => e.px(cx, cy, '#3a2f3a'))
    return null
  }

  if (stage === 'sprout') {
    // a baby: a big head on a little sitting body, feet out in front
    const hx = 20, hy = 28.5, hr = 10.5
    if (girl) fins(k, Math.floor(hx - hr) - 5, 24, t, pose, glow)
    k.ball(20, 38.5, 7.5, 5, T, false)
    if (up) { k.ball(10.5, 32, 2, 2.6, T, false); k.ball(29.5, 32, 2, 2.6, T, false) }
    else { k.ball(11.5, 38, 2, 2.8, T, false); k.ball(28.5, 38, 2, 2.8, T, false) }
    k.ball(hx, hy, hr, 9, T)
    face(k, pose, t, 12, 22, 25, 18, 33, T, iris, girl)
    k.ball(14.5, 42, 3, 2, T, false); k.ball(25.5, 42, 3, 2, T, false)
    return antenna(k, 21, 20, 6, t, pose, T, glow, false)
  }

  if (stage === 'cadet') {
    // a child: standing, still mostly head
    if (girl) fins(k, Math.floor(20 - 10.5) - 5, 17, t, pose, glow)
    k.limb(17.5, 36, 17.5, 41, 1.6, T); k.limb(22.5, 36, 22.5, 41, 1.6, T)
    k.ball(16.5, 42.2, 2.6, 1.6, T, false); k.ball(23.5, 42.2, 2.6, 1.6, T, false)
    k.ball(20, 33.5, 5.5, 5, T, false)
    if (up) { k.limb(15, 30, 11, 25, 1.5, T); k.limb(25, 30, 29, 25, 1.5, T) }
    else { k.limb(15, 30, 13.5, 35.5, 1.5, T); k.limb(25, 30, 26.5, 35.5, 1.5, T) }
    k.ball(20, 21, 10.5, 9, T)
    face(k, pose, t, 12, 22, 18, 18, 26, T, iris, girl)
    return antenna(k, 21, 12, 7, t, pose, T, glow, false)
  }

  // explorer and guardian: grown up — long limbs, slim body, the same big eyes
  const guardian = stage === 'guardian'
  if (girl) fins(k, Math.floor(20 - 10) - 5, 10, t, pose, glow)
  k.limb(17.6, 32, 17.4, 41.5, 1.7, T); k.limb(22.4, 32, 22.6, 41.5, 1.7, T)
  k.ball(16.5, 42.4, 2.6, 1.5, T, false); k.ball(23.5, 42.4, 2.6, 1.5, T, false)
  k.ball(20, 32, 4.4, 2.8, T, false)
  k.ball(20, 26.5, 4.8, 6.2, T, false)
  k.rect(18, 19, 4, 3, T.base); k.px(21, 20, T.dark)
  const hand = (hx: number, hy: number, dir: 1 | -1) => { k.px(hx - 1, hy + dir, T.base); k.px(hx, hy + dir * 2, T.base); k.px(hx + 1, hy + dir, T.base) }
  if (up) { k.limb(15.5, 23, 11, 15, 1.1, T); k.limb(24.5, 23, 29, 15, 1.1, T); hand(11, 15, -1); hand(29, 15, -1) }
  else { k.limb(15.5, 23, 13.5, 32, 1.1, T); k.limb(24.5, 23, 26.5, 32, 1.1, T); hand(13.5, 32, 1); hand(26.5, 32, 1) }
  if (guardian) {
    // glowing markings: a collar and the COZMC infinity on the chest
    const G = tones(glow)
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 2.2)
    for (const [mx, my] of [[16, 22], [17, 23], [18, 24], [21, 24], [22, 23], [23, 22]]) k.px(mx, my, G.light)
    for (const [mx, my] of [[17, 27], [18, 26], [18, 28], [19, 27], [20, 27], [21, 26], [21, 28], [22, 27]]) k.px(mx, my, G.base)
    ctx.globalAlpha = 1
  }
  k.ball(20, 13.5, 10, 8.5, T)
  face(k, pose, t, 12, 22, 11, 18, 19, T, iris, girl)
  return antenna(k, 21, 6, 6, t, pose, T, glow, guardian)
}
