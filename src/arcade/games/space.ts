/* Shared space art for the arcade: the COZMC astronaut (with its tier-skin helmets)
   and the alien sprites. Moon Bounce and Moonshot both draw from here. */

export const ASTRO_R = 6
export type Kind = 'ufo' | 'alien' | 'probe' | 'octo'

/* sprites — a = body, b/c = shades, g = alien green, w = eye white, p = pupil, l = lights */
export const SPRITES: Record<Kind, { rows: string[]; pal: Record<string, string>; burst: string[] }> = {
  ufo: {
    pal: { a: '#c9ccd6', c: '#5d6170', b: '#59e6ff', g: '#8dff6a', w: '#ffffff', p: '#000000', l: '#ffd13a' },
    burst: ['#c9ccd6', '#59e6ff', '#ffd13a'],
    rows: [
      '.....bbbb.....',
      '....bggggb....',
      '....bwpwpb....',
      '.aaaaaaaaaaaa.',
      'aaaaaaaaaaaaaa',
      'alaalaalaalaal',
      '.cccccccccccc.',
      '...cc....cc...',
    ],
  },
  alien: {
    pal: { g: '#8dff6a', c: '#3f9a2c', w: '#ffffff', p: '#000000', l: '#ff6aa8', d: '#123d0c' },
    burst: ['#8dff6a', '#ffffff', '#ff6aa8'],
    rows: [
      '.l.......l.',
      '..g.....g..',
      '...ggggg...',
      '..ggggggg..',
      '.gwwgggwwg.',
      '.gwpgggpwg.',
      '.ggggggggg.',
      '..ggdddgg..',
      '...ggggg...',
      '..cc...cc..',
      '.cc.....cc.',
    ],
  },
  probe: {
    pal: { a: '#b06bff', c: '#5b2a99', r: '#ff2d2d', w: '#ffffff', e: '#ffd13a' },
    burst: ['#b06bff', '#ff2d2d', '#ffffff'],
    rows: [
      '.....ee.....',
      '....aaaa....',
      '..aaaaaaaa..',
      '.aaarrrraaa.',
      'aaaarwwraaaa',
      '.aaarrrraaa.',
      '..aaaaaaaa..',
      '.c..c..c..c.',
    ],
  },
  octo: {
    pal: { o: '#ff6a8a', c: '#b0304e', w: '#ffffff', p: '#2a0010', d: '#7a1830' },
    burst: ['#ff6a8a', '#ffffff', '#ffb020'],
    rows: [
      '...ooooooo...',
      '..ooooooooo..',
      '.ooooooooooo.',
      '.oowwoooowwo.',
      '.oowpoooowpo.',
      '.ooooooooooo.',
      '..oooddddoo..',
      '..o.o.o.o.o..',
      '.o..o..o..o..',
      '.c...c...c...',
    ],
  },
}

export function sprite(ctx: CanvasRenderingContext2D, rows: string[], pal: Record<string, string>, x: number, y: number, flip = false, sy = 1) {
  const w = rows[0].length, h = rows.length
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const ch = rows[r][flip ? w - 1 - c : c]
    if (ch === '.' || !pal[ch]) continue
    ctx.fillStyle = pal[ch]
    ctx.fillRect(Math.round(x - w / 2 + c), Math.round(y - (h * sy) / 2 + r * sy), 1, Math.max(1, Math.ceil(sy)))
  }
}

/** Helmet colours per tier skin. Black Hole shifts through the rainbow. */
export const HELMETS: Record<string, { shell: string; rim: string; visor: string; glint: string; trail?: string }> = {
  classic: { shell: '#f1efe6', rim: '#8c8a82', visor: '#2a6fd6', glint: '#bff3ff' },
  comet: { shell: '#e8fbff', rim: '#4f9fb6', visor: '#59e6ff', glint: '#ffffff', trail: '#59e6ff' },
  moon: { shell: '#bdbdb6', rim: '#6b6b66', visor: '#1d2a3a', glint: '#8fa6b8' },
  planet: { shell: '#8dff6a', rim: '#2c6b1f', visor: '#0d3b66', glint: '#9fe8ff', trail: '#8dff6a' },
  star: { shell: '#ffd13a', rim: '#a9803c', visor: '#ff5a1f', glint: '#fff4c2', trail: '#ffb020' },
  blackhole: { shell: '', rim: '#3a1a66', visor: '#120626', glint: '#ff8ad8', trail: '#b06bff' },
}

/** The astronaut: a round helmet with a visor that faces where you're heading. */
export function astronaut(ctx: CanvasRenderingContext2D, x: number, y: number, sx: number, sy: number, look: number, skin = 'classic', t = 0) {
  const h = HELMETS[skin] ?? HELMETS.classic
  const rx = ASTRO_R * sx, ry = ASTRO_R * sy
  for (let yy = -Math.ceil(ry); yy <= Math.ceil(ry); yy++) for (let xx = -Math.ceil(rx); xx <= Math.ceil(rx); xx++) {
    const d = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry)
    if (d > 1) continue
    let col = d > 0.72 ? h.rim : h.shell || `hsl(${(t * 140 + (xx + yy) * 18) % 360},90%,68%)`
    const vx = xx - look * 1.5, vy = yy + ry * 0.1
    if ((vx * vx) / (rx * rx * 0.45) + (vy * vy) / (ry * ry * 0.3) <= 1) col = vx < -1 && vy < 0 ? h.glint : h.visor   // visor
    ctx.fillStyle = col
    ctx.fillRect(Math.round(x + xx), Math.round(y + yy), 1, 1)
  }
  ctx.fillStyle = '#8dff6a'; ctx.fillRect(Math.round(x - look * 4), Math.round(y - ry - 2), 1, 2)   // little antenna, COZMC green
}
