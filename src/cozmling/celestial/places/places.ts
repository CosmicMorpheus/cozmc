/* The places a Cozmling can be born in: about 7,300 cities and towns with their coordinates and time zones
   (Natural Earth, public domain; see build-places.mjs). Loaded only when a player chooses a place or asks for a
   surprise, and searched here in the browser: what a player types never leaves this browser. */
import { zoneSupported } from '../birthplace'
import type { Birthplace } from '../types'

export interface Place {
  name: string
  region: string
  country: string
  latitude: number
  longitude: number
  timeZone: string
  /** thousands */
  population: number
  /** "Paris, France" (with its region when the country has two of the same name) */
  label: string
  /** a stable id for the place in this list's version */
  id: string
}
export interface PlaceBook {
  source: string
  version: number
  places: Place[]
  /** Places matching what was typed, best first: every word must start a word of the place, its region or its country. */
  search(query: string, limit?: number): Place[]
  /** A place from the curated list for "Surprise me", not `notId`. */
  surprise(notId?: string, random?: () => number): Place
  /** The largest place in each time zone with 100,000 people or more: a spread around the whole globe. */
  surprises: Place[]
}

/** Lower case, accents off, punctuation to spaces: "Reykjavík" and "reykjavik" match. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const slug = (s: string) => fold(s).replace(/ /g, '-')
/** Other names people type for a few countries. */
const ALIASES: Record<string, string> = { 'United States of America': 'usa us america', 'United Kingdom': 'uk britain great britain england', 'Russia': 'russian federation', 'Netherlands': 'holland', 'South Korea': 'korea', 'Czech Republic': 'czechia' }

interface Raw { source: string; version: number; countries: string[]; zones: string[]; rows: [string, string, number, number, number, number, number][] }

export function placeBook(raw: Raw): PlaceBook {
  const seen = new Map<string, number>()
  for (const r of raw.rows) { const k = `${r[0]}|${r[2]}`; seen.set(k, (seen.get(k) ?? 0) + 1) }
  const places: Place[] = []
  const keys: { words: string[]; name: string }[] = []
  for (const [name, region, ci, latitude, longitude, zi, population] of raw.rows) {
    const country = raw.countries[ci], timeZone = raw.zones[zi]
    if (!zoneSupported(timeZone)) continue                       // this browser can't read its clock: not offered
    const twin = (seen.get(`${name}|${ci}`) ?? 0) > 1
    places.push({ name, region, country, latitude, longitude, timeZone, population, label: twin && region ? `${name}, ${region}, ${country}` : `${name}, ${country}`, id: `${slug(country)}/${slug(name)}/${latitude},${longitude}` })
    keys.push({ words: `${fold(name)} ${fold(region)} ${fold(country)} ${ALIASES[country] ?? ''}`.split(' ').filter(Boolean), name: fold(name) })
  }
  const byZone = new Map<string, Place>()
  for (const p of places) if (p.population >= 100 && (!byZone.has(p.timeZone) || byZone.get(p.timeZone)!.population < p.population)) byZone.set(p.timeZone, p)
  const surprises = [...byZone.values()].sort((a, b) => a.longitude - b.longitude)

  return {
    source: raw.source, version: raw.version, places, surprises,
    search(query, limit = 8) {
      const q = fold(query)
      if (q.length < 2) return []
      const words = q.split(' ')
      const out: { p: Place; rank: number }[] = []
      places.forEach((p, i) => {
        const k = keys[i]
        if (!words.every(w => k.words.some(x => x.startsWith(w)))) return
        out.push({ p, rank: k.name === q ? 0 : k.name.startsWith(q) ? 1 : k.name.startsWith(words[0]) ? 2 : 3 })
      })
      return out.sort((a, b) => a.rank - b.rank || b.p.population - a.p.population).slice(0, limit).map(x => x.p)
    },
    surprise(notId, random = Math.random) {
      const pool = surprises.filter(p => p.id !== notId)
      return pool[Math.floor(random() * pool.length)] ?? surprises[0]
    },
  }
}

/** The place, as a Cozmling's birthplace. */
export function toBirthplace(p: Place, choice: 'chosen' | 'surprise', book: Pick<PlaceBook, 'source' | 'version'>): Birthplace {
  return { id: `place:${p.id}`, version: book.version, name: p.name, place: p.label, latitude: p.latitude, longitude: p.longitude, elevationM: null, timeZone: p.timeZone, fictional: false, choice, source: book.source }
}

let loading: Promise<PlaceBook> | null = null
/** The place book, loaded once (its own small file, fetched on first use). */
export function loadPlaces(): Promise<PlaceBook> {
  loading ??= import('./cities.json').then(m => placeBook(m.default as unknown as Raw)).catch(e => { loading = null; throw e })
  return loading
}
