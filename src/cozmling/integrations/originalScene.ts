/* ============================================================
   THE ORIGINAL SCENE, RECOVERED.

   The first Cozmling (the site's first version, October 2026) is a pixel alien drawn in code
   (src/companion/look.ts), living in a home drawn in code (src/companion/scene.ts: the Cosmic
   Grove and the Moon Base, plus the painted Star Loft added later), brought to life by its Room
   (src/companion/room.ts): it wanders, blinks, eats what drops in, bounces a star ball, naps with
   the lights off and hatches with a flash. Those files are the original implementation, kept as
   they were: the Cosmic Grove and the creature are unchanged since the first commit (615d04f).

   This file only says how any companion is shown there:
   - a first-version Cozmling: exactly as itself (its own look, home and stage);
   - a Starprint adventurer: as the original creature, in the Cosmic Grove unless its player has
     moved it. Its look comes from its player's choices (Look A or B is the original's two forms;
     the skin colour is its body colour) and from its Starprint (its antenna glows in its element's
     colour), so the same record always draws the same Cozmling. It grows by the original rule:
     Star Egg → Sprout → Cadet → Explorer → Guardian.
   Nothing here is saved, and nothing here changes care, identity or the sky.
   ============================================================ */
import { GROWTH, growthPoints, HOMES, mood, settle, stageOf, type HomeId } from '../../companion/care'
import { DEFAULT_LOOK, type Form, type Look, type Stage } from '../../companion/look'
import type { Frame } from '../../companion/room'
import { asPet } from '../domain/care'
import type { AdventurerCompanion, Companion, Element } from '../types'
import { legacyGrowth, stageWithFloor } from './legacyAdapter'

/** Which scene a Starprint adventurer is drawn in: the original, recovered (the default), or the
    concept-art figures made for the rebuild, kept in render/AdventurerRenderer.tsx for later. */
export const ADVENTURER_SCENE: 'original' | 'concept-art' = 'original'
/** Is this companion drawn in the original scene? (A first-version Cozmling always is.) */
export const drawnOriginal = (c: Companion) => c.kind === 'legacy' || ADVENTURER_SCENE === 'original'

/** The renderer an adventurer's appearance is for. Records made before the recovery say 'layers-1' (the concept-art figures). */
export const ORIGINAL_RENDERER = 'original-1'
/** Where the original Cozmling lives unless it is moved: the clearing under the big moon. */
export const ORIGINAL_HOME: HomeId = 'grove'
/** The homes in the order they are offered: the original first. */
export const HOME_ORDER: HomeId[] = ['grove', 'moonbase', 'loft']

/** The adoption skin colours as the original's body colours (look.ts BODIES). */
export const SKIN_BODY: Record<string, number> = { teal: 0, sky: 1, lilac: 2, rose: 3, moss: 4, pearl: 7 }
/** Its antenna glows in its element's colour (look.ts GLOWS). */
export const ELEMENT_GLOW: Record<Element, number> = { fire: 6, earth: 3, air: 2, water: 4 }

export const isHome = (h: unknown): h is HomeId => typeof h === 'string' && Object.prototype.hasOwnProperty.call(HOMES, h)

/** An adventurer's choices as the original creature's look. */
export function adventurerLook(choice: { look: 'a' | 'b'; skin: string; element: Element }): Look {
  const form: Form = choice.look === 'b' ? 'girl' : 'boy'
  return { form, body: SKIN_BODY[choice.skin] ?? DEFAULT_LOOK[form].body, glow: ELEMENT_GLOW[choice.element] ?? DEFAULT_LOOK[form].glow, eyes: DEFAULT_LOOK[form].eyes }
}

export function originalLook(c: Companion): Look {
  if (c.kind === 'legacy') return c.legacy.pet.look
  return adventurerLook({ look: c.appearance.appearanceOption, skin: c.appearance.skin, element: c.starprint.element })
}

/** Its home. An adventurer from before the recovery (or with no home chosen) lives in the Cosmic Grove. */
export function originalHome(c: Companion): HomeId {
  if (c.kind === 'legacy') return c.legacy.pet.home
  return c.appearance.rendererVersion === ORIGINAL_RENDERER && isHome(c.appearance.home) ? c.appearance.home : ORIGINAL_HOME
}

/** Its stage by the original growth rule (a first-version Cozmling never drops below a stage it reached). */
export function originalStage(c: Companion): Stage {
  if (c.kind === 'legacy') return stageWithFloor(c.legacy.pet, c.legacy.stageFloor)
  return c.hatch.status === 'hatched' ? stageOf(asPet(c)) : 'egg'
}

/** How far it has grown on the original ladder: its stage, its points, the next stage and how far to it. */
export function originalProgress(c: Companion) {
  const stage = originalStage(c), points = c.kind === 'legacy' ? legacyGrowth(c) : growthPoints(asPet(c))
  const i = GROWTH.findIndex(s => s.stage === stage), from = GROWTH[i]?.at ?? 0, next = i < 0 ? null : GROWTH[i + 1] ?? null
  const pct = next ? Math.max(0, Math.min(100, Math.round(((points - from) / (next.at - from)) * 100))) : 100
  return { stage, points, next, pct }
}

/** Everything the original Room needs to draw this companion now. */
export function originalFrame(c: Companion, crack = 0, now = Date.now()): Frame {
  const pet = settle(c.kind === 'legacy' ? c.legacy.pet : asPet(c as AdventurerCompanion), now), m = mood(pet)
  return { home: originalHome(c), look: originalLook(c), stage: originalStage(c), asleep: !!pet.asleep, low: m.mood === 'low', need: m.need, crack }
}
