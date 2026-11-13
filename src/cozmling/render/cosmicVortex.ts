/* ============================================================
   THE COSMIC VORTEX — a living sky behind a Cozmling's birth chart.

   A dark sphere with a crimson rim sits in the hole of a tilted disk of golden dust. The disk is
   drawn as many thin contour lines, like rings in agate or a fingerprint. They flow around the
   sphere (inner rings faster), drift slowly inward and gently change shape. Around them are
   thousands of small stars, a few brighter ones that twinkle, and midnight clouds whose edges
   glow crimson.

   It is all drawn on one 2D canvas, with no library:
   - Built once, at each new size: the stars, and the clouds (contour lines traced from a noise
     field). These are the expensive parts, so they are kept.
   - Drawn every frame: the cached layers, then the rings (a few thousand points), the dust motes,
     the twinkling stars, the sphere and its glow. A few milliseconds even on a phone.
   Everything that moves either moves smoothly forever (the sky drifts on sine waves) or fades out
   before it wraps round (the rings), so the loop never jumps.

   The palette and the seed are parameters, so a Cozmling could one day have a sky of its own;
   for now every observatory uses ORIGIN_PALETTE and the same seed.
   ============================================================ */

export type RGB = readonly [number, number, number]
export interface VortexPalette {
  /** the empty sky */ space: RGB
  /** the faint blue in the dark */ wash: RGB
  /** cloud bodies */ cloud: RGB
  /** cloud edges */ edge: RGB
  /** lines inside clouds */ vein: RGB
  /** the disk, from its hot inner edge to its cool outer edge */ dust: readonly RGB[]
  /** the sphere's rim */ rim: RGB
  /** the light around the sphere */ glow: RGB
  /** star tints */ stars: readonly RGB[]
  /** light streaming out of the sphere */ streak: readonly RGB[]
}
/** Crimson, gold and midnight, with Nebula Cyan (#00BFFE) as the electric blue. */
export const ORIGIN_PALETTE: VortexPalette = {
  space: [2, 2, 7],
  wash: [16, 26, 78],
  cloud: [9, 11, 30],
  edge: [222, 36, 34],
  vein: [0, 150, 205],
  dust: [[255, 248, 228], [255, 216, 124], [242, 164, 70], [196, 62, 44], [0, 191, 254]],
  streak: [[0, 191, 254], [255, 255, 255], [255, 214, 140]],
  rim: [232, 40, 34],
  glow: [255, 186, 92],
  stars: [[255, 255, 255], [150, 228, 255], [255, 228, 184]],
}

export interface Sphere { x: number; y: number; r: number }
export type Quality = 'high' | 'low'

/* ---------------- small pure helpers (tests/cosmic-vortex.test.ts) ---------------- */

/** A repeatable random sequence for a seed. */
export function rng(seed: string): () => number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
const mix = (a: RGB, b: RGB, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${Math.max(0, Math.min(1, a)).toFixed(3)})`
/** A colour along a list of colours, 0 to 1. */
export function along(list: readonly RGB[], u: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, u)) * (list.length - 1), i = Math.min(list.length - 2, Math.floor(x))
  return mix(list[i], list[i + 1], x - i)
}

/** Device pixels per CSS pixel: as sharp as the screen allows, but never more than `budget` pixels in all. */
export function dprFor(cssW: number, cssH: number, deviceDpr: number, budget = 2_600_000, cap = 1.5): number {
  const fit = Math.sqrt(budget / Math.max(1, cssW * cssH))
  return Math.max(0.5, Math.min(deviceDpr || 1, cap, fit))
}

/** The disk around a sphere of radius r: tilted a little and seen from a little above, wider than the
    sphere on both sides. Its far side passes behind the sphere and its near side in front. */
export const DISK = { k: 0.4, tilt: 0.15, inner: 1.16, outer: 3.4 } as const
export function diskFor(r: number) {
  return { rIn: r * DISK.inner, rOut: r * DISK.outer, k: DISK.k, tilt: DISK.tilt }
}
/** How far up and down the disk reaches from the centre of the sphere. */
export const diskHeight = (r: number) => r * DISK.outer * DISK.k
/** A streak of light at time t: how far out it is (0 = leaving the sphere, 1 = leaving the screen) and how bright. */
export function streakAt(t: number, period: number, offset: number): { u: number; alpha: number } {
  const u = (((t / period + offset) % 1) + 1) % 1
  return { u, alpha: smooth(0, 0.18, u) * (1 - smooth(0.7, 1, u)) }
}

/** Where ring i of n is at time t (seconds), from 0 (inner edge) to 1 (outer edge). Rings drift slowly inward. */
export function ringPhase(i: number, n: number, t: number, period = 150): number { return (((i / n - t / period) % 1) + 1) % 1 }
/** Rings fade in at the outer edge and out at the inner edge, so wrapping round is never seen. */
export const ringFade = (s: number) => smooth(0, 0.08, s) * (1 - smooth(0.84, 1, s))
/** A star's brightness, 0 to 1, smooth and endless. */
export const twinkle = (t: number, rate: number, phase: number) => 0.5 + 0.5 * Math.sin(t * rate + phase)

/* ---------------- noise, for the clouds ---------------- */

function valueNoise(rand: () => number) {
  const perm = new Uint8Array(512), val = new Float32Array(256)
  for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = rand() }
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]] }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]
  const fade = (t: number) => t * t * (3 - 2 * t)
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255
    const a = val[perm[X + perm[Y]]], b = val[perm[X + 1 + perm[Y]]], c = val[perm[X + perm[Y + 1]]], d = val[perm[X + 1 + perm[Y + 1]]]
    const u = fade(xf), v = fade(yf)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
  }
}
function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves = 4) {
  let s = 0, amp = 0.5, f = 1, norm = 0
  for (let o = 0; o < octaves; o++) { s += amp * noise(x * f, y * f); norm += amp; f *= 2.03; amp *= 0.5 }
  return s / norm
}

/** Lines where a grid of values crosses a level (marching squares), added to the current path. */
function contourPath(ctx: CanvasRenderingContext2D, v: Float32Array, nx: number, ny: number, level: number, cell: number, ox: number, oy: number) {
  const seg = (x1: number, y1: number, x2: number, y2: number) => { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2) }
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const tl = v[j * nx + i], tr = v[j * nx + i + 1], br = v[(j + 1) * nx + i + 1], bl = v[(j + 1) * nx + i]
    const idx = (tl > level ? 8 : 0) | (tr > level ? 4 : 0) | (br > level ? 2 : 0) | (bl > level ? 1 : 0)
    if (idx === 0 || idx === 15) continue
    const x = ox + i * cell, y = oy + j * cell
    const top = () => [x + (cell * (level - tl)) / (tr - tl), y] as const
    const right = () => [x + cell, y + (cell * (level - tr)) / (br - tr)] as const
    const bottom = () => [x + (cell * (level - bl)) / (br - bl), y + cell] as const
    const left = () => [x, y + (cell * (level - tl)) / (bl - tl)] as const
    const line = (a: readonly [number, number], b: readonly [number, number]) => seg(a[0], a[1], b[0], b[1])
    switch (idx) {
      case 1: case 14: line(left(), bottom()); break
      case 2: case 13: line(bottom(), right()); break
      case 3: case 12: line(left(), right()); break
      case 4: case 11: line(top(), right()); break
      case 5: line(top(), right()); line(left(), bottom()); break
      case 6: case 9: line(top(), bottom()); break
      case 7: case 8: line(left(), top()); break
      case 10: line(left(), top()); line(bottom(), right()); break
    }
  }
}

/* ---------------- the renderer ---------------- */

export interface Vortex {
  /** Size in CSS pixels; rebuilds the cached sky. */
  resize(cssW: number, cssH: number, dpr: number): void
  /** Draws one frame at time t (seconds). `sphere` in CSS pixels, or null for sky only. */
  frame(t: number, sphere: Sphere | null): void
}

interface Ring { p: [number, number, number]; q: number; seed: number }
interface Mote { s: number; a: number; size: number; tw: number; ph: number }
interface Streak { a: number; period: number; offset: number; tint: number; width: number }
interface Star { x: number; y: number; size: number; tw: number; ph: number; tint: number }

export function createVortex(canvas: HTMLCanvasElement, opts: { seed?: string; palette?: VortexPalette; quality?: Quality } = {}): Vortex {
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('no 2D canvas')
  const pal = opts.palette ?? ORIGIN_PALETTE, quality = opts.quality ?? 'high', seed = opts.seed ?? 'origin'
  const HIGH = quality === 'high'
  const RINGS = HIGH ? 46 : 30, MOTES = HIGH ? 230 : 110, TWINKLES = HIGH ? 36 : 20, POINTS = HIGH ? 220 : 130, STREAKS = HIGH ? 46 : 24
  const r0 = rng(`${seed}:disk`)
  const rings: Ring[] = Array.from({ length: RINGS }, () => ({ p: [r0() * 6.283, r0() * 6.283, r0() * 6.283], q: r0() * 6.283, seed: r0() }))
  const motes: Mote[] = Array.from({ length: MOTES }, () => ({ s: Math.pow(r0(), 1.7), a: r0() * 6.283, size: 0.6 + Math.pow(r0(), 3) * 1.9, tw: 0.8 + r0() * 3, ph: r0() * 6.283 }))
  const streaks: Streak[] = Array.from({ length: STREAKS }, () => ({ a: r0() * 6.283, period: 8 + r0() * 7, offset: r0(), tint: Math.floor(r0() * 3), width: 0.6 + r0() * 0.9 }))

  let W = 0, H = 0, DPR = 1, stars: Star[] = []
  const base = document.createElement('canvas'), clouds = document.createElement('canvas')
  const MARGIN = 18                                   // the clouds are drawn a little larger than the screen, so their drift never shows an edge
  const sprite = (size: number, paint: (g: CanvasRenderingContext2D, s: number) => void) => {
    const c = document.createElement('canvas'); c.width = c.height = size
    paint(c.getContext('2d')!, size); return c
  }
  // a four-pointed star: a soft core and two thin spikes
  const starSprite = sprite(64, (g, s) => {
    const m = s / 2, core = g.createRadialGradient(m, m, 0, m, m, m * 0.42)
    core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(0.25, 'rgba(255,240,215,.55)'); core.addColorStop(1, 'rgba(255,220,180,0)')
    g.fillStyle = core; g.fillRect(0, 0, s, s)
    for (const [w, h] of [[s, 1.6], [1.6, s]]) {
      const lg = w > h ? g.createLinearGradient(0, m, s, m) : g.createLinearGradient(m, 0, m, s)
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.95)'); lg.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = lg; g.fillRect(m - w / 2, m - h / 2, w, h)
    }
  })
  const moteSprite = sprite(24, (g, s) => {
    const m = s / 2, rg = g.createRadialGradient(m, m, 0, m, m, m)
    rg.addColorStop(0, 'rgba(255,250,232,1)'); rg.addColorStop(0.3, rgba(pal.dust[1], 0.7)); rg.addColorStop(1, rgba(pal.dust[2], 0))
    g.fillStyle = rg; g.fillRect(0, 0, s, s)
  })
  const haloSprite = sprite(256, (g, s) => {
    const m = s / 2, rg = g.createRadialGradient(m, m, 0, m, m, m)
    rg.addColorStop(0, rgba(pal.glow, 0.55)); rg.addColorStop(0.28, rgba(pal.glow, 0.22)); rg.addColorStop(0.6, rgba(pal.dust[3], 0.07)); rg.addColorStop(1, rgba(pal.dust[3], 0))
    g.fillStyle = rg; g.fillRect(0, 0, s, s)
  })

  /** The parts that never move: the dark, its faint blue, thousands of small stars. */
  function buildBase() {
    base.width = Math.round(W * DPR); base.height = Math.round(H * DPR)
    const g = base.getContext('2d')!, rand = rng(`${seed}:stars`)
    g.setTransform(DPR, 0, 0, DPR, 0, 0)
    g.fillStyle = rgba(pal.space, 1); g.fillRect(0, 0, W, H)
    for (const [fx, fy, rr, a] of [[0.22, 0.72, 0.95, 0.42], [0.86, 0.16, 0.7, 0.3], [0.6, 0.45, 0.55, 0.14]] as const) {
      const rg = g.createRadialGradient(W * fx, H * fy, 0, W * fx, H * fy, Math.max(W, H) * rr)
      rg.addColorStop(0, rgba(pal.wash, a)); rg.addColorStop(1, rgba(pal.wash, 0))
      g.fillStyle = rg; g.fillRect(0, 0, W, H)
    }
    const count = Math.round((W * H) / (HIGH ? 240 : 330))
    for (let i = 0; i < count; i++) {
      const b = Math.pow(rand(), 3), size = b > 0.82 ? 1.6 : b > 0.45 ? 1.1 : 0.75
      g.fillStyle = rgba(pal.stars[Math.floor(rand() * pal.stars.length)], 0.16 + 0.8 * b)
      g.fillRect(rand() * W, rand() * H, size, size)
    }
    const tw = rng(`${seed}:twinkle`)
    stars = Array.from({ length: TWINKLES }, () => ({ x: tw() * W, y: tw() * H, size: 9 + Math.pow(tw(), 2) * 22, tw: 0.5 + tw() * 1.6, ph: tw() * 6.283, tint: Math.floor(tw() * pal.stars.length) }))
  }

  /** Midnight clouds with glowing crimson edges: contour lines of a warped noise field, thicker toward the corners. */
  function buildClouds() {
    const cw = W + MARGIN * 2, ch = H + MARGIN * 2
    clouds.width = Math.round(cw * DPR); clouds.height = Math.round(ch * DPR)
    const g = clouds.getContext('2d')!
    g.setTransform(DPR, 0, 0, DPR, 0, 0)
    g.clearRect(0, 0, cw, ch)
    const cell = Math.max(7, Math.min(14, Math.min(W, H) / 70))
    const nx = Math.ceil(cw / cell) + 1, ny = Math.ceil(ch / cell) + 1
    const noise = valueNoise(rng(`${seed}:clouds`)), v = new Float32Array(nx * ny)
    const scale = 1 / Math.max(150, Math.min(W, H) * 0.3)
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = i * cell * scale, y = j * cell * scale
      const wx = fbm(noise, x + 3.1, y + 7.7, 3), wy = fbm(noise, x - 5.2, y + 1.3, 3)
      const d = fbm(noise, x + 2.4 * wx, y + 2.4 * wy, 5)
      // clouds gather toward the edges and corners and leave the middle open
      const px = (i * cell - MARGIN) / W - 0.5, py = (j * cell - MARGIN) / H - 0.5
      const edge = smooth(0.3, 0.52, Math.max(Math.abs(px), Math.abs(py) * 0.85)) * smooth(0.1, 0.42, Math.hypot(px, py))
      v[j * nx + i] = d * (0.5 + 0.66 * edge) - 0.22 * (1 - edge)
    }
    const L = 0.5
    // bodies: soft, from a tiny image of the field scaled up
    const img = document.createElement('canvas'); img.width = nx; img.height = ny
    const ig = img.getContext('2d')!, data = ig.createImageData(nx, ny)
    for (let k = 0; k < nx * ny; k++) {
      const a = smooth(L - 0.03, L + 0.05, v[k]), lift = smooth(L, L + 0.25, v[k]) * 0.6
      const c = mix(pal.cloud, pal.vein, lift * 0.35)
      data.data[k * 4] = c[0]; data.data[k * 4 + 1] = c[1]; data.data[k * 4 + 2] = c[2]; data.data[k * 4 + 3] = Math.round(a * 236)
    }
    ig.putImageData(data, 0, 0)
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
    g.drawImage(img, 0, 0, nx, ny, 0, 0, (nx - 1) * cell + cell, (ny - 1) * cell + cell)
    // the lines: midnight veins inside, crimson edges glowing outside
    g.lineCap = 'round'; g.lineJoin = 'round'
    for (const [lv, a] of [[L + 0.12, 0.35], [L + 0.19, 0.28], [L + 0.26, 0.22]] as const) {
      g.beginPath(); contourPath(g, v, nx, ny, lv, cell, 0, 0); g.strokeStyle = rgba(pal.vein, a); g.lineWidth = 0.9; g.stroke()
    }
    for (const [lv, a] of [[L, 1], [L + 0.022, 0.7], [L + 0.044, 0.48], [L + 0.066, 0.3]] as const) {
      g.beginPath(); contourPath(g, v, nx, ny, lv, cell, 0, 0)
      g.strokeStyle = rgba(pal.edge, 0.08 * a); g.lineWidth = 7; g.stroke()
      g.strokeStyle = rgba(pal.edge, 0.18 * a); g.lineWidth = 3; g.stroke()
      g.strokeStyle = rgba(mix(pal.edge, [255, 120, 100], 0.3), 0.72 * a); g.lineWidth = 1.1; g.stroke()
    }
  }

  function resize(cssW: number, cssH: number, dpr: number) {
    W = Math.max(1, Math.round(cssW)); H = Math.max(1, Math.round(cssH)); DPR = dpr
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR)
    buildBase(); buildClouds()
  }

  /* --- one frame --- */
  const xs = new Float32Array(POINTS + 1), ys = new Float32Array(POINTS + 1)
  function frame(t: number, sphere: Sphere | null) {
    if (!W) return
    ctx!.setTransform(1, 0, 0, 1, 0, 0)
    ctx!.globalCompositeOperation = 'source-over'; ctx!.globalAlpha = 1
    ctx!.drawImage(base, 0, 0)
    ctx!.setTransform(DPR, 0, 0, DPR, 0, 0)

    // bright stars twinkle, each at its own pace
    for (const s of stars) {
      const k = twinkle(t, s.tw, s.ph), size = s.size * (0.55 + 0.45 * k)
      ctx!.globalAlpha = 0.25 + 0.7 * k
      ctx!.drawImage(starSprite, s.x - size / 2, s.y - size / 2, size, size)
    }
    ctx!.globalAlpha = 1

    // the clouds drift, almost too slowly to notice
    const dx = Math.sin((t / 97) * 6.283) * 11, dy = Math.sin((t / 131) * 6.283 + 1.3) * 7
    ctx!.drawImage(clouds, 0, 0, clouds.width, clouds.height, -MARGIN + dx, -MARGIN + dy, W + MARGIN * 2, H + MARGIN * 2)

    if (sphere && sphere.r > 4) drawSphereAndDisk(t, sphere)

    // a soft vignette keeps the eye in the middle
    const vg = ctx!.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.35, W / 2, H * 0.45, Math.max(W, H) * 0.78)
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)')
    ctx!.fillStyle = vg; ctx!.fillRect(0, 0, W, H)
  }

  function drawSphereAndDisk(t: number, s: Sphere) {
    const c = ctx!, d = diskFor(s.r), cos = Math.cos(d.tilt), sin = Math.sin(d.tilt)
    const pulse = 0.88 + 0.12 * Math.sin((t / 9) * 6.283)
    const toScreen = (X: number, Y: number, out: { x: number; y: number }) => { out.x = s.x + X * cos - Y * sin; out.y = s.y + X * sin + Y * cos }
    const pt = { x: 0, y: 0 }

    // light streaming out from behind the sphere, as if the sky were rushing past
    c.lineCap = 'round'
    const reach = Math.hypot(Math.max(s.x, W - s.x), Math.max(s.y, H - s.y)) * 1.05
    for (const k of streaks) {
      const { u, alpha } = streakAt(t, k.period, k.offset)
      if (alpha < 0.02) continue
      const dist = s.r * 1.05 * Math.pow(reach / (s.r * 1.05), u), len = 4 + dist * 0.07
      const ca = Math.cos(k.a), sa = Math.sin(k.a)
      c.beginPath(); c.moveTo(s.x + ca * (dist - len), s.y + sa * (dist - len)); c.lineTo(s.x + ca * dist, s.y + sa * dist)
      c.strokeStyle = rgba(pal.streak[k.tint], alpha * 0.42); c.lineWidth = k.width * (0.7 + 0.8 * u); c.stroke()
    }

    // the warm light around the disk and the sphere, breathing slowly
    c.globalCompositeOperation = 'lighter'
    c.save(); c.translate(s.x, s.y); c.rotate(d.tilt)
    c.globalAlpha = 0.55 * pulse
    c.drawImage(haloSprite, -d.rOut * 0.95, -d.rOut * 0.95 * d.k * 1.25, d.rOut * 1.9, d.rOut * 1.9 * d.k * 1.25)
    c.globalAlpha = 0.45 * pulse
    c.drawImage(haloSprite, -s.r * 2.1, -s.r * 2.1, s.r * 4.2, s.r * 4.2)
    c.restore()
    c.globalAlpha = 1
    c.globalCompositeOperation = 'source-over'

    // the disk's body: a faint midnight band
    c.beginPath()
    c.ellipse(s.x, s.y, d.rOut * 1.02, d.rOut * 1.02 * d.k, d.tilt, 0, Math.PI * 2)
    c.ellipse(s.x, s.y, d.rIn * 0.97, d.rIn * 0.97 * d.k, d.tilt, 0, Math.PI * 2)
    c.fillStyle = 'rgba(14,18,48,.34)'; c.fill('evenodd')

    // the rings: wavy contour lines flowing round (inner faster), drifting inward, changing shape.
    // The side coming toward us is brighter. The far half goes behind the sphere, the near half in front.
    c.lineJoin = 'round'
    const omega0 = 0.085
    const ringHalf = (i: number, half: 0 | 1) => {
      const ring = rings[i], u = ringPhase(i, rings.length, t), fade = ringFade(u)
      if (fade < 0.02) return
      const r = d.rIn + (d.rOut - d.rIn) * Math.pow(u, 1.6)
      const amp = s.r * (0.008 + 0.045 * u)
      const rot = ring.q + t * omega0 * Math.pow(d.rIn / r, 1.5)
      const p1 = ring.p[0] + t * 0.11, p2 = ring.p[1] - t * 0.07, p3 = ring.p[2] + t * 0.05
      const steps = Math.ceil(Math.max(48, Math.min(POINTS, Math.round((Math.PI * 2 * r) / 9))) / 2)
      const from = half === 0 ? Math.PI : 0
      for (let k = 0; k <= steps; k++) {
        const th = from + (Math.PI * k) / steps, a = th + rot
        const w = amp * (Math.sin(3 * a + p1) + 0.55 * Math.sin(7 * a + p2) + 0.3 * Math.sin(12 * a + p3))
        toScreen((r + w) * Math.cos(th), (r + w) * Math.sin(th) * d.k, pt)
        xs[k] = pt.x; ys[k] = pt.y
      }
      c.beginPath(); c.moveTo(xs[0], ys[0])
      for (let k = 1; k <= steps; k++) c.lineTo(xs[k], ys[k])
      const color = along(pal.dust, u), alpha = fade * (0.95 - 0.55 * u) * (half === 0 ? 0.55 : 1)
      const gl = c.createLinearGradient(s.x - r * cos, s.y - r * sin, s.x + r * cos, s.y + r * sin)
      gl.addColorStop(0, rgba(color, alpha * 1.15)); gl.addColorStop(0.5, rgba(color, alpha * 0.8)); gl.addColorStop(1, rgba(color, alpha * 0.45))
      c.strokeStyle = gl
      c.lineWidth = (1.8 - 0.9 * u) * (0.8 + 0.4 * ring.seed)
      c.stroke()
    }
    const moteAt = (m: Mote) => {
      const r = d.rIn + (d.rOut - d.rIn) * m.s, th = m.a + t * omega0 * 1.15 * Math.pow(d.rIn / r, 1.5)
      toScreen(r * Math.cos(th), r * Math.sin(th) * d.k, pt)
      return Math.sin(th) < 0
    }
    const drawMotes = (farSide: boolean) => {
      c.globalCompositeOperation = 'lighter'
      for (const m of motes) {
        if (moteAt(m) !== farSide) continue
        const x = pt.x, y = pt.y
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue
        const k = twinkle(t, m.tw, m.ph), size = m.size * (farSide ? 3.4 : 4.6) * (0.75 + 0.25 * k)
        c.globalAlpha = (farSide ? 0.45 : 0.9) * (0.45 + 0.55 * k) * (1 - 0.45 * m.s)
        if (k > 0.93 && m.size > 1.1) { const g = size * 2.6; c.drawImage(starSprite, x - g / 2, y - g / 2, g, g) }        // now and then, a glint
        else c.drawImage(moteSprite, x - size / 2, y - size / 2, size, size)
      }
      c.globalAlpha = 1
      c.globalCompositeOperation = 'source-over'
    }

    for (let i = 0; i < rings.length; i++) ringHalf(i, 0)
    drawMotes(true)

    // the sphere: black, with a thin crimson rim and a faint red glow
    c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fillStyle = '#000'; c.fill()
    c.lineWidth = 8; c.strokeStyle = rgba(pal.rim, 0.12 * pulse); c.stroke()
    c.lineWidth = 3.4; c.strokeStyle = rgba(pal.rim, 0.3 * pulse); c.stroke()
    c.lineWidth = 1.5; c.strokeStyle = rgba(mix(pal.rim, [255, 140, 110], 0.2), 0.95); c.stroke()

    for (let i = 0; i < rings.length; i++) ringHalf(i, 1)
    drawMotes(false)

    // light from the near side of the disk, bent round the bottom of the sphere
    const mid = Math.PI / 2 + d.tilt, spread = Math.PI * 0.4
    c.beginPath(); c.arc(s.x, s.y, s.r + 3, mid - spread, mid + spread)
    c.lineWidth = 10; c.strokeStyle = rgba(pal.glow, 0.12 * pulse); c.stroke()
    c.lineWidth = 3.6; c.strokeStyle = rgba(pal.dust[1], 0.34 * pulse); c.stroke()
    c.beginPath(); c.arc(s.x, s.y, s.r + 3, mid - spread * 0.7, mid + spread * 0.7)
    c.lineWidth = 1.5; c.strokeStyle = rgba(pal.dust[0], 0.9); c.stroke()
  }

  return { resize, frame }
}
