/* ============================================================
   COZMLING HOMES — 144×96 pixel rooms. The still parts are painted
   once and cached; stars, lights and fireflies animate on top.
   ============================================================ */
import type { HomeId } from './care'

export const W = 144, H = 96
export const FLOOR_Y = 86          // where a Cozmling's feet touch the ground

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

/** The room behind the Cozmling. */
export function drawHome(ctx: CanvasRenderingContext2D, id: HomeId, t: number) {
  ctx.drawImage(still(id), 0, 0)
  if (id === 'grove') groveLive(ctx, t); else moonBaseLive(ctx, t)
}

/** Lights out: dims the room, then lets the things that glow shine through. */
export function drawNight(ctx: CanvasRenderingContext2D, id: HomeId, t: number) {
  ctx.fillStyle = 'rgba(3,2,14,.62)'; ctx.fillRect(0, 0, W, H)
  if (id === 'grove') groveLive(ctx, t, true)
  else {
    ctx.globalAlpha = 0.55; disc(ctx, EARTH.x, EARTH.y, EARTH.r, '#2a6fd6'); ctx.globalAlpha = 1
    const leds = ['#ff5a6a', '#ffb020', '#8dff6a', '#59e6ff']
    for (let i = 0; i < 8; i++) if (Math.sin(t * (1.3 + i * 0.37) + i) > 0) R(ctx, 102 + i * 4, 66, 2, 2, leds[i % 4])
  }
}

/** A small preview of a home for the picker. */
export function homeThumb(canvas: HTMLCanvasElement, id: HomeId) {
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  drawHome(ctx, id, 1.3)
}
