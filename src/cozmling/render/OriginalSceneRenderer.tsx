/* The original Cozmling scene, recovered (see integrations/originalScene.ts): any companion drawn by
   the first version's own Room, the same pixel creature in the same homes it always had.
   - A first-version Cozmling is drawn exactly as the first version draws it.
   - A Starprint adventurer is drawn as the original creature, in the Cosmic Grove unless moved.
   Only where its state comes from is new (the v2 store). With reduced motion asked for, the room
   holds still (Room.calm): care still shows, as a pose. */
import { forwardRef, useEffect, useImperativeHandle, useRef, type PointerEvent } from 'react'
import { HOMES } from '../../companion/care'
import { GLOWS, STAGE_NAME, type Stage } from '../../companion/look'
import { Room } from '../../companion/room'
import { CH, CW } from '../../companion/scene'
import { nameOf } from '../domain/care'
import { originalFrame, originalLook } from '../integrations/originalScene'
import type { Companion } from '../types'
import type { RendererHandle, RenderMode } from './CompanionRenderer'

export const OriginalSceneRenderer = forwardRef<RendererHandle, {
  companion: Companion; mode: RenderMode; crack?: number; className?: string
  /** show another stage without saving it (preview tools only) */ previewStage?: Stage | null
  onTap?: () => void
}>(
  function OriginalSceneRenderer({ companion, mode, crack = 0, className, previewStage = null, onTap }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null)
    const room = useRef<Room | null>(null)
    const live = useRef({ companion, crack, previewStage })
    live.current = { companion, crack, previewStage }

    useEffect(() => {
      const r = new Room(canvas.current!)
      room.current = r
      const calm = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
      const still = () => { r.calm = !!calm?.matches }
      still()
      calm?.addEventListener?.('change', still)
      let raf = 0, seen: Companion | null = null, second = -1, k = -1, frame = originalFrame(live.current.companion)
      const loop = () => {
        const { companion: c, crack: ck, previewStage: ps } = live.current
        const now = Date.now(), s = Math.floor(now / 1000)
        // needs drift slowly: working the frame out once a second (or when anything changes) is plenty
        if (c !== seen || s !== second || ck !== k) { seen = c; second = s; k = ck; frame = originalFrame(c, ck, now) }
        r.draw(ps && frame.stage !== 'egg' ? { ...frame, stage: ps } : frame)
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => { cancelAnimationFrame(raf); calm?.removeEventListener?.('change', still); room.current = null }
    }, [])

    useImperativeHandle(ref, () => ({
      react(what, food) {
        const r = room.current
        if (!r) return
        if (what === 'feed') r.feed(food ?? 'cheese')
        else if (what === 'hatch') r.hatch(GLOWS[originalLook(live.current.companion).glow] ?? GLOWS[0])
        else r[what]()
      },
    }), [])

    const f = originalFrame(companion, crack)
    const tap = onTap && ((e: PointerEvent<HTMLCanvasElement>) => {
      const b = e.currentTarget.getBoundingClientRect()
      if (room.current?.hit((e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height)) onTap()
    })
    return (
      <canvas ref={canvas} width={CW} height={CH} className={className} data-mode={mode} data-scene="original" data-home={f.home} data-stage={previewStage ?? f.stage}
        role="img" aria-label={`${nameOf(companion)}, ${STAGE_NAME[previewStage ?? f.stage]}, in the ${HOMES[f.home].name}${f.asleep ? ', asleep' : ''}`} onPointerDown={tap || undefined} />
    )
  },
)
