/* Builds cities.json, the places a Cozmling can be born in. Not part of the site: run it by hand when the list
   needs remaking.

     npm pack city-timezones@1.3.4 && tar -xzf city-timezones-1.3.4.tgz
     node src/cozmling/celestial/places/build-places.mjs package/data/cityMap.json

   The data: Natural Earth "populated places" (public domain, naturalearthdata.com), as packaged with time zones by
   the city-timezones package (MIT). Only places that can be used exactly are kept:
   - a time zone the IANA database knows (checked with this Node's Intl);
   - coordinates on the globe, rounded to 4 decimals (about 11 m: far finer than a city);
   - the time zone's standard offset within 4 hours of the place's solar time (catches a swapped sign or a wrong zone);
   - one entry per name, region and country (the largest). */
import { readFileSync, writeFileSync } from 'node:fs'

const src = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const zoneOk = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true } catch { return false } }
const offsetH = (tz, iso) => {
  const t = Date.parse(iso)
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(t)).map(x => [x.type, Number(x.value)]))
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - t) / 3_600_000
}
const r4 = x => Math.round(x * 1e4) / 1e4

const best = new Map(), dropped = []
for (const c of src) {
  const name = String(c.city ?? '').trim(), tz = c.timezone
  if (!name || !tz || !zoneOk(tz) || !(Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180)) { dropped.push(name || '(no name)'); continue }
  const std = Math.min(offsetH(tz, '2026-01-15T12:00:00Z'), offsetH(tz, '2026-07-15T12:00:00Z'))
  if (Math.abs((((std - c.lng / 15) % 24) + 36) % 24 - 12) > 4) { dropped.push(name); continue }
  const key = `${name}|${c.province ?? ''}|${c.country}`
  if (!best.has(key) || (best.get(key).pop ?? 0) < (c.pop ?? 0)) best.set(key, c)
}
const places = [...best.values()].sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0))
const countries = [...new Set(places.map(c => c.country))].sort()
const zones = [...new Set(places.map(c => c.timezone))].sort()
const rows = places.map(c => [c.city.trim(), (c.province ?? '').trim(), countries.indexOf(c.country), r4(c.lat), r4(c.lng), zones.indexOf(c.timezone), Math.round((c.pop ?? 0) / 1000)])
writeFileSync(new URL('./cities.json', import.meta.url), JSON.stringify({
  source: 'Natural Earth populated places (public domain), via city-timezones 1.3.4 (MIT)',
  version: 1,
  checkedWith: `IANA time zone data ${process.versions.tz}`,
  columns: ['name', 'region', 'country', 'latitude', 'longitude', 'timeZone', 'population (thousands)'],
  countries, zones, rows,
}))
console.log(`${rows.length} places kept, ${dropped.length} left out; ${countries.length} countries, ${zones.length} time zones`)
