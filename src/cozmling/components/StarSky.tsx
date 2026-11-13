/* A small living night sky, drawn in code as pixel art: stars, a dark world with a glowing rim,
   clouds lit along their edges and a bright horizon, all in one pair of colours (a Cozmling's
   element, usually) on black. Each seed gives its own sky, the same every time.

   It is decoration only. The sky is painted once into a tiny canvas that the browser scales up;
   after that only the sparkles change, a few times a second, and only while it is on screen.
   With reduced motion nothing moves at all. */
import { useEffect, useRef } from 'react'

type RGB = [number, number, number]
const hex = (s: string): RGB => { const n = parseInt(s.replace('#', '').padEnd(6, '0').slice(0, 6), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255] }
const mix = (p: RGB, q: RGB, t: number): RGB => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]
const css = (c: RGB) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
/* ordered dithering: how pixel art turns a smooth fade into a pattern of two colours */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const dith = (x: number, y: number) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16
function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296 }
}
const K: RGB = [3, 4, 9], WHITE: RGB = [255, 255, 255], BLACK: RGB = [0, 0, 0]
export type SkyBody = 'eclipse' | 'ring' | 'crescent'
interface Sparkle { x: number; y: number; size: number; phase: number; speed: number; warm: boolean }

/** Paint the part of the sky that never changes, and say where the sparkles go. */
function paint(w: number, h: number, seed: string, A: RGB, B: RGB, want?: SkyBody) {
  const r = rng(seed), px = new Uint8ClampedArray(w * h * 4)
  const set = (x: number, y: number, c: RGB) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255 }

  // the sky: black, taking on the deep colour toward the horizon, in dithered bands
  const bands = [K, mix(K, B, 0.22), mix(K, B, 0.45), mix(K, B, 0.75)]
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = Math.pow(y / h, 2.4) * (bands.length - 1), i = Math.floor(v)
    set(x, y, bands[Math.min(bands.length - 1, i + (v - i > dith(x, y) ? 1 : 0))])
  }
  // far stars
  for (let n = Math.round((w * h) / 46); n--;) { const x = Math.floor(r() * w), y = Math.floor(r() * h * 0.8), k = r(); set(x, y, k > 0.86 ? WHITE : k > 0.5 ? mix(B, WHITE, 0.55) : mix(K, A, 0.5)) }

  // a dark world, lit from behind
  const body: SkyBody = want ?? (['eclipse', 'ring', 'crescent'] as const)[Math.floor(r() * 3)]
  const tall = w / h < 2.2            // a phone-shaped sky: words fill the middle, so the dark world sits smaller, up in the corner
  const R = Math.max(5, Math.round(h * (tall ? 0.12 : body === 'crescent' ? 0.27 : 0.2))), cx = Math.round(w * (tall ? 0.74 + r() * 0.1 : 0.66 + r() * 0.14)), cy = Math.round(h * (tall ? 0.2 + r() * 0.05 : 0.36 + r() * 0.08)), light = -0.9 + r() * 0.8
  const reach = R * (body === 'eclipse' ? 2.5 : 1.7)
  for (let y = Math.floor(cy - reach); y <= cy + reach; y++) for (let x = Math.floor(cx - reach); x <= cx + reach; x++) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy), toward = Math.cos(Math.atan2(dy, dx) - light)
    if (d <= R) {
      set(x, y, BLACK)
      if (d > R - 1.5 && (body === 'crescent' ? toward > -0.15 : toward > 0.45)) set(x, y, toward > 0.6 ? mix(A, WHITE, 0.8) : A)
    } else if (d < reach) {
      const fall = 1 - (d - R) / (reach - R), glow = fall * fall * (body === 'eclipse' ? 0.7 + 0.3 * toward : 0.35 + 0.35 * toward)
      if (body === 'eclipse' && d < R + 1.4) set(x, y, mix(A, WHITE, 0.75))
      else if (glow > dith(x, y) * 0.85 + 0.06) set(x, y, glow > 0.62 ? mix(A, WHITE, 0.4) : glow > 0.3 ? A : mix(B, A, 0.5))
    }
  }
  if (body === 'ring') {            // a tilted ring of light: behind the world on the far side, in front on the near side
    const ax = R * 2.25, ay = R * 0.62, tilt = -0.42 - r() * 0.2, cs = Math.cos(tilt), sn = Math.sin(tilt)
    for (let y = Math.floor(cy - ax); y <= cy + ax; y++) for (let x = Math.floor(cx - ax); x <= cx + ax; x++) {
      const dx = x - cx, dy = y - cy, u = dx * cs + dy * sn, v = -dx * sn + dy * cs, e = Math.hypot(u / ax, v / ay)
      if (Math.abs(e - 1) > 0.17 || (v < 0 && Math.hypot(dx, dy) <= R)) continue
      const core = 1 - Math.abs(e - 1) / 0.17
      if (core > dith(x, y) * 0.9) set(x, y, core > 0.6 ? WHITE : core > 0.3 ? mix(A, WHITE, 0.45) : A)
    }
  }

  // the horizon: a band of light, and a sea that catches it
  const hz = Math.round(h * 0.86), lift = Math.max(4, Math.round(h * 0.26))
  for (let y = hz - lift; y < hz; y++) for (let x = 0; x < w; x++) { const g = (y - (hz - lift)) / lift; if (g * g > dith(x, y)) set(x, y, mix(B, A, 0.35 + g * 0.65)) }
  for (let y = hz; y < h; y++) {
    const deep = (y - hz) / Math.max(1, h - hz)
    for (let x = 0; x < w; x++) set(x, y, deep * 0.9 > dith(x, y) ? mix(B, A, 0.45) : mix(A, WHITE, 0.12))
    for (let n = Math.round(w / 9); n--;) { const x0 = Math.floor(r() * w), len = 2 + Math.floor(r() * 6), c = r() > 0.45 ? mix(A, WHITE, 0.6) : mix(K, B, 0.8); for (let i = 0; i < len; i++) set(x0 + i, y, c) }
  }

  // clouds, back row then front row: dark bodies with flat bases, lit along their tops
  const cloudRow = (base: number, puff: number, count: number, near: boolean) => {
    const m = new Uint8Array(w * h)
    for (let c = 0; c < count; c++) {
      const mid = (c + 0.15 + r() * 0.7) * (w / count), n = 4 + Math.floor(r() * 4)
      for (let j = 0; j < n; j++) {
        const t = n === 1 ? 0.5 : j / (n - 1), px0 = mid + (t - 0.5) * n * puff * 0.95 + (r() - 0.5) * puff * 0.5
        const py = base - Math.sin(t * Math.PI) * puff * (0.5 + r() * 0.7), pr = puff * (0.55 + r() * 0.6)
        for (let y = Math.floor(py - pr); y <= Math.min(base, py + pr); y++) for (let x = Math.floor(px0 - pr); x <= px0 + pr; x++)
          if (x >= 0 && x < w && y >= 0 && y < h && Math.hypot(x - px0, y - py) <= pr) m[y * w + x] = 1
      }
    }
    const inM = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h && m[y * w + x] === 1
    const rim = near ? mix(A, WHITE, 0.62) : mix(B, A, 0.75), mid = near ? mix(K, A, 0.7) : mix(K, B, 0.95), dark = mix(K, B, near ? 0.5 : 0.32), darker = mix(K, B, near ? 0.26 : 0.18)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue
      if (!inM(x, y - 1)) set(x, y, rim)
      else if (!inM(x, y - 2) || !inM(x - 1, y - 1) || !inM(x + 1, y - 1)) set(x, y, dith(x, y) < 0.62 ? mid : dark)
      else set(x, y, (base - y) / (puff * 1.6) > dith(x, y) ? dark : darker)
    }
  }
  cloudRow(hz - Math.round(h * 0.1), Math.max(3, h * 0.07), Math.max(3, Math.round(w / 52)), false)
  cloudRow(hz + 1, Math.max(4, h * 0.1), Math.max(2, Math.round(w / 78)), true)

  // where the four-point sparkles shine: in the open sky, clear of the dark world
  const sparkles: Sparkle[] = []
  for (let n = Math.max(6, Math.round(w / 15)), tries = 0; sparkles.length < n && tries < 400; tries++) {
    const x = 3 + Math.floor(r() * (w - 6)), y = 3 + Math.floor(r() * (h * 0.62))
    if (Math.hypot(x - cx, y - cy) < R * 1.25 || sparkles.some(s => Math.abs(s.x - x) < 6 && Math.abs(s.y - y) < 6)) continue
    sparkles.push({ x, y, size: 1 + Math.floor(r() * 3.2), phase: r() * 6.28, speed: 0.9 + r() * 1.6, warm: r() > 0.5 })
  }
  return { image: new ImageData(px, w, h), sparkles }
}

export function StarSky({ seed, a, b, body, className = '' }: { seed: string; /** the bright colour */ a: string; /** the deep colour */ b: string; body?: SkyBody; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current, ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const A = hex(a), B = hex(b), tones = [css(WHITE), css(mix(A, WHITE, 0.5)), css(A), css(mix(B, A, 0.6))]
    let sky: ReturnType<typeof paint> | null = null
    /** Paint for the size it is shown at: whole pixels, about four screen pixels each, never a huge canvas. */
    const fit = () => {
      const box = canvas.getBoundingClientRect()
      if (box.width < 8 || box.height < 8) return
      const scale = Math.max(3, Math.ceil(box.width / 300)), w = Math.max(48, Math.round(box.width / scale)), h = Math.max(24, Math.round(box.height / scale))
      if (sky && canvas.width === w && canvas.height === h) return
      canvas.width = w; canvas.height = h
      sky = paint(w, h, seed, A, B, body)
      draw(1.3)
    }
    const draw = (t: number) => {
      if (!sky) return
      ctx.putImageData(sky.image, 0, 0)
      for (const s of sky.sparkles) {
        const shine = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase), arm = Math.round(s.size * shine)
        ctx.fillStyle = shine > 0.25 ? tones[s.warm ? 1 : 0] : tones[3]
        ctx.fillRect(s.x, s.y, 1, 1)
        for (let i = 1; i <= arm; i++) {
          ctx.fillStyle = tones[Math.min(3, i + (s.warm ? 1 : 0))]
          ctx.fillRect(s.x + i, s.y, 1, 1); ctx.fillRect(s.x - i, s.y, 1, 1); ctx.fillRect(s.x, s.y + i, 1, 1); ctx.fillRect(s.x, s.y - i, 1, 1)
        }
      }
    }
    fit()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null
    ro?.observe(canvas)
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return () => ro?.disconnect()
    let raf = 0, last = 0, seen = true
    const tick = (now: number) => { raf = requestAnimationFrame(tick); if (!seen || document.hidden || now - last < 110) return; last = now; draw(now / 1000) }
    const io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(e => { seen = e[e.length - 1].isIntersecting }) : null
    io?.observe(canvas)
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); io?.disconnect(); ro?.disconnect() }
  }, [seed, a, b, body])
  return <canvas ref={ref} width={48} height={24} className={`sl-sky ${className}`} aria-hidden="true" />
}
