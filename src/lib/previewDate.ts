/* ============================================================
   DATE PREVIEW (the preview site only)
   Open the preview with ?as-of=2026-11-12T15:00 (UTC) to see the site as it
   will look on that date, e.g. the daily prizes before they start. The whole
   page's clock is shifted, and wallet transactions are blocked while it is.
   Anywhere else, cozmc.us included, the parameter is ignored.
   Imported first in main.tsx, so the clock is shifted before anything reads it.
   ============================================================ */
const PREVIEW_HOSTS = ['cozmc-preview.netlify.app', 'localhost', '127.0.0.1']
/** Is this the preview site (or a local build), where testing tools may appear? */
export const onPreviewSite = () => typeof location !== 'undefined' && PREVIEW_HOSTS.includes(location.hostname)

export const previewAsOf: number | null = (() => {
  if (typeof location === 'undefined' || !PREVIEW_HOSTS.includes(location.hostname)) return null
  const q = new URLSearchParams(location.search).get('as-of')
  if (!q) return null
  const t = Date.parse(/T\d\d:\d\d(:\d\d)?$/.test(q) ? `${q}Z` : q)     // a time without a zone means UTC
  return Number.isFinite(t) ? t : null
})()

if (previewAsOf != null) {
  const Real = Date, offset = previewAsOf - Real.now()
  class Shifted extends Real {
    constructor(...a: unknown[]) { super(...((a.length ? a : [Real.now() + offset]) as [number])) }
    static now() { return Real.now() + offset }
  }
  ;(globalThis as { Date: DateConstructor }).Date = Shifted as DateConstructor
}

export const previewLabel = () => previewAsOf == null ? '' : new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
