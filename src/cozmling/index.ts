/* ============================================================
   COZMLING v2 — the small part every page loads.

   The rebuilt Cozmling is behind a switch (flags.ts) that is OFF unless the site is built with
   VITE_COZMLING_V2=1. With it off, nothing here does anything and none of the rest of
   src/cozmling/ is loaded.

   With it on: one store is opened for the whole site (in the background, after the page is up),
   and the Cozmling page, the Home Spotlight and the Arcade Buddy all read that same store through
   useCozmling(). They are views of one companion, not three separate copies.
   ============================================================ */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { COZMLING_V2 } from './flags'
import { INITIAL, type CozState } from './store/state'
import type { CozStore } from './store/companionStore'

export { COZMLING_V2, COZMLING_DEV } from './flags'
export type { CozState } from './store/state'

let store: CozStore | null = null
let state: CozState = INITIAL
let opening: Promise<CozStore> | null = null
const subs = new Set<() => void>()
const tell = () => subs.forEach(f => f())

/** Open the shared store (once). Everything heavy is loaded here, not with the page. */
export function startCozmling(): Promise<CozStore> {
  return (opening ??= import('./core').then(async m => {
    const s = await m.open()
    store = s
    state = s.getState()
    s.subscribe(() => { state = s.getState(); tell() })
    tell()
    return s
  }).catch(e => {
    opening = null                      // the next call tries again
    state = { ...INITIAL, status: 'failed' }
    tell()
    throw e
  }))
}

/** What the store holds right now. While it is still opening, status is 'loading': a page must not
    show "adopt one" until it is 'ready' and there really is no companion. */
export function useCozmling(): CozState {
  return useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, () => state, () => state)
}
export const cozmlingStore = () => store

/** Wraps the app. Opens the store when v2 is switched on; otherwise it is just its children. */
export function CozmlingProvider({ children }: { children: ReactNode }) {
  useEffect(() => { if (COZMLING_V2) void startCozmling().catch(() => { /* the site works without it; the Cozmling page says so */ }) }, [])
  return children
}
