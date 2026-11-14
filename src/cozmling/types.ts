/* ============================================================
   COZMLING v2 — what a saved companion looks like.

   A companion has its own permanent id. It is not its wallet, its name or its birthday:
   connecting, switching or disconnecting a wallet never changes which companion this is.

   Two kinds live side by side:
   - legacy:     a Cozmling from the first version (Egg, Sprout, Cadet, Explorer, Guardian). Its
                 v1 state is kept whole, in the v1 shape, and the v1 care rules keep running on it.
                 It is never converted, demoted or merged.
   - adventurer: a new zodiac "Starprint" adventurer.
   ============================================================ */
import type { Pet } from '../companion/care'
import type { Birthplace, CelestialBirthRecord } from './celestial/types'
import type { Stage as LegacyStage } from '../companion/look'

export const SCHEMA_VERSION = 2
export type { LegacyStage, Pet }

export type ZodiacSign = 'aries' | 'taurus' | 'gemini' | 'cancer' | 'leo' | 'virgo' | 'libra' | 'scorpio' | 'sagittarius' | 'capricorn' | 'aquarius' | 'pisces'
export type Element = 'fire' | 'earth' | 'air' | 'water'

export interface WalletLink { address: string; linkedAt: number; status: 'linked' | 'recovery-candidate' }

/** Whether it has hatched, and whether we really know when. A Cozmling restored from an old
    wallet note has no record of its hatch, so that is said plainly instead of inventing a date. */
export interface Hatch { status: 'egg' | 'hatched'; hatchedAt: number | null; provenance: 'known' | 'legacy-unknown' }

interface Base {
  schemaVersion: 2
  companionId: string
  /** Goes up by one with every accepted change. A write based on an older revision is refused. */
  revision: number
  createdAt: number
  updatedAt: number
  hatch: Hatch
  walletLinks: WalletLink[]
  /** Set aside, never deleted (for example when the old site replaced it with a new Cozmling). */
  archived?: { at: number; reason: string }
  /** Its birth sky (celestial/types.ts). Read once, at hatch (or when its player asks, for a first-version
      Cozmling), and never changed after that: the store keeps the first one it saved. */
  celestial?: CelestialBirthRecord
}

export interface LegacyCompanion extends Base {
  kind: 'legacy'
  legacy: {
    /** The v1 localStorage key it lives under ('' when it has none in this browser). */
    sourceKey: string
    /** Checksum of the untouched original value, which is kept in the `sources` store. */
    sourceHash: string
    migratedAt: number
    /** The stage and growth points it had when it was brought in: it is never shown below these. */
    stageFloor: LegacyStage
    growthFloor: number
    /** The working v1 state, exactly as the first version saves it. */
    pet: Pet
  }
}

export interface Starprint {
  /** The Cozmling's chosen birthday (YYYY-MM-DD). Not the player's. */
  chosenBirthday: string
  coreSign: ZodiacSign
  element: Element
  archetype: string
  /** fixture = a labelled stand-in; partial = sign only; calculated = from the real engine. */
  status: 'fixture' | 'partial' | 'calculated'
  engineVersion: string
  observatoryVersion?: string
  /** Where its birth sky is read (chosen at adoption). Not recorded = the COZMC default, the Origin Observatory. */
  birthplace?: Birthplace
  moon?: ZodiacSign
  rising?: ZodiacSign
}

export interface AdventurerCompanion extends Base {
  kind: 'adventurer'
  name: string
  starprint: Starprint
  appearance: { rendererVersion: string; appearanceOption: 'a' | 'b'; skin: string; outfit: string; tool?: string; home: string; decor: string[] }
  care: { food: number; fun: number; energy: number; asleepAt: number | null; settledAt: number; ruleVersion: string }
  progress: { experience: number; visualStageVersion: string; visualStage: 'hatchling' | 'adolescent' | 'ascended' | null; counters: Record<string, number> }
}

export type Companion = LegacyCompanion | AdventurerCompanion

/** One v1 localStorage value we have seen, kept as evidence and as the link to its companion. */
export interface SourceRecord {
  sourceKey: string
  /** The first value ever seen under this key, untouched, with its checksum. */
  originalRaw: string
  originalHash: string
  firstSeenAt: number
  status: 'migrated' | 'quarantined'
  /** Why it was set aside (quarantined records are kept, never repaired or deleted). */
  reason?: string
  companionId?: string
  /** Checksum of the v1 value as of the last time v2 looked: what v2 itself wrote there, or what it took in. */
  lastSeenHash: string
  /** Values that were replaced along the way, newest last (bounded). Nothing is dropped silently. */
  history: { at: number; hash: string; raw: string; note: string }[]
  migrationVersion: number
}

/** Something that happened, recorded once. The id makes a second delivery of the same thing a no-op. */
export interface JourneyEvent {
  eventId: string
  companionId: string
  type: 'migrated' | 'adopted' | 'hatched' | 'care' | 'arcade-run' | 'customized' | 'wallet-linked' | 'imported' | 'sky-read' | 'story' | 'choice-story' | 'story-mode'
  at: number
  data?: Record<string, unknown>
}

export interface Snapshot { companions: Companion[]; sources: SourceRecord[]; meta: Record<string, unknown> }
