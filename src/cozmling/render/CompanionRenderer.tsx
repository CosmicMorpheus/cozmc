/* One way to draw any companion, wherever it appears:
     <CompanionRenderer companion={c} mode="loft" />       the Cozmling page
     <CompanionRenderer companion={c} mode="buddy" />      beside an arcade game
     <CompanionRenderer companion={c} mode="spotlight" />  on Home
   A first-version Cozmling is drawn by the first version's own renderer, unchanged.
   A Starprint adventurer has its own renderer, built on its art and a manifest of attachment points. */
import { forwardRef } from 'react'
import type { Companion } from '../types'
import { AdventurerRenderer } from './AdventurerRenderer'
import { LegacyCompanionRenderer } from './LegacyCompanionRenderer'

export type RenderMode = 'loft' | 'buddy' | 'spotlight'
/** Things the scene can act out. The care rules decide what happens; this only shows it. */
export interface RendererHandle { react(what: 'play' | 'refuse' | 'pat' | 'sleep' | 'wake' | 'crack' | 'hatch' | 'feed', food?: string): void }
export interface RendererProps { companion: Companion; mode: RenderMode; /** how far an egg has cracked, 0 to 3 */ crack?: number; className?: string; /** adventurers only: show another stage without saving it (dev tools) */ previewStage?: 'hatchling' | 'adolescent' | 'ascended' | null; /** a tap or click on the Cozmling itself. Only ever a shortcut: every action has a real button too */ onTap?: () => void }

export const CompanionRenderer = forwardRef<RendererHandle, RendererProps>(function CompanionRenderer(props, ref) {
  if (props.companion.kind === 'legacy') return <LegacyCompanionRenderer {...props} companion={props.companion} ref={ref} />
  return <AdventurerRenderer {...props} companion={props.companion} ref={ref} />
})
