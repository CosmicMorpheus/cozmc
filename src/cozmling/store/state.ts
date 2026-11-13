/* What the pages see of the Cozmling store. Kept in its own small file so the part of the site
   every page loads can know the shape without loading the store itself. */
import type { Companion } from '../types'
import type { SyncReport } from './migrations'

export interface CozState {
  /** 'failed' = the store could not be opened at all (the page says so and offers to try again). */
  status: 'loading' | 'ready' | 'failed'
  /** true = saved on this device; false = this browser won't store anything, so it lasts for the visit only. */
  durable: boolean | null
  /** Has the browser agreed to keep this site's storage? false = it may clear it when space runs low. null = not known. */
  persisted: boolean | null
  /** When the last change was written successfully (never set by a write that failed). */
  savedAt: number | null
  /** The last write that did not go through, until one does. */
  saveProblem: string | null
  companions: Companion[]
  selectedId: string | null
  /** v1 saves that could not be read. They are kept as they are, never repaired or deleted. */
  quarantined: { sourceKey: string; reason: string }[]
  /** Records in the store that don't pass the v2 checks. Kept, not shown as companions. */
  unreadable: { companionId: string; reason: string }[]
  /** What the last look at the v1 saves did. */
  lastSync: SyncReport | null
}

export const INITIAL: CozState = { status: 'loading', durable: null, persisted: null, savedAt: null, saveProblem: null, companions: [], selectedId: null, quarantined: [], unreadable: [], lastSync: null }
