import { ASA_DECIMALS } from '../config'

const UNIT = 10 ** ASA_DECIMALS

/** Base units (micro-COZMC) → whole tokens as a JS number (safe: total supply is 1e15 base units). */
export const toWhole = (base: number | bigint) => Number(base) / UNIT

/** "1,234.5" style user input → base units. Returns null if invalid. */
export function parseAmount(input: string): bigint | null {
  const s = input.replace(/[,_\s]/g, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const [whole, frac = ''] = s.split('.')
  if (frac.length > ASA_DECIMALS) return null
  return BigInt(whole) * BigInt(UNIT) + BigInt((frac + '0'.repeat(ASA_DECIMALS)).slice(0, ASA_DECIMALS))
}

export const fmt = (n: number, max = 0) => n.toLocaleString('en-US', { maximumFractionDigits: max })

/** Compact: 1.2K, 34.5M, 1B */
export function compact(n: number) {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(n % 1e9 ? 2 : 0)}B`
  if (n >= 1e6) return `${+(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`
  if (n >= 1e3) return `${+(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K`
  return fmt(n, n < 10 ? 2 : 0)
}

export const short = (a: string, n = 4) => (a ? `${a.slice(0, n)}…${a.slice(-n)}` : '')

export function ago(unixSeconds?: number) {
  if (!unixSeconds) return ''
  const s = Math.max(0, Date.now() / 1000 - unixSeconds)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return new Date(unixSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : 0)
