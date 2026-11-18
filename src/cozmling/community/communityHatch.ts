export const COMMUNITY_HATCH_PATH = '/api/community-hatch'
export const COMMUNITY_HATCH_LANTERN = 'community-hatch-lantern'

export const COMMUNITY_HATCH_LOOKS = {
  'grove-green': { look: 'a', skin: 'moss', label: 'Grove Green' },
  'grove-violet': { look: 'b', skin: 'lilac', label: 'Grove Violet' },
  'grove-cyan': { look: 'a', skin: 'sky', label: 'Grove Cyan' },
} as const

export type CommunityHatchLookId = keyof typeof COMMUNITY_HATCH_LOOKS
export const COMMUNITY_HATCH_LOOK_IDS = Object.keys(COMMUNITY_HATCH_LOOKS) as CommunityHatchLookId[]
export type CommunityHatchAction = 'contribute' | 'claim'
export type CommunityHatchPhase = 'upcoming' | 'open' | 'claim' | 'ended'

export type CommunityHatchReceipt = {
  companionId: string
  lookId: CommunityHatchLookId
}

export type CommunityHatchStatus = {
  eventId: string
  title: string
  opensAt: string
  endsAt: string
  claimUntil: string
  phase: CommunityHatchPhase
  total: number
  goal: number
  eligible: boolean
  contributedToday: boolean
  lanternEligible: boolean
  receipt: CommunityHatchReceipt | null
  authenticatedWallet: string | null
  /** When the event names its first lanterns: how many places, and the wallets in them so far, first first. */
  firstPlaces?: number
  firstLanterns?: string[]
}

export function isCommunityHatchStatus(value: unknown): value is CommunityHatchStatus {
  if (!value || typeof value !== 'object') return false
  const status = value as Record<string, unknown>
  if (typeof status.eventId !== 'string' || typeof status.title !== 'string') return false
  for (const key of ['opensAt', 'endsAt', 'claimUntil']) {
    if (typeof status[key] !== 'string' || !Number.isFinite(Date.parse(status[key]))) return false
  }
  if (!['upcoming', 'open', 'claim', 'ended'].some((phase) => phase === status.phase)) return false
  if (!Number.isSafeInteger(status.total) || Number(status.total) < 0) return false
  if (!Number.isSafeInteger(status.goal) || Number(status.goal) < 1) return false
  if (['eligible', 'contributedToday', 'lanternEligible'].some((key) => typeof status[key] !== 'boolean')) return false
  if (status.authenticatedWallet !== null
    && (typeof status.authenticatedWallet !== 'string' || !/^[A-Z2-7]{58}$/.test(status.authenticatedWallet))) return false
  if (status.authenticatedWallet === null && (status.eligible || status.contributedToday || status.lanternEligible || status.receipt !== null)) return false
  if (status.firstPlaces !== undefined || status.firstLanterns !== undefined) {
    if (!Number.isSafeInteger(status.firstPlaces) || Number(status.firstPlaces) < 1 || !Array.isArray(status.firstLanterns)) return false
    if (status.firstLanterns.length > Number(status.firstPlaces) || status.firstLanterns.some(w => typeof w !== 'string' || !/^[A-Z2-7]{58}$/.test(w))) return false
  }
  if (status.receipt === null) return true
  if (!status.receipt || typeof status.receipt !== 'object') return false
  const receipt = status.receipt as Record<string, unknown>
  return typeof receipt.companionId === 'string'
    && /^hatch-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt.companionId)
    && typeof receipt.lookId === 'string'
    && Object.hasOwn(COMMUNITY_HATCH_LOOKS, receipt.lookId)
}

/** The Grove's twelve zodiac lanterns, in zodiac order: Aries first, Pisces last. */
export const GROVE_SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const

/** How many of the twelve lanterns glow for the community's shared count: min(12, floor(12 x total / goal)).
    None at zero, all twelve once the goal is reached, and with a small goal one lantern lit by a player can
    light several signs. It depends on the shared count alone, so every visit shows the same signs for it. */
export function litSigns(total: number, goal: number): number {
  if (!Number.isSafeInteger(goal) || goal < 1 || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(GROVE_SIGNS.length, Math.floor((GROVE_SIGNS.length * total) / goal))
}
