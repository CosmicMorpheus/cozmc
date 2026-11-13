/* A new Starprint adventurer: what the player chooses at adoption, and the record it becomes. */
import { cleanName } from '../../companion/care'
import type { AdventurerCompanion } from '../types'
import { CARE_RULES, STAGE_RULES } from './care'
import { starprintFor } from './starprint'

/** Skin colours. Any adventurer can have any of them: skin never depends on the element. */
export const SKINS: { id: string; name: string; color: string }[] = [
  { id: 'teal', name: 'Sea teal', color: '#5fd4c4' }, { id: 'lilac', name: 'Lilac', color: '#b9a3e8' }, { id: 'moss', name: 'Moss', color: '#a9c77a' },
  { id: 'rose', name: 'Rose', color: '#f2a7c3' }, { id: 'sky', name: 'Sky', color: '#8fc7ff' }, { id: 'pearl', name: 'Pearl', color: '#e8e3d6' },
]
export const RENDERER = 'layers-1'
export const NAMES = ['Orbi', 'Nova', 'Zib', 'Luna', 'Comet', 'Vega', 'Lyra', 'Kip', 'Mira', 'Rigel', 'Zuzu', 'Sol']

export interface AdoptChoices { name: string; birthday: string; look: 'a' | 'b'; skin: string }

/** Why these choices can't be adopted yet, or null. */
export function adoptProblem(c: AdoptChoices): string | null {
  if (!starprintFor(c.birthday)) return 'Pick a birthday for your Cozmling.'
  if (!cleanName(c.name).trim()) return 'Give your Cozmling a name.'
  if (c.look !== 'a' && c.look !== 'b') return 'Pick a look.'
  if (!SKINS.some(s => s.id === c.skin)) return 'Pick a skin colour.'
  return null
}

/** A newly adopted adventurer: a Star Egg, with the same starting needs a first-version Cozmling gets. */
export function newAdventurer(c: AdoptChoices, o: { companionId: string; now: number }): AdventurerCompanion {
  const why = adoptProblem(c)
  if (why) throw new Error(why)
  return {
    schemaVersion: 2, kind: 'adventurer', companionId: o.companionId, revision: 0, createdAt: o.now, updatedAt: o.now,
    hatch: { status: 'egg', hatchedAt: null, provenance: 'known' },
    walletLinks: [],
    name: cleanName(c.name).trim(),
    starprint: starprintFor(c.birthday)!,
    appearance: { rendererVersion: RENDERER, appearanceOption: c.look, skin: c.skin, outfit: 'starter', home: 'loft', decor: [] },
    care: { food: 80, fun: 80, energy: 90, asleepAt: null, settledAt: o.now, ruleVersion: CARE_RULES },
    progress: { experience: 0, visualStageVersion: STAGE_RULES, visualStage: null, counters: {} },
  }
}

/** Wardrobe changes. Identity (the Starprint) is never touched by a change of look, skin or name. */
export function customize(c: AdventurerCompanion, change: Partial<Pick<AdoptChoices, 'name' | 'look' | 'skin'>>): AdventurerCompanion | null {
  const name = change.name === undefined ? c.name : cleanName(change.name).trim()
  const look = change.look ?? c.appearance.appearanceOption, skin = change.skin ?? c.appearance.skin
  if (!name || (look !== 'a' && look !== 'b') || !SKINS.some(s => s.id === skin)) return null
  if (name === c.name && look === c.appearance.appearanceOption && skin === c.appearance.skin) return null
  return { ...c, name, appearance: { ...c.appearance, appearanceOption: look, skin } }
}
