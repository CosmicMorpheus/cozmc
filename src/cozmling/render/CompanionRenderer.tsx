/* One way to draw any companion, wherever it appears:
     <CompanionRenderer companion={c} mode="loft" />       the Cozmling page
     <CompanionRenderer companion={c} mode="buddy" />      beside an arcade game
     <CompanionRenderer companion={c} mode="spotlight" />  on Home
   Every companion is drawn in the original Cozmling scene, recovered (OriginalSceneRenderer): the
   first version's own pixel creature and homes. The concept-art figures made for the rebuild are
   kept (AdventurerRenderer) and can be switched back on for adventurers in integrations/originalScene.ts. */
import { forwardRef } from 'react'
import type { Stage } from '../../companion/look'
import { drawnOriginal } from '../integrations/originalScene'
import type { Companion } from '../types'
import { AdventurerRenderer } from './AdventurerRenderer'
import { OriginalSceneRenderer } from './OriginalSceneRenderer'

export type RenderMode = 'loft' | 'buddy' | 'spotlight'
/** Things the scene can act out. The care rules decide what happens; this only shows it. */
export interface RendererHandle { react(what: 'play' | 'refuse' | 'pat' | 'sleep' | 'wake' | 'crack' | 'hatch' | 'feed', food?: string): void }
type ArtStage = 'hatchling' | 'adolescent' | 'ascended'
export interface RendererProps {
  companion: Companion; mode: RenderMode
  /** how far an egg has cracked, 0 to 3 */ crack?: number
  className?: string
  /** show another stage without saving it (preview tools): an original stage, or a concept-art one */ previewStage?: Stage | ArtStage | null
  /** a tap or click on the Cozmling itself. Only ever a shortcut: every action has a real button too */ onTap?: () => void
}
const ART_STAGES: readonly string[] = ['hatchling', 'adolescent', 'ascended']
const isArtStage = (s: unknown): s is ArtStage => typeof s === 'string' && ART_STAGES.includes(s)

export const CompanionRenderer = forwardRef<RendererHandle, RendererProps>(function CompanionRenderer({ previewStage = null, ...props }, ref) {
  const c = props.companion
  if (c.kind === 'legacy' || drawnOriginal(c)) return <OriginalSceneRenderer {...props} previewStage={previewStage && !isArtStage(previewStage) ? previewStage : null} ref={ref} />
  return <AdventurerRenderer {...props} companion={c} previewStage={isArtStage(previewStage) ? previewStage : null} ref={ref} />
})
