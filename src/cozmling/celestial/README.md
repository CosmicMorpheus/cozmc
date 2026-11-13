# The Celestial Life Engine

Every Cozmling begins beneath a sky of its own. This folder works that sky out from real astronomy, saves it for good, and turns it into symbolic words. Who the Cozmling becomes is still decided by the life it shares with its player.

Astrology here is a storytelling framework. Nothing in it is presented as a prediction or as a fixed trait.

It is part of the rebuilt Cozmling (`src/cozmling/`), so it sits behind the same build switch, `VITE_COZMLING_V2=1`. With the switch off, none of it is in the site.

## What is built (MVP 1: Celestial Birth)

- **A real birth chart** for every new Cozmling, read the moment its egg hatches:
  - where the Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto were, and which way each was moving (retrograde, stationary);
  - the Rising sign (Ascendant), the Midheaven, and whole-sign houses;
  - the aspects between them, ranked, and larger patterns (stellium, grand trine, T-square, grand cross);
  - the Moon's phase.
- **Saved for good.** The chart is stored with the companion and the store refuses to change it afterwards.
- **Shown** as Sun, Moon and Rising in the Star Loft's Starprint panel, and in full in the observatory at `#/cozmling/sky`. The observatory has the zodiac wheel, a table of every placement, the aspects, the patterns, the Moon's phase, what each might mean, and how the chart was worked out.

## When and where a Cozmling is born

These are the two rules chosen by the site owner.

- **When.** On the birthday its player chose, at the time of day its egg hatched. Both are read on the observatory's clock, to the second. The player still chooses the sign and look. The hatch minute sets the Moon, the Rising sign and the rest of the chart, so two Cozmlings with the same birthday get different skies.
- **Where.** The Origin Observatory: a fictional place standing on a real spot, the summit of Mauna Kea in Hawaii (19.8207° N, 155.4681° W, `Pacific/Honolulu`). Hawaii keeps one clock all year, so daylight saving never moves a birth. The place is in `observatory.ts`, and every chart records which version of it was used.
- **Cusp birthdays.** On a day when the Sun changes sign, the adoption steps say so, and the hatch minute decides which of the two signs it is. The look chosen (A or B) carries over to that sign. The Starprint is provisional until hatch, then made final from the Sun's real sign.

## How it fits together

| File | What it does | Needs the astronomy library |
|---|---|---|
| `types.ts` | The `CelestialBirthRecord` and its parts | no |
| `observatory.ts` | The Origin Observatory, the birth-moment rule, wall clocks and time zones (through the browser's own `Intl`) | no |
| `ephemeris.ts` | `CelestialEphemerisProvider`: where each body is, its speed, sidereal time, obliquity, Moon phase | **yes** |
| `chart.ts` | `castChart()` and the moments a sky is read: `hatchWithSky()`, `readSkyLate()`, `readLegacySky()`, cusp detection | **yes** |
| `aspects.ts` | Aspects (with a table of orbs) and patterns | no |
| `interpret.ts` | The words: what a placement, aspect, pattern or Moon phase might mean. Reads charts, never changes them | no |
| `validate.ts` | Checks a saved chart before it is believed | no |
| `options.ts`, `useSky.ts` | Small helpers for the screens | no |
| `engine.ts`, `load.ts` | The one doorway to the library, loaded on first use | `engine.ts` only |
| `ui/` | The observatory page and the wheel | no |

The astronomy library is loaded only when a sky is being read: when a birthday is chosen and when an egg hatches. A saved chart is shown without it. If it can't load (offline, say), the egg still hatches; its sky is read from its record (birthday and hatch time) the next time the Cozmling is opened.

Astronomy and story are separate. `ephemeris.ts` and `chart.ts` produce numbers; `interpret.ts` writes from them. Rewording a story can never change a chart.

## The calculation

- **Library: Astronomy Engine 2.1.19.** MIT licence, no dependencies of its own, accurate to about one arcminute. It is pinned exactly in `package.json`, and a test fails if the installed version and `LIBRARY.version` ever differ.
- **Swiss Ephemeris was not used.** Its AGPL licence would apply to the whole site unless a commercial licence were bought.
- **Positions.** Geocentric and apparent (light-time and aberration included), on the true ecliptic and equinox of the date. That is the tropical zodiac of Western astrology.
- **Rising sign and Midheaven.** Worked out from Greenwich apparent sidereal time, the observatory's longitude and latitude, and the true obliquity (`anglesFrom()` in `chart.ts`).
- **Houses.** Whole-sign: each house is one whole sign, counted from the Rising sign's. Simple, and defined at any latitude.
- **Retrograde.** A body whose longitude is falling. Its speed is measured over half a day, centred on the moment. A planet barely moving counts as stationary.
- **Aspects.** Conjunction, sextile, square, trine and opposition, with orbs from `NATAL_ORBS` (wider for the Sun and Moon, tighter for the angles). They are ranked by closeness and by how personal the two points are.
- **Nothing random, nothing filled in.** The same moment and place always give the same chart. Anything that can't be known goes in `omitted`, with the reason.

## The saved record

`CelestialBirthRecord` (`types.ts`) is stored as `celestial` on the companion, in the same IndexedDB record as everything else. Key fields:

- `kind`: `birth`, or `awakening` (see below).
- `rule`: how the moment was chosen.
- `moment`: UTC, the chosen birthday, the hatch time, the observatory's wall clock, and the player's own time zone for showing times.
- `birthplace`, plus `engine` and library versions.
- `zodiac` and `houseSystem`.
- `bodies`, `angles`, `houses`, `moonPhase`, `aspects`, `patterns`.
- `calculatedAt`, `accuracy` and `omitted`.

A record is about 4.5 KB.

How it stays permanent:

- **In the store.** `companionStore.update()` keeps the first saved `celestial`, whatever a later change says. A Cozmling can only hatch once, so its sky is only ever read once.
- **On import.** Taking a newer copy from a save file keeps the birth sky already here.
- **On load.** A chart that fails `validate.ts` makes the record unreadable. It is set aside, never repaired.

## First-version Cozmlings

They keep everything they had, and nothing is read for them unless their player asks. The ask is in the "About" panel in the Star Loft.

- **Hatch moment recorded:** its real birth sky, read for that moment (`rule: 'hatch-moment'`).
- **Hatch moment never recorded** (brought back from a wallet note): its birth sky can't be known, so none is invented. Its player can give it an **awakening sky**, the sky at that moment. It is always labelled as an awakening, never as its birth.
- **Still an egg:** nothing yet.

The first version's own saves (`cozmc-cozmling-v1…`) are never touched by any of this.

## Tests

- **`npm test` → `tests/celestial.test.ts`.**
  - Published reference data:
    - USNO equinoxes and solstices;
    - the eclipse new moon of 2024-04-08 and full moon of 2025-03-14;
    - the IAU sidereal time at J2000;
    - published retrograde periods and sign changes;
    - Raphael's Table of Houses for London.
  - The Rising sign checked against the real eastern horizon at the observatory.
  - Determinism and pinned regression values.
  - The birth rule, and time zones across daylight saving and midnight.
  - Cusp days, aspects and patterns.
  - Saved for good (store, wardrobe, second hatch, import).
  - Damaged records caught.
  - First-version Cozmlings and awakenings.
  - Wording that never states certainties.
- **`tests/celestial-sky.mjs`**, in a real browser:
  - hatch → sky → reload;
  - the observatory at 360 px and on a desktop, by tap and by keyboard;
  - reduced motion;
  - a cusp birthday;
  - first-version Cozmlings;
  - the astronomy failing to load;
  - a pre-sky Cozmling opened straight at the observatory.

  To run it:

  ```
  VITE_COZMLING_V2=1 VITE_COZMLING_DEV=1 npm run dev -- --port 5198
  SITE=http://localhost:5198 node tests/celestial-sky.mjs
  ```

## Deploying

Nothing new is needed: there is no server, no key and no network call. The engine runs in the player's browser, and the chart is saved with the companion. It ships with the rebuilt Cozmling, when `VITE_COZMLING_V2=1` is set for a build.

## Known limitations

- **No Today's Sky or daily story yet.** Those are MVP 2 and 3.
- **No arcade or journal links yet.** That is MVP 4.
- **Placidus houses are not offered.** Whole-sign only for now. Another house system would be a new `houseSystem` value, and saved charts would keep theirs.
- **One birthplace.** Choosing another would need a new observatory entry; saved charts keep the one they were read at.
- **The device clock is trusted.** A hatch minute read from a wrong device clock gives a chart for that minute.
- **A few Cozmlings disagree with their chart.** Adventurers made on the preview before skies existed keep their calendar-based Starprint. If their real Sun sign differs, which is rare, the observatory says so.
- **Wording is a first draft.** `interpret.ts` is original COZMC writing, kept short. It is meant to be edited.

## What comes next

These follow the brief's own order.

1. **MVP 2, Living Sky.** Today's sky from the same provider, transits to each chart (with `aspectBetween()` and a tighter table of orbs), a daily report once per local day (`localDay()` in `observatory.ts`), cached, with a last-updated time.
2. **MVP 3, Living Story.** A `CozmlingDailyStoryEngine` with original templates, using the strongest transit and the Cozmling's real Food, Fun, Energy, mood and recent care. It is stored once per day under a fixed event id, so a refresh never makes a second one.
3. **MVP 4, Shared Journey.** Arcade, care and milestones in a Star Journal.
4. **MVP 5.** "Then × now" overlays, and a slot for a licensed horoscope feed through a `DailyAstrologySource`. Nothing is copied or scraped.

Rewards tied to the sky stay switched off until they are reviewed. Nothing here ever changes prizes, scores, tickets or token amounts.

## Future NFT opportunities

None are built, and none should depend on this. A birth chart is a small, deterministic, versioned record, so it could one day be shown or proved alongside a collectible without changing how daily play works. That is a separate review.
