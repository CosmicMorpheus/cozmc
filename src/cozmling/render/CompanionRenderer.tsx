/* One way to draw any companion, wherever it appears:
     <CompanionRenderer companion={c} mode="loft" />       the Cozmling page
     <CompanionRenderer companion={c} mode="buddy" />      beside an arcade game
     <CompanionRenderer companion={c} mode="spotlight" />  on Home
   A first-version Cozmling is drawn by the first version's own renderer, unchanged.
   A Starprint adventurer gets its own layered renderer (next milestone). */
import { forwardRef } from 'react'
import type { Companion } from '../types'
import { LegacyCompanionRenderer } from './LegacyCompanionRenderer'

export type RenderMode = 'loft' | 'buddy' | 'spotlight'
/** Things the scene can act out. The care rules decide what happens; this only shows it. */
export interface RendererHandle { react(what: 'play' | 'refuse' | 'pat' | 'sleep' | 'wake' | 'crack' | 'hatch' | 'feed', food?: string): void }
export interface RendererProps { companion: Companion; mode: RenderMode; /** how far an egg has cracked, 0 to 3 */ crack?: number; className?: string }

export const CompanionRenderer = forwardRef<RendererHandle, RendererProps>(function CompanionRenderer(props, ref) {
  if (props.companion.kind === 'legacy') return <LegacyCompanionRenderer {...props} companion={props.companion} ref={ref} />
  // adventurers: the layered renderer arrives with the first adventurer. Until then, its name and sign, never a crash.
  return <div className={props.className} role="img" aria-label={`${props.companion.name}, ${props.companion.starprint.coreSign}`}>{props.companion.name}</div>
})
