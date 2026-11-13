/* Light questions about a Cozmling's sky that need no astronomy, so any screen can ask them
   without loading the engine. */
import type { AdventurerCompanion, Companion, LegacyCompanion } from '../types'

/** What can be read for a first-version Cozmling. Only ever done when its player asks. */
export function legacySkyOption(c: LegacyCompanion): 'birth' | 'awakening' | 'egg' | 'read' {
  if (c.celestial) return 'read'
  if (c.hatch.status !== 'hatched') return 'egg'
  return c.hatch.provenance === 'known' && c.hatch.hatchedAt != null ? 'birth' : 'awakening'
}

/** For a Cozmling made before its Starprint came from the sky: does its chart disagree with it? */
export const starprintDisagrees = (c: AdventurerCompanion) => !!c.celestial && c.celestial.kind === 'birth' && c.celestial.bodies.sun.sign !== c.starprint.coreSign

/** An adventurer that has hatched but has no sky yet (it hatched before skies could be read). */
export const awaitingSky = (c: Companion) => c.kind === 'adventurer' && !c.celestial && c.hatch.status === 'hatched' && c.hatch.hatchedAt != null
