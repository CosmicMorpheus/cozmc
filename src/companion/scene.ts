/* ============================================================
   COZMLING HOMES. Every room canvas is CW×CH. Each home has its own
   pixel grid for the Cozmling (SPEC), always an exact multiple of the
   canvas so the alien stays crisp:
   - Star Loft: a painted room (an image) with animated touches on top.
   - Moon Base and Cosmic Grove: 144×96 rooms drawn in code, scaled 8×.
   ============================================================ */
import type { HomeId } from './care'

export const CW = 1152, CH = 768
export interface Spec { w: number; h: number; floorY: number; walk: [number, number]; tint?: string }
/** The Cozmling's grid per home: size, where its feet touch the floor, how far it wanders, and the room's light on it. */
export const SPEC: Record<HomeId, Spec> = {
  loft: { w: 192, h: 128, floorY: 107, walk: [50, 142], tint: 'rgba(38,46,150,.16)' },
  moonbase: { w: 144, h: 96, floorY: 86, walk: [34, 110] },
  grove: { w: 144, h: 96, floorY: 86, walk: [34, 110] },
}

/* the pixel rooms below are drawn on their own 144×96 grid */
const W = 144, H = 96, FLOOR_Y = 86

const rnd = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)
const disc = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, c: string) => {
  ctx.fillStyle = c
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
    const w = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)))
    if (w > 0 || Math.abs(y) < r) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1)
  }
}
const R = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h) }

/* ---------------- Moon Base ---------------- */
const MB = { wall: '#171b2c', seam: '#0e111d', lit: '#232a42', trim: '#2c3450', floor: '#20263a', tile: '#181d2d', edge: '#3b4462', metal: '#3a4158', metalL: '#5d6680' }
const PORT = { x: 50, y: 38, r: 17 }
const EARTH = { x: 56, y: 44, r: 6 }

function moonBase(ctx: CanvasRenderingContext2D) {
  R(ctx, 0, 0, W, H, MB.wall)
  // ceiling strip with three lamps
  R(ctx, 0, 0, W, 5, '#0b0d16'); R(ctx, 0, 5, W, 1, MB.trim)
  for (const lx of [22, 72, 122]) { R(ctx, lx - 4, 3, 8, 2, '#fff3c4'); ctx.globalAlpha = 0.05; for (let i = 1; i < 18; i++) R(ctx, lx - 4 - i, 5 + i, 8 + i * 2, 1, '#fff3c4'); ctx.globalAlpha = 1 }
  // wall panels
  for (let x = 0; x < W; x += 36) { R(ctx, x, 6, 1, 68, MB.seam); R(ctx, x + 1, 6, 1, 68, MB.lit) }
  R(ctx, 0, 24, W, 1, MB.seam)
  for (const [x, y] of [[4, 10], [40, 10], [76, 10], [112, 10], [4, 66], [76, 66], [112, 66]]) { R(ctx, x, y, 1, 1, MB.metal); R(ctx, x + 28, y, 1, 1, MB.metal) }
  // baseboard + floor with perspective tiles
  R(ctx, 0, 72, W, 2, MB.trim); R(ctx, 0, 74, W, H - 74, MB.floor); R(ctx, 0, 74, W, 1, MB.edge)
  for (let y = 79; y < H; y += 6) R(ctx, 0, y, W, 1, MB.tile)
  for (let i = -6; i <= 6; i++) { const x0 = W / 2 + i * 14; for (let y = 75; y < H; y++) R(ctx, Math.round(x0 + (x0 - W / 2) * ((y - 74) / 22) * 0.9), y, 1, 1, MB.tile) }
  // the porthole: space and the Earth
  disc(ctx, PORT.x, PORT.y, PORT.r + 1, '#0b0d16'); disc(ctx, PORT.x, PORT.y, PORT.r, MB.metal); disc(ctx, PORT.x, PORT.y, PORT.r - 1.5, MB.metalL)
  disc(ctx, PORT.x, PORT.y, PORT.r - 3, '#04060f')
  const r = rnd(7)
  for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (PORT.r - 4); R(ctx, Math.round(PORT.x + Math.cos(a) * d), Math.round(PORT.y + Math.sin(a) * d), 1, 1, r() > 0.7 ? '#ffffff' : '#7d86a8') }
  disc(ctx, EARTH.x, EARTH.y, EARTH.r, '#2a6fd6')
  for (const [x, y, w] of [[-3, -4, 3], [-4, -2, 4], [-2, -1, 3], [1, 1, 3], [0, 2, 4], [-3, 3, 2]]) R(ctx, EARTH.x + x, EARTH.y + y, w, 1, '#3f9a2c')
  for (const [x, y, w] of [[-1, -5, 3], [2, -3, 3], [-5, 1, 2], [-1, 4, 3]]) R(ctx, EARTH.x + x, EARTH.y + y, w, 1, '#e9f2ff')
  for (let y = -EARTH.r; y <= EARTH.r; y++) { const w = Math.floor(Math.sqrt(EARTH.r * EARTH.r - y * y)); if (w > 1) { ctx.globalAlpha = 0.45; R(ctx, EARTH.x + Math.ceil(w * 0.35), EARTH.y + y, w - Math.ceil(w * 0.35) + 1, 1, '#020414'); ctx.globalAlpha = 1 } }
  ctx.globalAlpha = 0.18; for (let i = 0; i < 8; i++) R(ctx, PORT.x - 9 + i, PORT.y - 3 - i, 1, 1, '#ffffff'); for (let i = 0; i < 5; i++) R(ctx, PORT.x - 6 + i, PORT.y + 1 - i, 1, 1, '#ffffff'); ctx.globalAlpha = 1
  for (const a of [0.25, 0.75, 1.25, 1.75]) { const bx = Math.round(PORT.x + Math.cos(a * Math.PI) * (PORT.r - 0.8)), by = Math.round(PORT.y + Math.sin(a * Math.PI) * (PORT.r - 0.8)); R(ctx, bx, by, 1, 1, '#9aa3c0') }
  // console + monitor on the right
  R(ctx, 100, 28, 36, 22, '#0b0d16'); R(ctx, 101, 29, 34, 20, '#2c3450'); R(ctx, 103, 31, 30, 16, '#041206')
  R(ctx, 116, 50, 4, 8, MB.metal)
  R(ctx, 96, 58, 44, 3, MB.metalL); R(ctx, 97, 61, 42, 16, MB.metal); R(ctx, 97, 61, 42, 1, '#252b3f'); R(ctx, 100, 64, 36, 10, '#2c3450')
  for (let i = 0; i < 8; i++) R(ctx, 102 + i * 4, 66, 2, 2, '#1b2030')
  R(ctx, 97, 77, 3, 9, '#2c3450'); R(ctx, 136, 77, 3, 9, '#2c3450')
  // sleep pod on the left
  R(ctx, 4, 62, 30, 2, MB.metalL); R(ctx, 3, 64, 32, 14, MB.metal); R(ctx, 5, 66, 28, 6, '#59e6ff'); R(ctx, 5, 66, 28, 1, '#a8f3ff'); R(ctx, 5, 71, 28, 1, '#2a8fa8')
  R(ctx, 6, 64, 8, 4, '#f1efe6'); R(ctx, 6, 67, 8, 1, '#c9c7bd')
  R(ctx, 4, 78, 3, 8, '#2c3450'); R(ctx, 31, 78, 3, 8, '#2c3450')
  // a little alien plant in a pot
  R(ctx, 84, 66, 8, 7, '#b0304e'); R(ctx, 83, 65, 10, 2, '#d0475c')
  for (const [x, y] of [[87, 64], [86, 62], [88, 61], [85, 60], [89, 59], [87, 58], [90, 62], [84, 63]]) R(ctx, x, y, 1, 2, '#8dff6a')
  R(ctx, 87, 57, 2, 2, '#ff8ad8')
}

function moonBaseLive(ctx: CanvasRenderingContext2D, t: number) {
  // twinkling stars in the porthole
  const r = rnd(11)
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (PORT.r - 5), ph = r() * 6
    if (Math.sin(t * 2 + ph) > 0.6) R(ctx, Math.round(PORT.x + Math.cos(a) * d), Math.round(PORT.y + Math.sin(a) * d), 1, 1, '#ffffff')
  }
  // monitor: the COZMC burn chart ticking along
  for (let x = 0; x < 30; x++) {
    const v = Math.sin((x + t * 6) * 0.45) * 3 + Math.sin((x + t * 6) * 0.13) * 3
    R(ctx, 103 + x, Math.round(39 - v), 1, 1, '#8dff6a')
    if (x % 6 === 0) R(ctx, 103 + x, 46, 1, 1, '#1d4a12')
  }
  R(ctx, 104, 32, 10, 1, '#2c6b1f'); if (Math.floor(t * 2) % 2) R(ctx, 116, 32, 2, 1, '#8dff6a')
  // console LEDs
  const leds = ['#ff5a6a', '#ffb020', '#8dff6a', '#59e6ff']
  for (let i = 0; i < 8; i++) if (Math.sin(t * (1.3 + i * 0.37) + i) > 0) R(ctx, 102 + i * 4, 66, 2, 2, leds[i % 4])
}

/* ---------------- Cosmic Grove ---------------- */
const GR = { sky: ['#0d0724', '#160b35', '#211048', '#2d1758', '#3a2268'], far: '#1c0f42', mid: '#0e0724', grass: '#1d4a2a', grassL: '#2f7a3d', soil: '#122c1a', moon: '#f6f0d8' }
const FLIES = Array.from({ length: 7 }, (_, i) => ({ x: 12 + ((i * 53) % 120), y: 40 + ((i * 29) % 34), ph: i * 1.7, sp: 0.4 + (i % 3) * 0.15 }))
const SHROOMS = [{ x: 37, c: '#59e6ff' }, { x: 43, c: '#ff8ad8', s: 1 }, { x: 128, c: '#59e6ff', s: 1 }, { x: 134, c: '#b06bff' }]

function grove(ctx: CanvasRenderingContext2D) {
  // dithered sky bands
  const band = 14
  GR.sky.forEach((c, i) => {
    R(ctx, 0, i * band, W, band, c)
    const next = GR.sky[i + 1]
    if (next) for (let y = i * band + band - 3; y < i * band + band; y++) for (let x = (y % 2); x < W; x += 2) R(ctx, x, y, 1, 1, next)
  })
  R(ctx, 0, GR.sky.length * band, W, H, GR.sky[GR.sky.length - 1])
  for (let y = 56; y < 72; y++) { ctx.globalAlpha = ((y - 56) / 16) * 0.5; R(ctx, 0, y, W, 1, '#5a3a8f') } ctx.globalAlpha = 1   // horizon glow
  const r = rnd(3)
  for (let i = 0; i < 46; i++) R(ctx, Math.floor(r() * W), Math.floor(r() * 48), 1, 1, r() > 0.8 ? '#ffffff' : '#8f86c9')
  // the big moon
  ctx.globalAlpha = 0.08; disc(ctx, 112, 22, 17, GR.moon); ctx.globalAlpha = 0.12; disc(ctx, 112, 22, 14, GR.moon); ctx.globalAlpha = 1
  disc(ctx, 112, 22, 11, GR.moon)
  for (const [x, y, rr] of [[108, 18, 2.5], [116, 25, 2], [113, 15, 1.2], [106, 26, 1.5]]) disc(ctx, x, y, rr, '#ddd3b2')
  for (let y = -11; y <= 11; y++) { const w = Math.floor(Math.sqrt(121 - y * y)); ctx.globalAlpha = 0.25; R(ctx, 112 + Math.ceil(w * 0.5), 22 + y, w - Math.ceil(w * 0.5) + 1, 1, '#9b8ec7'); ctx.globalAlpha = 1 }
  // far and near tree lines
  const pines = (base: number, c: string, seed: number, minH: number, maxH: number, step: number) => {
    const q = rnd(seed)
    for (let x = -6; x < W + 6; x += step + Math.floor(q() * 4)) {
      const h = minH + Math.floor(q() * (maxH - minH)), w = Math.max(3, Math.floor(h / 2.6))
      for (let y = 0; y < h; y++) { const ww = Math.max(1, Math.round((y / h) * w)); R(ctx, x - ww, base - h + y, ww * 2 + 1, 1, c) }
      R(ctx, x, base, 1, 4, c)
    }
  }
  pines(70, GR.far, 21, 14, 26, 9)
  pines(74, GR.mid, 5, 18, 34, 13)
  // ground: dithered grass meeting the soil
  R(ctx, 0, 72, W, H - 72, GR.grass)
  for (let x = 0; x < W; x++) if ((x * 7) % 5 < 2) R(ctx, x, 71, 1, 1, GR.grass)
  for (let y = 88; y < H; y++) for (let x = (y % 2); x < W; x += 2) R(ctx, x, y, 1, 1, GR.soil)
  const g = rnd(9)
  for (let i = 0; i < 40; i++) { const x = Math.floor(g() * W), y = 74 + Math.floor(g() * 18); R(ctx, x, y, 1, 1, GR.grassL); R(ctx, x + 1, y - 1, 1, 1, GR.grassL) }
  // a woven nest with a soft blanket, on the left
  for (let y = 0; y < 9; y++) { const w = Math.round(Math.sin(((y + 2) / 11) * Math.PI) * 13) + 12; R(ctx, 19 - Math.floor(w / 2), 74 + y, w, 1, y < 2 ? '#8a5e3a' : y % 2 ? '#6b4428' : '#5a3820') }
  R(ctx, 9, 73, 20, 2, '#b06bff'); R(ctx, 10, 72, 18, 1, '#cf9bff'); R(ctx, 8, 74, 3, 1, '#7a3dff')
  for (const x of [10, 15, 21, 26]) R(ctx, x, 77, 2, 1, '#8a5e3a')
  // mossy log on the right
  R(ctx, 100, 74, 30, 8, '#4a2f22'); R(ctx, 100, 74, 30, 2, '#2f7a3d'); R(ctx, 128, 75, 4, 6, '#6b4428'); R(ctx, 129, 76, 2, 4, '#8a5e3a')
  // mushroom stems (caps glow in the live pass)
  for (const s of SHROOMS) { const h = s.s ? 4 : 6; R(ctx, s.x, FLOOR_Y - h - 2, 2, h, '#e9e3d0') }
}

function groveLive(ctx: CanvasRenderingContext2D, t: number, glowOnly = false) {
  if (!glowOnly) {
    const r = rnd(31)
    for (let i = 0; i < 10; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * 46), ph = r() * 6; if (Math.sin(t * 1.6 + ph) > 0.7) R(ctx, x, y, 1, 1, '#ffffff') }
  }
  for (const s of SHROOMS) {
    const h = s.s ? 4 : 6, y = FLOOR_Y - h - 2, k = 0.5 + 0.5 * Math.sin(t * 1.8 + s.x)
    ctx.globalAlpha = 0.12 + k * 0.12; disc(ctx, s.x + 1, y, 6, s.c); ctx.globalAlpha = 1
    R(ctx, s.x - 2, y - 2, 6, 2, s.c); R(ctx, s.x - 1, y - 3, 4, 1, s.c); R(ctx, s.x, y - 2, 1, 1, '#ffffff')
  }
  for (const f of FLIES) {
    const x = f.x + Math.sin(t * f.sp + f.ph) * 10, y = f.y + Math.sin(t * f.sp * 1.7 + f.ph) * 6
    if (Math.sin(t * 2.2 + f.ph * 3) > -0.3) { ctx.globalAlpha = 0.3; R(ctx, Math.round(x) - 1, Math.round(y) - 1, 3, 3, '#ffe98a'); ctx.globalAlpha = 1; R(ctx, Math.round(x), Math.round(y), 1, 1, '#fff6c4') }
  }
}

/* ---------------- Star Loft (painted) ----------------
   The art is 1536×1024; everything animated below is placed in those
   coordinates, so it lines up with the picture. */
const ART_W = 1536, ART_H = 1024
let loftImg: HTMLImageElement | null = null
const whenLoaded: (() => void)[] = []
function loftArt() {
  if (!loftImg) {
    loftImg = new Image()
    loftImg.decoding = 'async'
    loftImg.onload = () => whenLoaded.splice(0).forEach(f => f())
    loftImg.src = '/assets/rooms/star-loft.webp'
  }
  return loftImg.complete && loftImg.naturalWidth ? loftImg : null
}
/** Run `cb` once the painted rooms have loaded (right away if they already have). */
export function onHomeArt(cb: () => void) { if (loftArt()) cb(); else whenLoaded.push(cb) }

const PLANETS: [number, number, number][] = [[1290, 760, 565], [630, 278, 74], [748, 278, 18], [1270, 215, 40], [1240, 395, 54]]
const inSky = (x: number, y: number) => {
  const window = x > 480 && x < 1360 && y > 105 && y < 515 && y > 400 - (x - 455) * 1.75   // the big window (its left edge is a strut)
  const corner = x > 250 && x < 450 && y > 25 && y < 300                                    // behind the orrery
  return (window || corner) && !PLANETS.some(([px, py, r]) => (x - px) ** 2 + (y - py) ** 2 < r * r)
}
const STARS = (() => {
  const r = rnd(42), out: { x: number; y: number; ph: number; sp: number; big: boolean; c: string }[] = []
  while (out.length < 46) {
    const x = 250 + r() * 1110, y = 25 + r() * 490
    if (inSky(x, y)) out.push({ x, y, ph: r() * 6.28, sp: 0.8 + r() * 1.6, big: r() > 0.8, c: r() > 0.6 ? '#bcd4ff' : '#ffffff' })
  }
  return out
})()
const LANTERNS: [number, number, number][] = [[70, 612, 95], [318, 520, 55], [1288, 572, 70]]
const JELLIES: [number, number][] = [[1465, 290], [1500, 348], [1435, 388]]
const MOTES = Array.from({ length: 26 }, (_, i) => ({ x: (i * 397) % 1500, y: 300 + ((i * 211) % 620), ph: i * 0.77, sp: 6 + (i % 5) * 3 }))
const BUBBLES = Array.from({ length: 14 }, (_, i) => ({ x: 1396 + ((i * 41) % 118), off: (i * 0.137) % 1, sp: 38 + (i % 4) * 14, r: 2 + (i % 3) }))

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, a: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.globalAlpha = a; ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1
}
const sparkle = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, c: string) => {
  ctx.fillStyle = c; ctx.fillRect(x - s, y - 1, s * 2 + 1, 3); ctx.fillRect(x - 1, y - s, 3, s * 2 + 1)
}

function loft(ctx: CanvasRenderingContext2D, t: number, night: boolean) {
  ctx.save()
  ctx.scale(CW / ART_W, CH / ART_H)
  if (night) { ctx.fillStyle = 'rgba(4,3,22,.6)'; ctx.fillRect(0, 0, ART_W, ART_H) }
  else {
    const img = loftArt()
    ctx.imageSmoothingEnabled = true
    if (img) ctx.drawImage(img, 0, 0, ART_W, ART_H)
    else { ctx.fillStyle = '#0b0b2a'; ctx.fillRect(0, 0, ART_W, ART_H) }
  }

  // twinkling stars in the windows, and now and then a shooting star
  for (const st of STARS) {
    const k = Math.sin(t * st.sp + st.ph)
    if (k < 0.2) continue
    ctx.globalAlpha = (k - 0.2) * (night ? 1.2 : 0.9)
    sparkle(ctx, Math.round(st.x), Math.round(st.y), st.big ? 6 : 3, st.c)
  }
  ctx.globalAlpha = 1
  const cycle = 11, k = t % cycle, n = Math.floor(t / cycle)
  if (k < 0.9) {
    const r = rnd(n * 7 + 3), x0 = 560 + r() * 360, y0 = 120 + r() * 70, f = k / 0.9
    const x = x0 + f * 260, y = y0 + f * 95
    const g = ctx.createLinearGradient(x - 110, y - 40, x, y)
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.95)')
    ctx.globalAlpha = Math.sin(f * Math.PI)
    ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 110, y - 40); ctx.lineTo(x, y); ctx.stroke()
    ctx.globalAlpha = 1
  }

  // lanterns flicker; with the lights out they're just embers
  for (const [x, y, r] of LANTERNS) {
    const fl = 0.75 + 0.15 * Math.sin(t * 9 + x) + 0.1 * Math.sin(t * 23 + y)
    glow(ctx, x, y, r * (night ? 0.55 : 1.4), '#ffb347', (night ? 0.22 : 0.32) * fl)
  }

  // the jellyfish tank: rising bubbles, jellies that pulse
  for (const [x, y] of JELLIES) glow(ctx, x, y, 42, '#7fe6ff', (night ? 0.38 : 0.22) * (0.6 + 0.4 * Math.sin(t * 1.7 + x)))
  ctx.strokeStyle = '#c9f6ff'; ctx.lineWidth = 2
  for (const b of BUBBLES) {
    const f = (t * b.sp / 370 + b.off) % 1, y = 585 - f * 370, x = b.x + Math.sin(t * 2 + b.off * 9) * 4
    ctx.globalAlpha = (night ? 0.8 : 0.6) * Math.min(1, (1 - f) * 4)
    ctx.beginPath(); ctx.arc(x, y, b.r, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.globalAlpha = 1

  if (!night) {
    // a bead orbits the hanging orrery
    const a = t * 0.7, bx = 375 + Math.cos(a) * 112, by = 142 + Math.sin(a) * 40
    ctx.globalAlpha = Math.sin(a) > 0 ? 1 : 0.55
    glow(ctx, bx, by, 16, '#ffd58a', 0.5)
    ctx.fillStyle = '#e8b45c'; ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#fff3cf'; ctx.fillRect(bx - 3, by - 3, 3, 3)
    ctx.globalAlpha = 1
    // dust drifting in the lamplight
    for (const m of MOTES) {
      const x = (m.x + Math.sin(t * 0.3 + m.ph) * 30 + t * m.sp) % ART_W, y = m.y + Math.sin(t * 0.5 + m.ph * 2) * 18
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t * 1.3 + m.ph)
      ctx.fillStyle = '#ffd9a0'; ctx.fillRect(Math.round(x), Math.round(y), 3, 3)
    }
    ctx.globalAlpha = 1
  }
  ctx.restore()
}

/* ---------------- public ---------------- */
const cache = new Map<HomeId, HTMLCanvasElement>()
function still(id: HomeId) {
  let c = cache.get(id)
  if (!c) {
    c = Object.assign(document.createElement('canvas'), { width: W, height: H })
    const ctx = c.getContext('2d')!
    if (id === 'grove') grove(ctx); else moonBase(ctx)
    cache.set(id, c)
  }
  return c
}

/** The room behind the Cozmling, filling a CW×CH canvas. */
export function drawHome(ctx: CanvasRenderingContext2D, id: HomeId, t: number) {
  if (id === 'loft') return loft(ctx, t, false)
  ctx.save()
  ctx.scale(CW / W, CH / H)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(still(id), 0, 0)
  if (id === 'grove') groveLive(ctx, t); else moonBaseLive(ctx, t)
  ctx.restore()
}

/** Lights out: dims the room, then lets the things that glow shine through. */
export function drawNight(ctx: CanvasRenderingContext2D, id: HomeId, t: number) {
  if (id === 'loft') return loft(ctx, t, true)
  ctx.save()
  ctx.scale(CW / W, CH / H)
  ctx.fillStyle = 'rgba(3,2,14,.62)'; ctx.fillRect(0, 0, W, H)
  if (id === 'grove') groveLive(ctx, t, true)
  else {
    ctx.globalAlpha = 0.55; disc(ctx, EARTH.x, EARTH.y, EARTH.r, '#2a6fd6'); ctx.globalAlpha = 1
    const leds = ['#ff5a6a', '#ffb020', '#8dff6a', '#59e6ff']
    for (let i = 0; i < 8; i++) if (Math.sin(t * (1.3 + i * 0.37) + i) > 0) R(ctx, 102 + i * 4, 66, 2, 2, leds[i % 4])
  }
  ctx.restore()
}

export const THUMB_W = 288, THUMB_H = 192
/** A small preview of a home for the picker (painted rooms fill in once loaded). */
export function homeThumb(canvas: HTMLCanvasElement, id: HomeId) {
  canvas.width = THUMB_W; canvas.height = THUMB_H
  const ctx = canvas.getContext('2d')!
  const paint = () => { ctx.save(); ctx.scale(THUMB_W / CW, THUMB_H / CH); drawHome(ctx, id, 1.3); ctx.restore() }
  paint()
  if (id === 'loft') onHomeArt(paint)
}
