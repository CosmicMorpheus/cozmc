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

## What is built (MVP 2: Living Sky)

- **Today's sky**, at `#/cozmling/sky/today` (the observatory's second tab):
  - where the planets are now, drawn in the Cozmling's own houses, with today's planets' aspects to each other;
  - a table of today's positions, with the house of its own sky each is passing through, and retrograde marks;
  - the sky's own news for the day: the Moon (sign, phase, how much is lit, which of its houses), and any planet changing sign or turning retrograde or direct, with the time;
  - **today for this Cozmling:** the transits, today's planets against its birth sky, ranked, with the moment each is exact if that falls during the day. Picking one draws it on the wheel: the point of its own sky, with a line from today's planet.
- **Read once a day, without anyone asking.** The Star Loft's Starprint panel has a line for today, with the day's strongest transit, linking to the view. Opening the Cozmling page reads the day's report if it isn't saved yet.
- **Live, and honest about it.** While the view is open, the planets are worked out again every 10 minutes. The page shows the time they were worked out, and stops saying "Live" if that time gets old.

## What is built (MVP 3: Living Story)

- **A daily story for every Cozmling**, on its own page in the Star Loft, under the care buttons:
  - a title and the day's theme in three words;
  - the celestial influence: today's strongest transit to its birth chart, and what it might mean;
  - a short original story;
  - today's cosmic invitation;
  - a COZMC reflection.
- **Written from the real day.** It draws on today's sky against its birth chart, its home, its life stage and its character. It also uses its happiness (Fun), sustenance (Food) and energy, whether it is asleep, how long since you last looked after it, what you have done together since its last story, its birthday and how close it is to its next stage.
- **Written once a day, without anyone asking**, when its page is first opened that day (or at the player's midnight with the page open). It is kept, so a refresh or a second tab never changes it, and it joins its Memories.
- **No paid feed and no AI service.** The words are original COZMC templates. A slot is ready for a licensed feed later.

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
| `version.ts` | Which engine and library work charts and reports out | no |
| `transits.ts` | `skyAt()` (where everything is at a moment) and `readDaily()` (a Cozmling's report for one day) | **yes** |
| `daily.ts` | The report's shape, the day's orbs and ranking, where a day starts and ends, and whether a saved report is still today's | no |
| `useLiveSky.ts` | Keeps today's sky current on a page: saved report first, then the astronomy; every 10 minutes; at midnight | no |
| `../story/` | The daily story: `source.ts` (`DailyAstrologySource`), `context.ts` (what a story draws on), `themes.ts` (the words), `engine.ts` (`CozmlingDailyStoryEngine`), `useDailyStory.ts` (written once a day, kept), `StoryPanel.tsx` | no |
| `engine.ts`, `load.ts` | The one doorway to the library, loaded on first use | `engine.ts` only |
| `ui/` | The observatory page (`ObservatoryScreen.tsx`, with the birth sky), today's sky (`TodaySky.tsx`) and the wheel | no |

The astronomy library is loaded only when a sky is being read: when a birthday is chosen, when an egg hatches, when today's report isn't saved yet, and while today's sky is open. A saved chart, or today's saved report, is shown without it. If it can't load (offline, say), the egg still hatches; its sky is read from its record (birthday and hatch time) the next time the Cozmling is opened.

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

## Today's sky: how it works

- **The same astronomy as a birth chart.** `skyAt()` uses the same provider, positions and zodiac, so today's planets and a birth chart can be compared directly (a test checks they agree exactly).
- **One report per day, on the player's own clock.** A day is a calendar day in the player's time zone, as the browser reports it. The report is read for **midday** that day, so it is one fixed thing from midnight to midnight. A new day begins at the player's midnight. A new time zone (travel) makes a new day's report for that zone.
- **What a report holds** (`DailyCelestialReport` in `daily.ts`): the day, time zone and midday moment; the birth chart it was compared with; the engine and library versions; every planet at midday, with the Cozmling's house it is passing through; the Moon's phase; planets changing sign during the day (to the second) and turning retrograde or direct (to the minute); and the transits.
- **Transits.** Each of today's planets against each point of the birth sky (the ten planets, the Rising sign and the Midheaven), with tighter orbs than a birth chart (`TRANSIT_ORBS`): 3° (2° for a sextile), 1° more with the Sun or Moon, and at most 2° to the Rising sign or Midheaven. They are ranked for a day's story (`dailyScore()`): how close, how fast today's planet moves (so the Moon's and Sun's aspects, which change by the day, come before Saturn's or Pluto's, which last months), how personal the point is, and a little extra if still tightening. For the top eight, the moment it is exact is found, if it falls inside the day.
- **Nothing random.** The same chart, day and time zone always give the same report. Two Cozmlings see the same sky on the same day, but meet it differently.
- **Saved, and only used while it's true.** A report is saved on the device (IndexedDB meta, under `daily:<companionId>`). It is used again only for the same Cozmling, birth chart, day, time zone, engine and library version (`reportIsCurrent()`); otherwise a new one is read. It is not part of the companion, is never exported, and can always be worked out again.
- **Offline.** The astronomy runs on the device, so the view works offline once the site's files are cached. If the astronomy can't load at all, today's saved report still shows, marked as offline, at its midday positions. A report from an earlier day is shown only when today's can't be read, labelled with its own day and told in the past ("On Thursday, November 12, Mercury opened a door to…"); it is never passed off as today's.
- **What it costs.** About 8 ms to read a day's report and well under a millisecond to work out the sky now (measured in Node on the build machine; a phone is slower, but still quick). A saved report is about 4.5 KB. The Star Loft loads the astronomy only when today's report isn't saved yet: once a day at most.
- **What it never does.** It doesn't change a Cozmling's needs, rewards, scores, tickets or token amounts. Today's words are symbols to play with ("A theme to play with, if it feels right. It doesn't decide anything."), never forecasts.

## The daily story: how it works

- **Where the theme comes from** (`story/source.ts`, `DailyAstrologySource`). Sources are asked in turn: a COZMC editorial theme for a date (a table, empty for now), then a slot reserved for a licensed feed (off; nothing is fetched, copied or scraped from anyone without a licence), then the first-party reading, which always answers. A source that fails is skipped, so a story is always written.
- **The first-party reading.** The day's strongest transit gives the day its kind, from the point of the Cozmling's own sky it touches: its Venus or Rising sign means connection, its Sun play, its Moon comfort, its Mercury curiosity, its Mars courage, Jupiter or its Midheaven growth, Saturn reflection, Uranus creativity, Neptune dreams and Pluto change. The aspect's feel (flowing, tense, blended) colours the words. On a day with no close transit, the day is open.
- **The story** (`story/engine.ts`, `CozmlingDailyStoryEngine`) is built from templates (`story/themes.ts`, original COZMC writing). It has four short paragraphs:
  1. Where it is and what it seems drawn to, in its own home: "Orbi the Sprout wakes beneath a waxing crescent Moon in the Cosmic Grove…" A sleeping Cozmling dreams it instead.
  2. The day's feel and something of its character, from its Starprint archetype or its Sun or Moon.
  3. Its happiness and sustenance, as numbers, and what it needs, by the same rules as its care meters.
  4. You and it, and a closing line: days away, what you have shared since its last story, its birthday, a stage that is close.
- **Everything in it is a tendency**, never a rule ("it seems", "as if", "perhaps"). It never says what will happen, and a test checks every story for "will", "always", "never" and "destined".
- **The invitation** is what it needs most (a meal, a game, rest), or something in keeping with the day: a pat, a game, looking at today's sky together, or an arcade game for a first-version Cozmling. It shows "Done" once it has been taken up, judged from what happened (the care counters, its energy, a visit to today's sky). Nothing is rewarded: an invitation never changes needs, rewards, scores, tickets or tokens.
- **Kept once a day.** Each story is one event, `story:<companionId>:<day>`. The store keeps an event id only once, in any tab, so the same day never gets two stories. It records the moment it was written (its numbers and counters then), its source, the transit it is built on, and the engine version.
- **The same input, the same story.** Choices between lines come from the Cozmling's id and the day, so a story can be written again identically, and two Cozmlings under the same sky get their own.
- **Offline.** If today's sky can't be read, today's story is shown if it was already written. Otherwise the last story is shown, labelled with its own day, never as today's.

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
- **`npm test` → `tests/celestial-today.test.ts`.**
  - Today's sky agrees exactly with a birth chart worked out for the same moment.
  - A day's report is the same all day; a new day starts at the player's midnight, in their own time zone, through daylight saving (23- and 25-hour days).
  - Transit orbs and ranking; two Cozmlings meeting the same sky differently.
  - Exact times really are exact (checked back against the astronomy), and inside the day.
  - Sign changes caught to the second; every turn of Mercury in 2026 caught on its day.
  - A saved report is reused only for the same day, time zone, chart and engine; a damaged one is never used.
  - The words: about this Cozmling, in the player's clock, never a forecast; the Moon told where it is now; an earlier day told in the past.
  - A report takes well under 60 ms.
- **`npm test` → `tests/cozmling-story.test.ts`.**
  - Every part of a story, built on the day's strongest transit, with its real numbers and life stage.
  - The same input gives the same story; two Cozmlings under one sky get their own.
  - Happiness, sustenance and energy change the story and its invitation; asleep, it dreams.
  - Days away, what you shared since its last story, hatching day, birthday and a close stage.
  - A new story at the player's midnight; the store keeps a day's story only once.
  - Invitations are seen to be taken up from what happens, with no reward.
  - Sources: an editorial theme for a date, the licensed slot off, a failing source skipped.
  - 126 stories (21 days, three states, two Cozmlings) checked for forecasting words and template slips.
- **`tests/celestial-sky.mjs`**, in a real browser:
  - hatch → sky → reload;
  - the observatory at 360 px and on a desktop, by tap and by keyboard;
  - reduced motion;
  - a cusp birthday;
  - first-version Cozmlings;
  - the astronomy failing to load;
  - a pre-sky Cozmling opened straight at the observatory;
  - today's sky: the Star Loft reads it by itself and links to it; the day's reading is the one saved, not read again; transits and the wheel; the same vortex carries on between the two tabs; the Star Loft loads no astronomy once today's reading is saved;
  - offline: today's saved reading still shows, marked; an earlier day's only with its day; back online, today's is read;
  - a new day at the player's own midnight, with an open page (a fake clock, in New York);
  - today's sky on a 360 px phone, in reading order;
  - today's story: on its page, the same after a reload, kept once, its invitation taken up, in its Memories;
  - a new story at the player's midnight (a fake clock);
  - the story offline: the last one with its own day; back online, today's is written.

  To run it:

  ```
  VITE_COZMLING_V2=1 VITE_COZMLING_DEV=1 npm run dev -- --port 5198
  SITE=http://localhost:5198 node tests/celestial-sky.mjs
  ```

## Deploying

Nothing new is needed: there is no server, no key and no network call. The engine runs in the player's browser, and the chart is saved with the companion. It ships with the rebuilt Cozmling, when `VITE_COZMLING_V2=1` is set for a build.

## The Cosmic Vortex (the observatory's living sky)

Behind the observatory, a black sphere sits exactly behind the zodiac wheel, so the chart reads as the face of the sphere. Around it:

- **The disk:** a tilted disk of golden dust, drawn as thin contour lines like agate or a fingerprint. It flows round (inner rings faster), drifts inward and slowly changes shape. It is gold near the sphere and cools through amber and crimson to electric blue at its edge.
- **The sky:** thousands of small stars, a few brighter ones that twinkle, and midnight clouds whose edges glow crimson.
- **Movement:** faint streaks of light stream outward from the sphere, gold specks orbit it, its glow breathes, and the clouds drift almost too slowly to notice.

The references (Mark's videos and stills) were used for direction only; it is drawn from scratch in code.

- **Where:** `src/cozmling/render/cosmicVortex.ts` is the renderer: plain canvas, no library. `src/cozmling/components/CosmicVortex.tsx` puts it behind a page. The observatory uses it with the wheel as its anchor.
- **How it stays light:**
  - **Drawn once:** the stars and clouds, at each new screen width. The clouds are contour lines traced from a noise field.
  - **Drawn every frame:** the rest, in a few milliseconds.
  - **Pixel budget:** at most about 2.6 million pixels (a phone draws at up to 1.5× its CSS size, a large screen at about 1×).
  - **Frame rate:** 30 frames a second on a computer, 24 on a phone, 12 once the sphere has scrolled off screen.
  - **Stopping:** it stops completely when the tab is hidden or the chart has scrolled away.
  - **One still frame:** for anyone who asks for reduced motion, or on a device saving data or very short of memory.
  - **If no canvas can be drawn:** a still CSS gradient sky shows instead.
- **It never gets in the way.** It sits under the page, takes no clicks and is hidden from screen readers. Text sits on near-opaque panels, and the header has its own shade.
- **Ready for later, not built yet:** its `palette` and `seed` could give each Cozmling, sign or element a sky of its own. Constellations from a chart and events for milestones would be added there too. Every observatory uses the same sky for now.
- **Tests:**
  - `tests/cosmic-vortex.test.ts`: the loops never jump, the pixel budget holds, the disk's shape, a repeatable sky, and no new library.
  - `tests/celestial-sky.mjs`: it sits behind the wheel and follows it, the wheel still takes clicks, the disk really is gold, it stops when away and when hidden, it is still under reduced motion, and a 360 px phone stays readable.

## Known limitations

- **Arcade invitations are only for first-version Cozmlings for now.** Arcade runs don't count for an adventurer until the arcade is connected to the rebuilt page (step 3 of the rebuild).
- **A story is written when the page is first opened that day.** Its numbers are from that moment, as a diary's would be, and care later that day is shown by the invitation, not by rewriting the story.
- **The words are a first draft**, in `story/themes.ts`, and meant to be edited. Changing them doesn't change stories already kept.
- **No "then × now" overlay yet.** Today's wheel shows today's planets in the Cozmling's houses, and one picked transit at a time. Both whole skies on one wheel is MVP 5.
- **A day follows the device.** Its clock and time zone are trusted. Changing time zone mid-day starts a new day's report for the new zone.
- **Each device reads its own report.** There is no server, so two devices work the same report out separately. They agree, because nothing is random.
- **No arcade or journal links yet.** That is MVP 4.
- **Placidus houses are not offered.** Whole-sign only for now. Another house system would be a new `houseSystem` value, and saved charts would keep theirs.
- **One birthplace.** Choosing another would need a new observatory entry; saved charts keep the one they were read at.
- **The device clock is trusted.** A hatch minute read from a wrong device clock gives a chart for that minute.
- **A few Cozmlings disagree with their chart.** Adventurers made on the preview before skies existed keep their calendar-based Starprint. If their real Sun sign differs, which is rare, the observatory says so.
- **Wording is a first draft.** `interpret.ts` is original COZMC writing, kept short. It is meant to be edited.

## What comes next

These follow the brief's own order.

1. ~~**MVP 2, Living Sky.**~~ Built: see above.
2. ~~**MVP 3, Living Story.**~~ Built: see above.
3. **MVP 4, Shared Journey.** Arcade, care and milestones in a Star Journal.
4. **MVP 5.** "Then × now" overlays, and a slot for a licensed horoscope feed through a `DailyAstrologySource`. Nothing is copied or scraped.

Rewards tied to the sky stay switched off until they are reviewed. Nothing here ever changes prizes, scores, tickets or token amounts.

## Future NFT opportunities

None are built, and none should depend on this. A birth chart is a small, deterministic, versioned record, so it could one day be shown or proved alongside a collectible without changing how daily play works. That is a separate review.
