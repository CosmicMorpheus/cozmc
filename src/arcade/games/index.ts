import type { ArcadeGame } from '../types'
import { moonBounce } from './moonBounce'
import { brickByBrick } from './brickByBrick'
import { moonshot } from './moonshot'

/** Every cabinet in the arcade, in display order. Add new games here. */
export const GAMES: ArcadeGame[] = [moonBounce, brickByBrick, moonshot]

export const gameById = (id: string) => GAMES.find(g => g.id === id)
