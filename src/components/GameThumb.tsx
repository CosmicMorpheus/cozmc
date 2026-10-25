import { useEffect, useRef } from 'react'
import type { ArcadeGame } from '../arcade/types'

/** A game's cover art on a little CRT. Redraws once the pixel font has loaded. */
export function GameThumb({ game, className = '' }: { game: ArcadeGame; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current!; c.width = game.width; c.height = game.height
    const ctx = c.getContext('2d')!; ctx.imageSmoothingEnabled = false
    game.drawCover(ctx)
    document.fonts.load('700 16px Silkscreen').then(() => game.drawCover(ctx), () => {})
  }, [game])
  return <span className={`thumb crt ${className}`}><canvas ref={ref} aria-hidden="true" /></span>
}
