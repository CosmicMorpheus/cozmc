/* ============================================================
   SHARE CARDS — COZMC-branded 1200×675 graphics drawn in the browser.
   X's share link can carry text but not images, so the share dialog
   copies the PNG to the clipboard (desktop) or hands it to the native
   share sheet (phones), and opens X with the text ready.
   ============================================================ */
import { ASA_ID, SITE_URL } from '../config'
import { BADGE_COLOR, FLAME, FLAME_PAL } from '../components/Pixel'

export type ShareCard =
  | { kind: 'score'; kicker: string; score: number; game: string; cta: string; byline?: string; verified?: boolean; shot?: CanvasImageSource | null }
  | { kind: 'burn'; kicker: string; amount: string; wish?: string; byline?: string }
  | { kind: 'quote'; t: string; a: string; src?: string; ctx?: string }
  | { kind: 'player'; name: string; tier: { name: string; color: string; art: string[]; palette: [string, string, string] }; tierNo: number; stats: [string, string][]; badges: number; total: number; kinds: string[] }

export interface SharePayload { card: ShareCard; text: string; file: string }

const W = 1200, H = 675
const C = { phos: '#8dff6a', phosDim: '#4aa83a', crt: '#b6ff9c', bone: '#f1efe6', mist: '#a3a199', dim: '#6c6b65', ember: '#ffb020', fire: '#ff5a1f', line: '#2c2c2c' }
const PIXEL = 'Silkscreen', SANS = 'Saira', MONO = '"Martian Mono"'

let assets: Promise<{ mark: HTMLImageElement; card: HTMLImageElement }> | null = null
const img = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src })
async function ready() {
  await Promise.all([`700 40px ${PIXEL}`, `400 40px ${PIXEL}`, `800 60px ${SANS}`, `500 30px ${MONO}`].map(f => document.fonts.load(f).catch(() => null)))
  assets ??= Promise.all([img('/assets/cozmc-wordmark.png'), img('/assets/card-face.webp')]).then(([mark, card]) => ({ mark, card }))
  return assets
}

/** Wrap text into lines at a given font; shrink the font until it fits. */
function fit(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxLines: number, from: number, to: number) {
  for (let px = from; px >= to; px -= 2) {
    ctx.font = font(px)
    const words = text.split(/\s+/), lines: string[] = []
    let cur = ''
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w
      if (ctx.measureText(next).width > maxW && cur) { lines.push(cur); cur = w } else cur = next
    }
    if (cur) lines.push(cur)
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) return { px, lines }
  }
  ctx.font = font(to)
  return { px: to, lines: [text] }
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, glow = 0, spacing = '0px') {
  ctx.save()
  ctx.font = font; ctx.fillStyle = color
  ;(ctx as any).letterSpacing = spacing
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow }
  ctx.fillText(s, x, y)
  ctx.restore()
}

function frame(ctx: CanvasRenderingContext2D, mark: HTMLImageElement, label: string) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  let s = 11
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 300; i++) {
    const big = r() < 0.12, z = big ? 3 : 2
    ctx.fillStyle = big ? '#f1efe6' : r() < 0.5 ? '#4d4d48' : '#2e2e2b'
    ctx.fillRect(Math.floor((r() * W) / z) * z, Math.floor((r() * H) / z) * z, z, z)
  }
  ctx.strokeStyle = C.line; ctx.lineWidth = 4; ctx.strokeRect(18, 18, W - 36, H - 36)
  ctx.fillStyle = C.phos
  for (const [x, y, dx, dy] of [[18, 18, 1, 1], [W - 18, 18, -1, 1], [18, H - 18, 1, -1], [W - 18, H - 18, -1, -1]]) {
    ctx.fillRect(x - (dx < 0 ? 28 : 0), y - (dy < 0 ? 4 : 0), 28, 4)
    ctx.fillRect(x - (dx < 0 ? 4 : 0), y - (dy < 0 ? 28 : 0), 4, 28)
  }
  ctx.drawImage(mark, 52, 46, 190, 50)
  ctx.textAlign = 'right'
  text(ctx, label, W - 54, 80, `700 20px ${PIXEL}`, C.phosDim, 0, '2px')
  ctx.textAlign = 'left'
  text(ctx, SITE_URL.replace(/^https?:\/\//, '').toUpperCase(), 54, H - 46, `700 22px ${PIXEL}`, C.phos, 10, '2px')
  ctx.textAlign = 'right'
  text(ctx, `ASA ${ASA_ID} · ALGORAND`, W - 54, H - 46, `400 18px ${PIXEL}`, C.dim, 0, '1px')
  ctx.textAlign = 'left'
}

function scanlines(ctx: CanvasRenderingContext2D, x = 0, y = 0, w = W, h = H, a = 0.2) {
  ctx.fillStyle = `rgba(0,0,0,${a})`
  for (let yy = y; yy < y + h; yy += 3) ctx.fillRect(x, yy, w, 1)
}

function pixelArt(ctx: CanvasRenderingContext2D, rows: string[], pal: Record<string, string>, x: number, y: number, scale: number) {
  rows.forEach((row, ry) => [...row].forEach((ch, rx) => { if (pal[ch]) { ctx.fillStyle = pal[ch]; ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale) } }))
}

function bezel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#0b0b0b'; ctx.fillRect(x - 14, y - 14, w + 28, h + 28)
  ctx.strokeStyle = '#262626'; ctx.lineWidth = 2; ctx.strokeRect(x - 14, y - 14, w + 28, h + 28)
  ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h)
}

export async function renderCard(card: ShareCard): Promise<Blob> {
  const { mark, card: holo } = await ready()
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  ;(ctx as any).fontStretch = 'condensed'

  if (card.kind === 'score') {
    frame(ctx, mark, 'COZMC ARCADE')
    text(ctx, card.kicker.toUpperCase(), 58, 178, `700 26px ${PIXEL}`, C.phosDim, 0, '2px')
    const s = card.score.toLocaleString('en-US')
    const big = fit(ctx, s, px => `700 ${px}px ${PIXEL}`, 610, 1, 168, 70)
    text(ctx, s, 54, 178 + big.px * 0.95, `700 ${big.px}px ${PIXEL}`, C.phos, 28)
    const ty = 178 + big.px * 0.95 + 74
    text(ctx, card.game.toUpperCase(), 58, ty, `800 64px ${SANS}`, C.bone)
    text(ctx, card.cta.toUpperCase(), 58, ty + 62, `700 34px ${PIXEL}`, C.ember, 14, '2px')
    if (card.byline) text(ctx, card.byline, 58, ty + 110, `500 24px ${MONO}`, C.mist)
    if (card.verified) text(ctx, '✓ VERIFIED ON ALGORAND', 58, ty + 146, `700 18px ${PIXEL}`, C.phos, 0, '2px')
    // the run itself, on a little CRT
    const bx = 760, by = 160, bw = 384, bh = 288
    bezel(ctx, bx, by, bw, bh)
    if (card.shot) { ctx.imageSmoothingEnabled = false; ctx.drawImage(card.shot, bx, by, bw, bh); ctx.imageSmoothingEnabled = true }
    scanlines(ctx, bx, by, bw, bh, 0.28)
    ctx.textAlign = 'center'
    text(ctx, 'INSERT COIN? NAH, IT’S FREE', bx + bw / 2, by + bh + 52, `700 16px ${PIXEL}`, C.dim, 0, '2px')
    ctx.textAlign = 'left'
  }

  if (card.kind === 'burn') {
    frame(ctx, mark, 'THE BONFIRE')
    // holo card, tilted, with firelight behind it
    ctx.save()
    const g = ctx.createRadialGradient(950, 390, 40, 950, 390, 330)
    g.addColorStop(0, 'rgba(255,120,30,.55)'); g.addColorStop(1, 'rgba(255,60,0,0)')
    ctx.fillStyle = g; ctx.fillRect(600, 60, 600, 600)
    ctx.translate(950, 360); ctx.rotate(-0.07)
    ctx.shadowColor = 'rgba(255,110,30,.6)'; ctx.shadowBlur = 40
    ctx.drawImage(holo, -150, -212, 300, 424)
    ctx.restore()
    pixelArt(ctx, FLAME, FLAME_PAL, 870, 430, 16)
    text(ctx, card.kicker.toUpperCase(), 58, 178, `700 26px ${PIXEL}`, '#c9824a', 0, '2px')
    const big = fit(ctx, card.amount, px => `700 ${px}px ${PIXEL}`, 640, 1, 160, 70)
    text(ctx, card.amount, 54, 178 + big.px * 0.95, `700 ${big.px}px ${PIXEL}`, C.ember, 30)
    let y = 178 + big.px * 0.95 + 70
    text(ctx, '$COZMC INTO THE BONFIRE', 58, y, `800 54px ${SANS}`, C.bone)
    if (card.wish) {
      const w = fit(ctx, `“${card.wish}”`, px => `500 ${px}px ${MONO}`, 620, 3, 28, 18)
      w.lines.forEach((l, i) => text(ctx, l, 58, y + 54 + i * w.px * 1.4, `500 ${w.px}px ${MONO}`, C.bone))
      y += 54 + (w.lines.length - 1) * w.px * 1.4
    }
    text(ctx, card.byline ? card.byline : 'GONE FOREVER. ON-CHAIN.', 58, Math.min(y + 56, H - 96), `700 20px ${PIXEL}`, C.fire, 8, '2px')
  }

  if (card.kind === 'quote') {
    frame(ctx, mark, 'DAILY WISDOM')
    const px0 = 52, py0 = 124, pw = W - 104, ph = H - 230
    const g = ctx.createRadialGradient(W / 2, py0 + ph * 0.4, 50, W / 2, py0 + ph * 0.4, pw * 0.7)
    g.addColorStop(0, '#0b2207'); g.addColorStop(1, '#010301')
    ctx.fillStyle = g; ctx.fillRect(px0, py0, pw, ph)
    ctx.strokeStyle = '#1f3a17'; ctx.lineWidth = 2; ctx.strokeRect(px0, py0, pw, ph)
    // size the whole block (context, quote, author, source) to the panel, then centre it
    const ctxH = card.ctx ? 46 : 0, tailH = 56 + (card.src ? 34 : 0), room = ph - 80
    let q = fit(ctx, `“${card.t}”`, px => `500 ${px}px ${MONO}`, pw - 96, 7, 54, 20)
    for (let px = q.px; px >= 20; px -= 2) {
      q = fit(ctx, `“${card.t}”`, f => `500 ${f}px ${MONO}`, pw - 96, 7, px, 20)
      if (ctxH + q.lines.length * q.px * 1.36 + tailH <= room) break
    }
    const blockH = ctxH + q.lines.length * q.px * 1.36 + tailH
    let y = py0 + (ph - blockH) / 2
    if (card.ctx) text(ctx, `> ${card.ctx}`, px0 + 48, y + 22, `500 22px ${MONO}`, '#6fcf58')
    y += ctxH
    q.lines.forEach((l, i) => text(ctx, l, px0 + 48, y + q.px + i * q.px * 1.36, `500 ${q.px}px ${MONO}`, C.crt, 10))
    const ay = y + q.lines.length * q.px * 1.36 + 44
    text(ctx, `— ${card.a.toUpperCase()}`, px0 + 48, ay, `700 26px ${PIXEL}`, C.phos, 10, '2px')
    if (card.src) text(ctx, card.src, px0 + 48, ay + 34, `400 20px ${MONO}`, C.phosDim)
    scanlines(ctx, px0, py0, pw, ph, 0.25)
  }

  if (card.kind === 'player') {
    frame(ctx, mark, 'PLAYER CARD')
    const t = card.tier
    // the card itself, tilted a touch, tier-coloured glow behind it
    const cx = 78, cy = 120, cw = 330, ch = 462
    const g = ctx.createRadialGradient(cx + cw / 2, cy + ch / 2, 30, cx + cw / 2, cy + ch / 2, 380)
    g.addColorStop(0, t.color + '55'); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 60, 640, 600)
    ctx.save(); ctx.translate(cx + cw / 2, cy + ch / 2); ctx.rotate(-0.045); ctx.translate(-cw / 2, -ch / 2)
    ctx.shadowColor = t.color; ctx.shadowBlur = 30
    ctx.fillStyle = '#050605'; ctx.fillRect(0, 0, cw, ch)
    ctx.shadowBlur = 0
    // foil wash: stronger for higher tiers
    const foil = ctx.createLinearGradient(0, 0, cw, ch)
    ;['#ff8ad8', '#ffd88a', '#8dffb7', '#7fd8ff', '#b79bff'].forEach((c, i) => foil.addColorStop(i / 4, c))
    ctx.globalAlpha = 0.06 + card.tierNo * 0.05; ctx.fillStyle = foil; ctx.fillRect(0, 0, cw, ch); ctx.globalAlpha = 1
    ctx.strokeStyle = t.color; ctx.lineWidth = 4; ctx.strokeRect(14, 14, cw - 28, ch - 28)
    ctx.fillStyle = '#000'; ctx.fillRect(32, 64, cw - 64, 200)
    ctx.strokeStyle = '#262626'; ctx.lineWidth = 2; ctx.strokeRect(32, 64, cw - 64, 200)
    let st = 5
    const r = () => (st = (st * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 40; i++) { ctx.fillStyle = r() < 0.2 ? '#f1efe6' : '#3a3a37'; ctx.fillRect(34 + Math.floor(r() * (cw - 70)), 66 + Math.floor(r() * 196), 3, 3) }
    const [pa, pb, pc] = t.palette, scale = 14
    pixelArt(ctx, t.art, { a: pa, b: pb, c: pc }, cw / 2 - (t.art[0].length * scale) / 2, 164 - (t.art.length * scale) / 2, scale)
    ctx.textAlign = 'center'
    text(ctx, 'COZMC', cw / 2, 50, `700 22px ${PIXEL}`, C.phos, 0, '3px')
    const nm = fit(ctx, card.name.toUpperCase(), px => `800 ${px}px ${SANS}`, cw - 70, 1, 46, 22)
    text(ctx, nm.lines[0], cw / 2, 316, `800 ${nm.px}px ${SANS}`, C.bone)
    text(ctx, t.name.toUpperCase(), cw / 2, 352, `700 22px ${PIXEL}`, t.color, 10, '2px')
    // medal strip
    const n = Math.min(card.kinds.length, 10), mw = 20
    card.kinds.slice(0, 10).forEach((k, i) => { ctx.fillStyle = BADGE_COLOR[k] ?? C.phos; ctx.fillRect(cw / 2 - (n * (mw + 6)) / 2 + i * (mw + 6) + 3, 384, mw, mw) })
    if (!n) text(ctx, 'NO BADGES YET', cw / 2, 400, `400 14px ${PIXEL}`, C.dim, 0, '2px')
    text(ctx, `${card.badges}/${card.total} BADGES`, cw / 2, 434, `700 14px ${PIXEL}`, C.mist, 0, '2px')
    ctx.textAlign = 'left'
    scanlines(ctx, 0, 0, cw, ch, 0.15)
    ctx.restore()

    // the right side: what it says
    const x = 500
    text(ctx, 'MY COZMC CARD', x, 178, `700 26px ${PIXEL}`, C.phosDim, 0, '2px')
    const big = fit(ctx, t.name.toUpperCase(), px => `800 ${px}px ${SANS}`, 640, 1, 128, 60)
    text(ctx, t.name.toUpperCase(), x - 4, 178 + big.px * 0.92, `800 ${big.px}px ${SANS}`, t.color, 24)
    let y = 178 + big.px * 0.92 + 64
    card.stats.slice(0, 6).forEach(([k, v], i) => {
      const col = i % 2, row = Math.floor(i / 2), xx = x + col * 320, yy = y + row * 74
      text(ctx, k.toUpperCase(), xx, yy, `700 16px ${PIXEL}`, C.dim, 0, '2px')
      text(ctx, v, xx, yy + 36, `700 30px ${PIXEL}`, C.bone)
    })
    y += Math.ceil(Math.min(card.stats.length, 6) / 2) * 74 + 6
    text(ctx, 'GET YOURS AT COZMC.US', x, Math.min(y + 20, H - 92), `700 22px ${PIXEL}`, C.ember, 12, '2px')
  }

  scanlines(ctx, 0, 0, W, H, 0.12)
  return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('Could not render the image'))), 'image/png'))
}

export const xIntent = (t: string) => `https://x.com/intent/post?text=${encodeURIComponent(t)}`
