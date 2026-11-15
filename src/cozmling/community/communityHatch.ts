export const COMMUNITY_HATCH_PATH = '/api/community-hatch'
export const COMMUNITY_HATCH_LANTERN = 'community-hatch-lantern'
export const communityHatchEnabled = import.meta.env?.VITE_COZMC_COMMUNITY_HATCH === '1'

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
  if (status.receipt === null) return true
  if (!status.receipt || typeof status.receipt !== 'object') return false
  const receipt = status.receipt as Record<string, unknown>
  return typeof receipt.companionId === 'string'
    && /^hatch-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt.companionId)
    && typeof receipt.lookId === 'string'
    && Object.hasOwn(COMMUNITY_HATCH_LOOKS, receipt.lookId)
}
