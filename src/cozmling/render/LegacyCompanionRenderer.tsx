/* A first-version Cozmling, drawn exactly as the first version draws it: the same Room, the same
   look, home and stage. Only where its state comes from has changed (the v2 store). */
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { mood, settle } from '../../companion/care'
import { GLOWS, STAGE_NAME } from '../../companion/look'
import { Room } from '../../companion/room'
import { CH, CW } from '../../companion/scene'
import { legacyStage, stageWithFloor } from '../integrations/legacyAdapter'
import type { LegacyCompanion } from '../types'
import type { RendererHandle, RenderMode } from './CompanionRenderer'

export const LegacyCompanionRenderer = forwardRef<RendererHandle, { companion: LegacyCompanion; mode: RenderMode; crack?: number; className?: string }>(
  function LegacyCompanionRenderer({ companion, mode, crack = 0, className }, ref) {
    const canvas = useRef<HTMLCanvasElement>(null)
    const room = useRef<Room | null>(null)
    const live = useRef({ companion, crack })
    live.current = { companion, crack }

    useEffect(() => {
      const r = new Room(canvas.current!)
      room.current = r
      let raf = 0, seen: LegacyCompanion | null = null, second = -1, pet = live.current.companion.legacy.pet
      const loop = () => {
        const { companion: c, crack: k } = live.current
        const now = Math.floor(Date.now() / 1000)
        if (c !== seen || now !== second) { seen = c; second = now; pet = settle(c.legacy.pet) }      // needs drift slowly: once a second is plenty
        const m = mood(pet)
        r.draw({ home: pet.home, look: pet.look, stage: stageWithFloor(pet, c.legacy.stageFloor), asleep: !!pet.asleep, low: m.mood === 'low', need: m.need, crack: k })
        raf = requestAnimationFrame(loop)
      }
      raf = requestAnimationFrame(loop)
      return () => { cancelAnimationFrame(raf); room.current = null }
    }, [])

    useImperativeHandle(ref, () => ({
      react(what, food) {
        const r = room.current
        if (!r) return
        if (what === 'feed') r.feed(food ?? 'cheese')
        else if (what === 'hatch') r.hatch(GLOWS[live.current.companion.legacy.pet.look.glow] ?? GLOWS[0])
        else r[what]()
      },
    }), [])

    const pet = companion.legacy.pet
    return <canvas ref={canvas} width={CW} height={CH} className={className} data-mode={mode} role="img" aria-label={`${pet.name}, ${STAGE_NAME[legacyStage(companion)]}`} />
  },
)
