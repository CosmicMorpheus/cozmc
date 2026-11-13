/* ============================================================
   CELESTIAL DNA — the shape of a Cozmling's birth sky.

   A CelestialBirthRecord is worked out once, from real astronomy, and then never changes
   through play (the store refuses to alter it). Stories are written FROM it elsewhere
   (interpret.ts); nothing a story says can change it.

   Longitudes are tropical: measured along the ecliptic from the spring equinox of that date,
   seen from the centre of the Earth, as Western astrology uses them.
   ============================================================ */
import type { Element, ZodiacSign } from '../types'

export type BodyId = 'sun' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto'
export type AngleId = 'ascendant' | 'midheaven'
export type PointId = BodyId | AngleId
export type AspectKind = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition'
export type MoonPhaseName = 'New Moon' | 'Waxing Crescent' | 'First Quarter' | 'Waxing Gibbous' | 'Full Moon' | 'Waning Gibbous' | 'Last Quarter' | 'Waning Crescent'

export interface Placement {
  /** Tropical ecliptic longitude in degrees, 0 ≤ lon < 360. */
  lon: number
  /** Ecliptic latitude in degrees. */
  lat: number
  sign: ZodiacSign
  /** Degrees into its sign, 0 ≤ degree < 30. */
  degree: number
  /** How fast it moves along the zodiac, in degrees per day (negative = retrograde). */
  speed: number
  retrograde: boolean
  /** Barely moving: close to turning retrograde or direct. */
  stationary: boolean
  /** Its whole-sign house, 1 to 12, or null when the birth time isn't known. */
  house: number | null
}

export interface AnglePoint { lon: number; sign: ZodiacSign; degree: number }

export interface Aspect {
  a: PointId
  b: PointId
  kind: AspectKind
  /** The aspect's exact angle (0, 60, 90, 120 or 180). */
  angle: number
  /** The actual angle between them. */
  separation: number
  /** How far from exact, in degrees. */
  orb: number
  /** The widest orb allowed for this pair. */
  allowed: number
  /** Getting closer to exact (true), moving apart (false), or not known (null, for the angles). */
  applying: boolean | null
  /** For ranking: closeness to exact, weighted by how personal the two points are. 0 to 1. */
  score: number
}

export interface Pattern {
  kind: 'stellium' | 'grand-trine' | 'T-square' | 'grand-cross'
  points: BodyId[]
  sign?: ZodiacSign
  element?: Element
}

/** Where a Cozmling is born. Fictional, but standing on a real spot so its sky can be worked out. */
export interface Birthplace {
  id: string
  version: number
  name: string
  place: string
  latitude: number
  longitude: number
  /** null when not known (a city): it doesn't change the chart, which is worked out from the centre of the Earth */
  elevationM: number | null
  timeZone: string
  fictional: boolean
  /** how it was chosen at adoption: the COZMC default (also when not recorded), a place the player chose, or a surprise */
  choice?: 'default' | 'chosen' | 'surprise'
  /** where a real place's coordinates and time zone come from */
  source?: string
}

export interface BirthMoment {
  /** The moment of birth in UTC (ISO 8601). */
  utc: string
  ms: number
  /** The birthday the player chose (YYYY-MM-DD, observatory calendar), when there was one. */
  birthday: string | null
  /** When the egg actually hatched, when that is known. */
  hatchedAt: number | null
  /** The wall clock at the observatory at the moment of birth (YYYY-MM-DDTHH:MM:SS). */
  observatoryLocal: string
  /** The player's own time zone when the sky was read, for showing times in their clock. */
  displayTimeZone: string
}

export interface CelestialBirthRecord {
  schema: 1
  companionId: string
  /** 'birth' = the sky it was born under. 'awakening' = a sky given later, to a Cozmling whose birth moment is unknown. */
  kind: 'birth' | 'awakening'
  /** How the moment was chosen. */
  rule: 'chosen-day-hatch-minute' | 'hatch-moment' | 'awakening-moment'
  moment: BirthMoment
  birthplace: Birthplace
  engine: { name: 'cozmc-celestial'; version: number; library: string; libraryVersion: string }
  zodiac: 'tropical'
  houseSystem: 'whole-sign'
  bodies: Record<BodyId, Placement>
  angles: { ascendant: AnglePoint; midheaven: AnglePoint } | null
  /** The sign of each house, from the 1st to the 12th, or null when the birth time isn't known. */
  houses: ZodiacSign[] | null
  moonPhase: { angle: number; name: MoonPhaseName; illumination: number }
  aspects: Aspect[]
  patterns: Pattern[]
  calculatedAt: number
  accuracy: { positions: string; moment: string }
  /** Anything that could not be worked out, and why. Nothing is ever guessed in its place. */
  omitted: { field: string; why: string }[]
}
