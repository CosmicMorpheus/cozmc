import type { ArcadeGame, GameHooks, StartOptions } from '../types'
import { TIER_SKINS } from '../types'
import { sfx } from '../sfx'
import { rng } from '../../lib/daily'

/* ============================================================
   BRICK BY BRICK — a falling-block puzzle. Stack the bricks, clear
   lines, don't top out. Standard rules: 7-bag, SRS rotation with wall
   kicks, hold, 3-piece preview, ghost piece, lock delay.
   192×144 logical pixels: 10×20 well of 7px bricks in the middle.
   ============================================================ */

const W = 192, H = 144, COLS = 10, ROWS = 22, HIDDEN = 2, C = 7
const BX = 61, BY = 2                       // top-left of the visible well
const DAS = 0.16, ARR = 0.045, LOCK = 0.5, MAX_RESETS = 15

type P = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
const SHAPES: Record<P, { n: number; cells: [number, number][] }> = {
  I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { n: 4, cells: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
}
const COLOR: Record<P, string> = { I: '#59e6ff', O: '#ffd13a', T: '#b06bff', S: '#8dff6a', Z: '#ff5a6a', J: '#4a7dff', L: '#ffb020' }
type Pal = Record<P, string>
/** Brick palettes per tier skin. Black Hole is computed per frame (a slow rainbow drift). */
const PALETTES: Record<string, Pal> = {
  classic: COLOR,
  comet: { I: '#e8fbff', O: '#9fe8ff', T: '#59e6ff', S: '#2fb8d8', Z: '#4a7dff', J: '#2a4fd6', L: '#7fa8ff' },
  moon: { I: '#f1efe6', O: '#d6d4cc', T: '#bdbdb6', S: '#a3a39c', Z: '#8c8a82', J: '#74736c', L: '#c9c6b8' },
  planet: { I: '#c8ff9a', O: '#8dff6a', T: '#5fd146', S: '#3ea32c', Z: '#2c6b1f', J: '#7fe0a0', L: '#a8d65a' },
  star: { I: '#fff4c2', O: '#ffd13a', T: '#ffb020', S: '#ff8a1f', Z: '#ff5a1f', J: '#d9a441', L: '#ffe27a' },
}
const ORDER: P[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
const hsl = (h: number, s: number, l: number) => {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l)
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))))
  return '#' + [f(0), f(8), f(4)].map(v => v.toString(16).padStart(2, '0')).join('')
}
function palette(skin: string, t: number): Pal {
  if (skin !== 'blackhole') return PALETTES[skin] ?? COLOR
  return Object.fromEntries(ORDER.map((p, i) => [p, hsl((t * 40 + i * 51) % 360, 0.85, 0.64)])) as Pal
}

/* SRS wall kicks (y-up in the guideline, flipped to y-down when used) */
const KICKS: Record<string, [number, number][]> = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
}
const KICKS_I: Record<string, [number, number][]> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
}

/** Cells of piece p in rotation r (0..3), relative to its box. */
function cellsOf(p: P, r: number): [number, number][] {
  const { n, cells } = SHAPES[p]
  if (p === 'O') return cells
  let out = cells
  for (let i = 0; i < r; i++) out = out.map(([x, y]) => [n - 1 - y, x] as [number, number])
  return out
}

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255
  const m = (v: number) => Math.max(0, Math.min(255, Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f))))
  return `rgb(${m(r)},${m(g)},${m(b)})`
}

/** One brick: bevelled, with a little mortar notch so it reads as a brick, not a tile. */
function brick(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, s = C) {
  ctx.fillStyle = color; ctx.fillRect(x, y, s, s)
  ctx.fillStyle = shade(color, 0.45); ctx.fillRect(x, y, s, 1); ctx.fillRect(x, y, 1, s)
  ctx.fillStyle = shade(color, -0.45); ctx.fillRect(x, y + s - 1, s, 1); ctx.fillRect(x + s - 1, y, 1, s)
  if (s >= 6) { ctx.fillStyle = shade(color, 0.7); ctx.fillRect(x + 1, y + 1, 2, 1) }
}

function mini(ctx: CanvasRenderingContext2D, p: P, cx: number, cy: number, s: number, pal: Pal = COLOR) {
  const cells = cellsOf(p, 0)
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1])
  const w = (Math.max(...xs) - Math.min(...xs) + 1) * s, h = (Math.max(...ys) - Math.min(...ys) + 1) * s
  cells.forEach(([x, y]) => brick(ctx, Math.round(cx - w / 2 + (x - Math.min(...xs)) * s), Math.round(cy - h / 2 + (y - Math.min(...ys)) * s), pal[p], s))
}

function label(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, color = '#6c6b65', size = 8, align: CanvasTextAlign = 'left') {
  ctx.font = `700 ${size}px Silkscreen`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(t, x, y); ctx.textAlign = 'left'
}

function frame(ctx: CanvasRenderingContext2D, danger: number) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#050605'; ctx.fillRect(BX, BY, COLS * C, (ROWS - HIDDEN) * C)
  ctx.fillStyle = '#111411'
  for (let r = 0; r < ROWS - HIDDEN; r++) for (let c = 0; c < COLS; c++) ctx.fillRect(BX + c * C + 3, BY + r * C + 3, 1, 1)
  ctx.fillStyle = danger > 0 ? `rgba(255,45,45,${0.4 + 0.4 * danger})` : '#2c2c2c'
  ctx.fillRect(BX - 2, BY - 1, 1, (ROWS - HIDDEN) * C + 2); ctx.fillRect(BX + COLS * C + 1, BY - 1, 1, (ROWS - HIDDEN) * C + 2)
  ctx.fillRect(BX - 2, BY + (ROWS - HIDDEN) * C, COLS * C + 4, 1)
  // side panels
  ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1
  ctx.strokeRect(6.5, 14.5, 46, 30); ctx.strokeRect(139.5, 14.5, 47, 84)
  label(ctx, 'HOLD', 7, 10); label(ctx, 'NEXT', 140, 10)
  // the COZMC infinity, bottom-left
  const inf = ['.aa...aa.', 'a..a.a..a', 'a...a...a', 'a..a.a..a', '.aa...aa.']
  ctx.fillStyle = '#2c6b1f'
  inf.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === 'a') ctx.fillRect(25 + x, 126 + y, 1, 1) }))
}

export const brickByBrick: ArcadeGame = {
  id: 'brick-by-brick',
  title: 'Brick by Brick',
  tagline: 'Stack the bricks. Clear the lines. Don’t top out.',
  controls: ['← → move · ↓ soft drop', '↑ / X rotate · Z rotate back', 'Space hard drop · C hold', 'Phone: tap rotate, drag, flick down'],
  width: W, height: H,
  maxScore: 10_000_000,
  maxPerSecond: 3000,
  maxLives: 0,
  touch: ['hold', 'rotate', 'drop', 'left', 'down', 'right'],
  skins: TIER_SKINS,

  drawCover(ctx) {
    frame(ctx, 0)
    const rows = ['..........', '..........', '....T.....', '...TTT....', '..........', 'I.......OO', 'I.LL....OO', 'I.L..SS.JJ', 'ILL.SSZZJ.', 'ZZJJJ.ZZJT', 'SZZJTTTLLL', 'SSIIIITLZZ']
    rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch !== '.') brick(ctx, BX + c * C, BY + (8 + r) * C, COLOR[ch as P]) }))
    mini(ctx, 'J', 29, 29, 5); mini(ctx, 'I', 163, 30, 5); mini(ctx, 'S', 163, 56, 4); mini(ctx, 'O', 163, 80, 4)
    label(ctx, 'LINES', 7, 62); label(ctx, '42', 7, 80, '#8dff6a', 16)
  },

  create(canvas, hooks: GameHooks, opts) {
    const ctx = canvas.getContext('2d')!
    canvas.width = W; canvas.height = H
    ctx.imageSmoothingEnabled = false

    let raf = 0, last = 0, t0 = 0, running = false
    let board: (P | null)[][] = []
    let bag: P[] = [], queue: P[] = []
    let cur: { p: P; r: number; x: number; y: number } | null = null
    let hold: P | null = null, held = false
    let score = 0, lines = 0, level = 1, combo = -1
    let fall = 0, lockT = 0, resets = 0, clearing: number[] = [], clearT = 0, overT = 0
    let das = 0, arr = 0, dir = 0, soft = false
    let pops: { text: string; t: number; color: string }[] = []
    const keys = new Set<string>()
    let skin = opts?.skin ?? 'classic'
    let rand = Math.random                     // seeded for the Daily Challenge: same bag for everyone

    const newBoard = () => Array.from({ length: ROWS }, () => Array<P | null>(COLS).fill(null))
    const nextFromBag = (): P => {
      if (!bag.length) { bag = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']; for (let i = 6; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]] } }
      return bag.pop()!
    }
    const fits = (p: P, r: number, x: number, y: number) =>
      cellsOf(p, r).every(([cx, cy]) => { const bx = x + cx, by = y + cy; return bx >= 0 && bx < COLS && by < ROWS && (by < 0 || !board[by][bx]) })
    const gravity = () => Math.pow(Math.max(0.05, 0.8 - (level - 1) * 0.007), level - 1)   // seconds per row (guideline curve)
    const hud = () => hooks.onHud({ score, lives: 0, level })

    function spawn(p?: P) {
      const piece = p ?? queue.shift()!
      while (queue.length < 3) queue.push(nextFromBag())
      cur = { p: piece, r: 0, x: 3, y: piece === 'I' ? HIDDEN - 1 : HIDDEN }   // appear in the top visible rows straight away
      lockT = 0; resets = 0; fall = 0
      if (!fits(cur.p, cur.r, cur.x, cur.y)) { overT = 0.001; cur = null; sfx.hit() }
    }

    function tryMove(dx: number, dy: number) {
      if (!cur || !fits(cur.p, cur.r, cur.x + dx, cur.y + dy)) return false
      cur.x += dx; cur.y += dy
      if (grounded() && resets < MAX_RESETS) { lockT = 0; resets++ }
      return true
    }
    function rotate(d: 1 | -1) {
      if (!cur || cur.p === 'O') return
      const from = cur.r, to = (cur.r + d + 4) % 4
      const kicks = (cur.p === 'I' ? KICKS_I : KICKS)[`${from}>${to}`]
      for (const [kx, ky] of kicks) {
        if (fits(cur.p, to, cur.x + kx, cur.y - ky)) {
          cur.r = to; cur.x += kx; cur.y -= ky
          if (grounded() && resets < MAX_RESETS) { lockT = 0; resets++ }
          sfx.tone(660, 0.03, 'square', 0.025)
          return
        }
      }
    }
    const grounded = () => !!cur && !fits(cur.p, cur.r, cur.x, cur.y + 1)
    const ghostY = () => { if (!cur) return 0; let y = cur.y; while (fits(cur.p, cur.r, cur.x, y + 1)) y++; return y }

    function lock() {
      if (!cur) return
      for (const [cx, cy] of cellsOf(cur.p, cur.r)) { const by = cur.y + cy; if (by >= 0) board[by][cur.x + cx] = cur.p }
      if (cellsOf(cur.p, cur.r).every(([, cy]) => cur!.y + cy < HIDDEN)) { overT = 0.001; cur = null; sfx.hit(); return }   // locked out above the well
      cur = null; held = false
      sfx.tone(110, 0.06, 'triangle', 0.05)
      clearing = board.map((row, i) => (row.every(Boolean) ? i : -1)).filter(i => i >= 0)
      if (clearing.length) {
        combo++
        const n = clearing.length
        const pts = [0, 100, 300, 500, 800][n] * level + (combo > 0 ? 50 * combo * level : 0)
        score += pts
        pops.push({ text: n === 4 ? 'BRICK BY BRICK!' : ['', 'SINGLE', 'DOUBLE', 'TRIPLE'][n], t: 0, color: n === 4 ? '#ffb020' : '#8dff6a' })
        if (combo > 0) pops.push({ text: `COMBO x${combo + 1}`, t: -0.25, color: '#ff8ad8' })
        clearT = 0.28
        hooks.onEvent?.('clear', n)
        if (combo > 0) hooks.onEvent?.('combo', combo + 1)
        const notes = n === 4 ? [523, 659, 784, 1046] : [523, 659, 784].slice(0, n)
        notes.forEach((f, i) => setTimeout(() => sfx.tone(f, 0.09, 'square', 0.05), i * 70))
      } else { combo = -1; spawn() }
      hud()
    }

    function hardDrop() {
      if (!cur) return
      const gy = ghostY()
      score += (gy - cur.y) * 2
      cur.y = gy
      lock()
    }
    function doHold() {
      if (!cur || held) return
      const p = cur.p
      if (hold) { const h = hold; hold = p; spawn(h) } else { hold = p; spawn() }
      held = true
      sfx.tone(440, 0.04, 'square', 0.03)
    }

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      const ours = ['arrowleft', 'arrowright', 'arrowdown', 'arrowup', 'a', 'd', 's', 'w', 'x', 'z', ' ', 'c', 'shift']
      if (!ours.includes(k)) return
      e.preventDefault()
      if (!running || overT) return
      if (e.type === 'keyup') {
        keys.delete(k)
        if ((k === 'arrowleft' || k === 'a') && dir === -1) dir = (keys.has('arrowright') || keys.has('d')) ? 1 : 0
        if ((k === 'arrowright' || k === 'd') && dir === 1) dir = (keys.has('arrowleft') || keys.has('a')) ? -1 : 0
        if (k === 'arrowdown' || k === 's') soft = false
        return
      }
      if (e.repeat) return
      keys.add(k)
      if (clearT > 0) return
      if (k === 'arrowleft' || k === 'a') { dir = -1; das = 0; arr = 0; tryMove(-1, 0) }
      if (k === 'arrowright' || k === 'd') { dir = 1; das = 0; arr = 0; tryMove(1, 0) }
      if (k === 'arrowdown' || k === 's') soft = true
      if (k === 'arrowup' || k === 'w' || k === 'x') rotate(1)
      if (k === 'z') rotate(-1)
      if (k === ' ') hardDrop()
      if (k === 'c' || k === 'shift') doHold()
    }

    // touch: tap = rotate, drag sideways = move, flick down = hard drop
    let touch: { x: number; y: number; t: number; cell: number; moved: boolean } | null = null
    const local = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H } }
    const onDown = (e: PointerEvent) => { if (e.pointerType === 'mouse') return; const p = local(e); touch = { x: p.x, y: p.y, t: performance.now(), cell: 0, moved: false }; canvas.setPointerCapture(e.pointerId) }
    const onMove = (e: PointerEvent) => {
      if (!touch || !running || overT || clearT > 0) return
      const p = local(e), cell = Math.trunc((p.x - touch.x) / 9)
      while (touch.cell < cell) { tryMove(1, 0); touch.cell++; touch.moved = true }
      while (touch.cell > cell) { tryMove(-1, 0); touch.cell--; touch.moved = true }
      if (p.y - touch.y > 12 && Math.abs(p.x - touch.x) < 10) { soft = true; touch.moved = true }
    }
    const onUp = (e: PointerEvent) => {
      if (!touch) return
      const p = local(e), dt = performance.now() - touch.t, dy = p.y - touch.y
      if (running && !overT && clearT <= 0) {
        if (dy > 24 && dt < 260) hardDrop()
        else if (!touch.moved && dt < 300) rotate(1)
      }
      soft = false; touch = null
    }

    function step(now: number) {
      raf = requestAnimationFrame(step)
      const dt = Math.min(0.05, (now - last) / 1000 || 0)
      last = now
      if (!running) return
      pops.forEach(q => (q.t += dt)); pops = pops.filter(q => q.t < 1.1)

      if (overT) {                                  // top out: grey the well from the bottom up
        overT += dt
        if (overT > 1.3) { running = false; sfx.over(); hooks.onOver({ score, ms: now - t0 }) }
        draw(); return
      }
      if (clearT > 0) {
        clearT -= dt
        if (clearT <= 0) {
          board = board.filter((_, i) => !clearing.includes(i))
          while (board.length < ROWS) board.unshift(Array<P | null>(COLS).fill(null))
          lines += clearing.length
          const nl = 1 + Math.floor(lines / 10)
          if (nl > level) { level = nl; hooks.onEvent?.('level', level); sfx.level(); pops.push({ text: `LEVEL ${level}`, t: -0.4, color: '#59e6ff' }) }
          clearing = []
          spawn(); hud()
        }
        draw(); return
      }
      if (!cur) { draw(); return }

      // auto-shift while a direction is held
      if (dir) { das += dt; if (das >= DAS) { arr += dt; while (arr >= ARR) { arr -= ARR; if (!tryMove(dir, 0)) break } } }

      // gravity
      const g = soft ? Math.min(gravity(), 0.035) : gravity()
      fall += dt
      while (fall >= g && cur) {
        fall -= g
        if (tryMove(0, 1)) { if (soft) score += 1 } else { fall = 0; break }   // resting: don't bank fall time
      }
      if (cur && grounded()) { lockT += dt; if (lockT >= LOCK) lock() } else lockT = 0

      draw(); hud()
    }

    function draw() {
      const pal = palette(skin, performance.now() / 1000)
      const highest = board.findIndex(row => row.some(Boolean))
      frame(ctx, highest >= 0 && highest < HIDDEN + 5 ? 0.5 + 0.5 * Math.sin(performance.now() / 120) : 0)
      // settled bricks
      for (let r = HIDDEN; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const p = board[r][c]
        if (!p) continue
        const y = BY + (r - HIDDEN) * C, x = BX + c * C
        if (clearing.includes(r)) { ctx.fillStyle = Math.floor(clearT * 30) % 2 ? '#ffffff' : pal[p]; ctx.fillRect(x, y, C, C) }
        else brick(ctx, x, y, overT && r >= ROWS - Math.floor(overT * 18) ? '#4a4a46' : pal[p])
      }
      if (overT) {
        for (let r = ROWS - 1; r >= Math.max(HIDDEN, ROWS - Math.floor(overT * 18)); r--) for (let c = 0; c < COLS; c++) if (!board[r][c]) brick(ctx, BX + c * C, BY + (r - HIDDEN) * C, '#2f2f2c')
      }
      // ghost + current piece
      if (cur && !clearing.length) {
        const gy = ghostY(), cells = cellsOf(cur.p, cur.r)
        ctx.strokeStyle = shade(pal[cur.p], -0.2); ctx.lineWidth = 1
        for (const [cx, cy] of cells) { const r = gy + cy; if (r >= HIDDEN) ctx.strokeRect(BX + (cur.x + cx) * C + 0.5, BY + (r - HIDDEN) * C + 0.5, C - 1, C - 1) }
        for (const [cx, cy] of cells) { const r = cur.y + cy; if (r >= HIDDEN) brick(ctx, BX + (cur.x + cx) * C, BY + (r - HIDDEN) * C, pal[cur.p]) }
      }
      // panels
      if (hold) { ctx.globalAlpha = held ? 0.35 : 1; mini(ctx, hold, 29, 29, 5, pal); ctx.globalAlpha = 1 }
      queue.slice(0, 3).forEach((p, i) => mini(ctx, p, 163, [30, 56, 80][i], i === 0 ? 5 : 4, pal))
      label(ctx, 'LINES', 7, 62); label(ctx, String(lines), 7, 80, '#8dff6a', 16)
      if (combo > 0) label(ctx, `COMBO ${combo + 1}`, 7, 98, '#ff8ad8')
      // callouts over the well
      pops.forEach((q, i) => {
        if (q.t < 0) return
        ctx.globalAlpha = Math.max(0, 1 - q.t / 1.1)
        const y = 60 + i * 12 - q.t * 10
        label(ctx, q.text, BX + (COLS * C) / 2 + 1, y + 1, '#000', 8, 'center')
        label(ctx, q.text, BX + (COLS * C) / 2, y, q.color, 8, 'center')
        ctx.globalAlpha = 1
      })
    }

    addEventListener('keydown', onKey); addEventListener('keyup', onKey)
    canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp)
    if (import.meta.env.DEV) (window as any).__bricks = { board: () => board, cur: () => cur, score: () => score, lines: () => lines, over: () => overT }
    // idle: an empty well with one sample of every brick, so the skin picker previews
    const idle = () => { frame(ctx, 0); const pal = palette(skin, 0); ORDER.forEach((q, i) => mini(ctx, q, BX + 8 + (i % 4) * 18, 40 + Math.floor(i / 4) * 22, 5, pal)) }
    board = newBoard(); idle()
    raf = requestAnimationFrame(step)

    return {
      start(o?: StartOptions) {
        rand = o?.seed != null ? rng(o.seed) : Math.random
        board = newBoard(); bag = []; queue = []; hold = null; held = false
        score = 0; lines = 0; level = 1; combo = -1; clearing = []; clearT = 0; overT = 0; pops = []
        dir = 0; soft = false; keys.clear()
        while (queue.length < 3) queue.push(nextFromBag())
        spawn()
        t0 = last = performance.now(); running = true
        sfx.start(); hud()
      },
      destroy() {
        cancelAnimationFrame(raf); running = false
        removeEventListener('keydown', onKey); removeEventListener('keyup', onKey)
        canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove)
        canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp)
      },
      setMuted(m) { sfx.setMuted(m) },
      setSkin(id) { skin = id; if (!running) idle() },
    }
  },
}
