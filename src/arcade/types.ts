/* ============================================================
   THE ARCADE CONTRACT
   Every game is a plain object that draws into a <canvas>. To add a game:
   1. make a file in src/arcade/games/ that exports an ArcadeGame
   2. add it to the GAMES list in src/arcade/games/index.ts
   It gets a cabinet, a leaderboard, the Daily Challenge, on-chain score
   posting, achievements and share cards for free.
   ============================================================ */

export interface GameHud { score: number; lives: number; level: number }

export type TouchButton = 'left' | 'right' | 'jump' | 'rotate' | 'down' | 'drop' | 'hold' | 'tap'

export interface GameHooks {
  /** call whenever the score/lives change (cheap; the cabinet throttles rendering) */
  onHud(h: GameHud): void
  /** call once when the run ends */
  onOver(result: { score: number; ms: number }): void
  /** gameplay moments the cabinet turns into achievements, e.g. ('chain', 10) or ('clear', 4) */
  onEvent?(type: string, value: number): void
}

export interface StartOptions {
  /** when set, every random gameplay choice comes from this seed (the Daily Challenge) */
  seed?: number
}

export interface GameHandle {
  start(opts?: StartOptions): void
  destroy(): void
  setMuted(muted: boolean): void
  /** switch cosmetic skin live */
  setSkin?(id: string): void
}

/** A cosmetic look, unlocked by holder tier (index into TIERS: 0 = Stardust … 5 = Black Hole). */
export interface Skin { id: string; name: string; tier: number }

export interface ArcadeGame {
  /** stable id — it's written into every on-chain score, never rename it */
  id: string
  title: string
  tagline: string
  controls: string[]
  /** logical canvas size; the cabinet scales it up with crisp pixels */
  width: number
  height: number
  /** scores above this, or faster than maxPerSecond, are left off the board */
  maxScore: number
  maxPerSecond: number
  /** what the HUD calls GameHud.level (default 'Lvl') */
  levelLabel?: string
  /** hearts shown in the HUD (default 3, 0 hides them) */
  maxLives?: number
  /** on-screen buttons for touch screens, in display order; they press the same keys as a keyboard */
  touch?: TouchButton[]
  /** cosmetic skins, first one is the default */
  skins?: Skin[]
  /** paint a still frame for the cabinet thumbnail */
  drawCover(ctx: CanvasRenderingContext2D): void
  create(canvas: HTMLCanvasElement, hooks: GameHooks, opts?: { skin?: string }): GameHandle
}

/** Is an on-chain score believable for this game? (Client games can always be spoofed; this filters the obvious.) */
export const plausible = (g: ArcadeGame, score: number, ms: number) =>
  score <= g.maxScore && score <= Math.max(500, (ms / 1000) * g.maxPerSecond)

/** The six tier skins both games use, in tier order. */
export const TIER_SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', tier: 0 },
  { id: 'comet', name: 'Comet', tier: 1 },
  { id: 'moon', name: 'Moon', tier: 2 },
  { id: 'planet', name: 'Planet', tier: 3 },
  { id: 'star', name: 'Star', tier: 4 },
  { id: 'blackhole', name: 'Black Hole', tier: 5 },
]
