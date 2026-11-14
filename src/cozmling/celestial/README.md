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
  - a short original story, with one line in the Cozmling's own voice (its Starprint's);
  - today's cosmic invitation;
  - a COZMC reflection;
  - beside it, today's sky reading: the strongest transit to its birth chart, and one way it might read.
- **Chosen without the zodiac.** The story, its invitation and its reflection come from the day, its growth stage, its story so far and how it is doing: its home, its happiness (Fun), sustenance (Food) and energy, whether it is asleep, how long since you last looked after it, what you have done together since its last story, its birthday and how close it is to its next stage. Its sign and chart only change its voice line and its sky reading (since November 14, 2026; see "The zodiac writing review").
- **A first choice story, The Bridge After the Rain** (a draft, shown only on the preview site and in local work): three equally good first steps, six routes, four safe endings, and the same choices for every Cozmling.
- **Written once a day, without anyone asking**, when its page is first opened that day (or at the player's midnight with the page open). It is kept, so a refresh or a second tab never changes it, and it joins its Memories.
- **No paid feed and no AI service.** The words are original COZMC templates. A slot is ready for a licensed feed later.

## When and where a Cozmling is born

These are the two rules chosen by the site owner.

- **When.** On the birthday its player chose, at the time of day its egg hatched. Both are read on the observatory's clock, to the second. The player still chooses the sign and look. The hatch minute sets the Moon, the Rising sign and the rest of the chart, so two Cozmlings with the same birthday get different skies.
- **Where.** The player chooses, when adopting (the adoption step "Where was your Cozmling born?"):
  - **Use COZMC Default** (preselected and recommended): the Origin Observatory, a fictional place standing on a real spot, the summit of Mauna Kea in Hawaii (19.8207° N, 155.4681° W, `Pacific/Honolulu`). Hawaii keeps one clock all year, so daylight saving never moves a birth. No real place is needed. Every Cozmling made before birthplaces existed was born here, and still is.
  - **Choose a Place**: any of about 7,300 cities and towns, found by typing (searched in the browser, never sent anywhere). The preview shows the place, its coordinates, its time zone and its time now.
  - **Surprise Me!**: a place picked at random from a curated list (the largest place of 100,000 people or more in each time zone: 271 places around the globe), with "Another place" to try again.

  The place sets the clock the birth moment is read on and the coordinates the Rising sign and houses are read from. The planets' signs are the same everywhere at one moment. The birthplace is kept with the egg (`starprint.birthplace`) and with the chart (`celestial.birthplace`), and is never changed afterwards. Its id and version are recorded in `starprint.observatoryVersion`.
- **Cusp birthdays.** On a day when the Sun changes sign, the adoption steps say so, and the hatch minute decides which of the two signs it is. The look chosen (A or B) carries over to that sign. The Starprint is provisional until hatch, then made final from the Sun's real sign.

## How it fits together

| File | What it does | Needs the astronomy library |
|---|---|---|
| `types.ts` | The `CelestialBirthRecord` and its parts | no |
| `observatory.ts` | The Origin Observatory, the birth-moment rule, wall clocks and time zones (through the browser's own `Intl`) | no |
| `birthplace.ts` | A birthplace: how it is named, checked (`birthplaceProblem`) and whether this browser can read its clock | no |
| `places/` | The atlas: `cities.json` (built by `build-places.mjs`, not part of the site), `places.ts` (search, surprises), loaded only when a player chooses a place | no |
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
- **Swiss Ephemeris is not part of the site.** It was used privately, as a reference to check against (below). Its licence (`libswe/LICENSE`) is AGPL or a paid Swiss Ephemeris Professional License, chosen before any public service using it goes live. AGPL would mean putting the whole site under the AGPL. Either way, Astrodienst's name can't be used to promote the site.
- **Positions.** Geocentric and apparent (light-time and aberration included), on the true ecliptic and equinox of the date. That is the tropical zodiac of Western astrology.
- **Rising sign and Midheaven.** Worked out from Greenwich apparent sidereal time, the birthplace's longitude and latitude, and the true obliquity (`anglesFrom()` in `chart.ts`). Inside the polar circles the Ascendant is the point of the ecliptic rising in the east, as the Swiss Ephemeris has it (engine version 2; version 1 could give the western point there, which no saved Cozmling was affected by, since all were born at 19.8° N).
- **Houses.** Whole-sign: each house is one whole sign, counted from the Rising sign's. Simple, and defined at any latitude. astro.com draws Placidus houses by default, so its house cusps differ from ours: that is a different method, not an error.
- **Clocks.** A birthplace's wall clock is turned into a moment with the IANA time zone database, through the browser's `Intl`, to the second (local mean time before standard time, historic daylight saving included). A time skipped by the clocks going forward is read with the offset from before the change (it lands just after the gap); a time that happens twice is the first.
- **Retrograde.** A body whose longitude is falling. Its speed is measured over half a day, centred on the moment. A planet barely moving counts as stationary.
- **Aspects.** Conjunction, sextile, square, trine and opposition, with orbs from `NATAL_ORBS` (wider for the Sun and Moon, tighter for the angles). They are ranked by closeness and by how personal the two points are.
- **Nothing random, nothing filled in.** The same moment and place always give the same chart. Anything that can't be known goes in `omitted`, with the reason.

## Checked against the Swiss Ephemeris

The engine was compared with the Swiss Ephemeris 2.10.03 (the engine behind astro.com charts) and its own JPL DE431 ephemeris files, privately. astro.com itself can't be reached from where this was built, so its pages weren't compared directly. Only the resulting numbers are in the repository (`tests/fixtures/swiss-ephemeris-reference.json`), checked on every `npm test` by `tests/celestial-reference.test.ts`.

| What | Checked | Largest difference | Signs disagreeing |
|---|---|---|---|
| Sun | 603 moments, 1900–2100 | 6.5″ | 0 |
| Moon | 603 moments | 66″ (half the cases under 1.6″) | 0 |
| Mercury to Pluto | 603 moments each | 18.5″ | 0 |
| Retrograde | every body, every moment | none disagree | – |
| Ascendant | 7,236 checks at 12 places, equator to 69.6° N | 19.2″ | 0 |
| Midheaven | the same | 2.2″ | 0 |

An arcminute (60″) is about a 30th of the Moon's width. A sign is 30°. The tests allow a little more than the largest difference found.

Clocks were compared with Python's `zoneinfo` (the same IANA database) at 2,714 wall-clock times in 25 time zones, 1900–2035, around every clock change: all agree. Nine more were left out because the two databases are different releases and a few zones' history was corrected in between.

**What the Swiss Ephemeris would add**, if it were ever licensed: Placidus and other house systems, the lunar nodes, Chiron and asteroids, and accuracy below an arcsecond. None of these are needed for whole-sign charts, so Astronomy Engine (MIT) stays.

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

## Birthplaces and privacy

- **No location is ever read.** The site never asks for, or uses, where the player is (no GPS, no geolocation, no IP lookup). A test fails if any of it appears in the code.
- **Only what is chosen is kept**: the place's name, coordinates, time zone, how it was chosen and the atlas it came from. Not what was typed, and nothing about the player.
- **Kept in this browser only**, with the Cozmling, and shown only on its own pages. It is never sent anywhere.
- **Every option works for a guest**, without a wallet. If the atlas can't load (offline), the picker says so and offers to try again, or the default.
- **Never changed afterwards.** A saved birthplace is checked when loaded. A damaged one is refused, never quietly replaced with Mauna Kea. One whose time zone this browser doesn't know waits, unread, rather than being read somewhere else.
- **The atlas**: Natural Earth populated places (public domain), as packaged with time zones by city-timezones 1.3.4 (MIT). Places were kept only when their time zone is in the IANA database and agrees with their longitude. It is loaded only when "Choose a Place" or "Surprise Me!" is picked (about 160 KB compressed).

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

- **Where the theme comes from** (`story/source.ts`, `DailyAstrologySource`). Sources are asked in turn: a COZMC editorial theme for a date (a table, empty for now; the same for every Cozmling), then a slot reserved for a licensed feed (off; nothing is fetched, copied or scraped from anyone without a licence), then the first-party theme, which always answers. A source that fails is skipped, so a story is always written.
- **The day's kind** (play, comfort, curiosity, connection, courage, reflection, creativity, growth, dreams, change, quiet) comes from `storyKind(day, stage, recentKinds)`: a steady rotation by the day and its growth stage that skips the kinds of its last two stories. Never from its sign, birthplace or chart. Every Cozmling at the same stage with the same story history gets the same story on the same day, in its own voice.
- **Today's sky reading** is separate: the strongest transit to its birth chart, with one line of how it might read (`AS_THE_SKY_SAYS`) and when it is exact. It is shown beside the story, under "Its sky today", and never chooses anything.
- **The story** (`story/engine.ts`, `CozmlingDailyStoryEngine`) is built from templates (`story/themes.ts`, original COZMC writing). It has three short paragraphs:
  1. Where it is, what it seems drawn to in its own home, and a moment the day pauses on ("Then something new catches its eye."), followed by its own line for that moment, in its Starprint's voice (`story/voices.ts`). A sleeping Cozmling dreams it instead, and rests.
  2. Its happiness and sustenance, as numbers, and what it needs, by the same rules as its care meters.
  3. You and it, and a closing line: days away, what you have shared since its last story, its birthday, a stage that is close.
- **Everything in it is a tendency**, never a rule ("it seems", "as if", "perhaps"). It never says what will happen, and a test checks every story for "will", "always", "never" and "destined".
- **The invitation** is what it needs most (a meal, a game, rest), or something in keeping with the day: a pat, a game, looking at today's sky together, or an arcade game for a first-version Cozmling. It shows "Done" once it has been taken up, judged from what happened (the care counters, its energy, a visit to today's sky). Nothing is rewarded: an invitation never changes needs, rewards, scores, tickets or tokens.
- **Kept once a day.** Each story is one event, `story:<companionId>:<day>`. The store keeps an event id only once, in any tab, so the same day never gets two stories. It records the moment it was written (its numbers and counters then), its source, the transit its sky reading was built on, and the engine version (`cozmc-story` 2). Stories kept before this change (schema 1) are shown exactly as they were written.
- **The same input, the same story.** Choices between lines come from the day, its growth stage and its story history (`seed`), never its id, sign or chart, so a story can be written again identically.

## Starprint voices

`story/voices.ts`: 72 original lines, twelve archetypes across six moments (a setback, noticing something, asking for help, helping a friend, resting, a small win), each 20 words or fewer. A Cozmling speaks in its Starprint's archetype; a first-version Cozmling with a sky speaks in its Sun sign's. A story decides the moment; the voice only says how that Cozmling meets it. The line is shown in color, so a player can see it is its own.

## Choice stories

`story/choice.ts` (the engine), `story/bridge.ts` (the first story) and `story/ChoiceStoryPanel.tsx` (on the Star Loft page).

- **The Bridge After the Rain.** Rain has loosened two planks of the bridge the Cozmling built. After its friend arrives, it has a line of its own (one per archetype, from the zodiac writing review), and then the player chooses: look closely, ask a friend to help make a new plan, or rest together. Each leads to a second choice and one of four safe endings, with a friend nearby, an invitation and a reflection. Where three routes meet in "A new plan", its first line says which way you came.
- **The same for everyone.** Scenes, choices and endings are identical for every Starprint and stage; only the voice lines differ (the opening, and its line for noticing, asking for help, resting and a small win). Nothing is rewarded or lost.
- **Kept as it was read.** A finished reading is one `choice-story` event, `choice:<companionId>:<storyId>@<version>:<started>-<nonce>`, with the scenes passed, both choices and their wording, the ending, every paragraph as shown and the choices offered. Its id is fixed when the reading begins, so a choice pressed twice is kept once. Reading it again is a new event that points to the first.
- **A draft for now.** It shows only on the preview site and in local work. A reading left halfway isn't kept; it starts again from the beginning. There is no notes box yet.

## Story Mode: stories told over several visits

`story/world.ts` (what the game remembers), `story/arc.ts` (scenes and the director), `story/starflower.ts` (the first arc), `story/useStoryMode.ts` and `story/StoryModePanel.tsx` (on the Star Loft page, under the bridge).

- **One visit a story day.** A story day is the player's own calendar day, the same boundary as the daily story. Once a choice is made, the page shows what followed until the next story day.
- **Choices carried forward, in saved game state.** Everything that happens is one `story-mode` event with a stable id: `sm:<companionId>:<run>:<arc>:<scene>` for a choice, `sm:<companionId>:<run>:<arc>:keep-<promise>` for the world keeping a promise. The store keeps an id only once, so pressing a choice twice, refreshing or a second tab applies its effects once. The world is worked out from these events in order:
  - what each character saw, heard or guessed, and from whom;
  - promises: by whom, to whom, the day they fall due, kept or still open;
  - where objects are; offers for a later visit; threads a later story can pick up;
  - for each arc: the day it began, which way it went, every visit and choice, the day it ended.
- **The world's own rules.** When a story day begins, a promise that has fallen due is kept, on the day it fell due, once. The starflower's frost and seeds follow the days alone, the same for every player and choice.
- **The director** picks the visit: today's choice if one was made; otherwise an arc under way whose next scene is due (one with something new to see first); otherwise a new arc whose growth stage the Cozmling has reached (`minStage`); otherwise a word about the stage a story is waiting for, or a quiet day. Two or more story days away gives a short catch-up.
- **Characters with a point of view.** The lamplighter wants to help but has an evening route to finish, and promises a lantern for afterwards. Arriving after the frost, they see the curled petals and can only guess why. Its friend, if it was elsewhere, asks what happened. Each line comes from what that character saw, heard or promised.
- **The same for every Starprint.** The director, the scenes, the choices and their effects read the world, the story day and the growth stage only, never the sign, the chart or any notes. The Starprint fills in voice lines (`story/voices.ts`). Journaling stays optional, and nothing private is read.
- **The Fading Starflower** (a draft, at Cadet stage or older), over three visits:

  | First visit | Next visit | Last visit |
  |---|---|---|
  | **Stay a while:** it sees the petals fold toward the warm side of the stone (an observation) | Its friend, who was elsewhere, asks what happened: show it the fold, or keep it for later | The fold is in its sketch of the stone |
  | **Ask for help:** the lamplighter promises a lantern after the route (a promise, due the next day) | The lantern stands beside the same stone, in the scene and the picture; its friend asks where it came from | The lamplighter, who saw the curled petals, asks whether to leave the lantern for the path home or take it back |
  | **Rest for now:** its friend sits with it and offers to walk home together next time (an offer) | That offer is a new choice: walk back together, or stay a little longer | On the walk, where to go next time (a thread for a later story) |

  The flower is curled by frost on the second day and has gone to seed by the third, whatever was chosen. Every visit ends at a natural place to stop.
- **Old saves.** A save with no Story Mode events is an empty world: nothing to migrate.

### The preview's test save

On the preview site (and in local work), the Story Mode card has a dashed box, **Story test save · preview only**. A link straight to `#/cozmling/story` opens the Cozmling's page at that card.
- **Start a test story save:** Story Mode then plays in a separate IndexedDB database (`cozmc-cozmling-v2-story-test`). Its story and its simulated story day, shown next to the controls, are kept there, one per Cozmling. The Cozmling's real save, its story and its Memories are never touched, and the test save is never exported. When the Cozmling is too young for every story (a new one is a Sprout; the starflower is a Cadet story), the test save starts at the youngest stage a story needs, so the story begins at once. While the test save is on, the box sits at the top of the card, so the date and **Advance** are the first things on the screen.
- **Advance one story day:** the simulated day moves on by one, and Story Mode runs as normal: due promises are kept, the next scene is chosen, and the next choice waits. The same advance tried twice (a double tap, a retry) moves one day.
- **Reset test story:** a new run from today; the earlier run is left unread.
- **Growth stage for this test story:** lets a new Cozmling reach the Cadet story without growing; the Cozmling itself doesn't change. If the story is waiting for a stage, the card offers it in one tap (**Start it as a Cadet (test save only)**).
- **Back to the real save:** Story Mode reads the regular save again.

None of this is in a production build: the controls, the test database and the code behind them are left out (`COZMLING_DEV`), as is every draft story.

## The zodiac writing review (November 13, 2026)

A zodiac writing pass returned 72 voice lines, 12 bridge openings and a verdict on each of the 204 sky words. Applied on November 14, 2026:

- **Sky words:** 113 kept, 69 changed exactly as proposed (sign tones for Scorpio and Aquarius, Neptune, the 6th and 8th houses, every aspect phrase, every Moon phase, the chart patterns, the retrograde, stationary and slow-planet notes, the disclaimer, two transit verbs, and the daily story's titles, tendencies and reflections). Placeholders and ids are unchanged; `tests/celestial-words.test.ts` reads every reading as complete sentences.
- **The ten "today" fragments** (`today’s mood`, `this season’s lessons`…) keep their words in a new frame, "This sky symbol can bring today’s mood to mind.", both in a planet's place today and in a transit ("…to mind, alongside its feelings: a tension that can invite a fresh approach.").
- **The twelve old mappings** (`KIND_BY_POINT`: a transit to its Sun meant play, its Moon comfort, its Mercury curiosity, Venus or the Rising sign connection, Mars courage, Jupiter or the Midheaven growth, Saturn reflection, Uranus creativity, Neptune dreams, Pluto change) chose every daily story's kind until this change, through `firstParty` in `story/source.ts`. They are removed; the rotation above replaced them.
- **Two open points** for the team: the new disclaimer no longer says "not a prediction" (the story card still does), and one opening still mentions the Cozmling's antenna while its creature design is open.
- **Offline.** If today's sky can't be read, today's story is shown if it was already written. Otherwise the last story is shown, labelled with its own day, never as today's.

## First-version Cozmlings

They keep everything they had, and nothing is read for them unless their player asks. The ask is in the "About" panel in the Star Loft.

- **Hatch moment recorded:** its real birth sky, read for that moment (`rule: 'hatch-moment'`).
- **Hatch moment never recorded** (brought back from a wallet note): its birth sky can't be known, so none is invented. Its player can give it an **awakening sky**, the sky at that moment. It is always labelled as an awakening, never as its birth.
- **Still an egg:** nothing yet.

The first version's own saves (`cozmc-cozmling-v1…`) are never touched by any of this.

## Tests

- **`npm test` → `tests/celestial-reference.test.ts`.** Planet positions, signs, retrograde motion, the Rising sign and Midheaven at 12 places against the Swiss Ephemeris; wall clocks against Python's `zoneinfo`; daylight saving and local mean time case by case.
- **`npm test` → `tests/cozmling-birthplace.test.ts`.** The atlas, search and surprises; the default stays Mauna Kea and old eggs aren't given a place; a chosen place sets the clock and the angles; daylight saving at a birthplace; cusp days on the place's clock; damaged birthplaces caught; no location code anywhere.
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
  - Every part of a story, with its real numbers, life stage, moment and voice; its sky reading built on the day's strongest transit.
  - The same day, growth stage and story history give all twelve signs, each read three ways (two hatch times and another birthplace), the same story and invitation for 21 days running, in twelve different voices; the sky reading still differs by chart.
  - The kind of day follows the day, the stage and the last two stories, and never the Cozmling's id.
  - Happiness, sustenance and energy change the story and its invitation; asleep, it dreams.
  - Days away, what you shared since its last story, hatching day, birthday and a close stage.
  - A new story at the player's midnight; the store keeps a day's story only once.
  - Invitations are seen to be taken up from what happens, with no reward.
  - Sources: an editorial theme for a date, the licensed slot off, a failing source skipped.
  - 126 stories (21 days, three states, two Cozmlings) checked for forecasting words and template slips.
- **`npm test` → `tests/cozmling-choice-story.test.ts`.** The bridge: six routes and four endings with no dead ends; three first choices with openings that start none of them; the same scenes, choices and endings for all twelve archetypes, only the voice lines differing; the three routes into "A new plan" kept as three different records; a reading kept exactly as shown; the 72 voice lines.
- **`npm test` → `tests/cozmling-story-mode.test.ts`.** Every starflower route (12) in three visits, each ending at a place to stop; the lamplighter's promise kept the next day, once, with the lantern by the same stone and the lamplighter's own view; Stay a while shared later by a friend who was elsewhere; Rest for now's offer as a new choice; skipped visits with a catch-up and the promise kept on its due day; a choice pressed twice applied once; all twelve Starprints (and none) with the same scenes, choices and outcomes and twelve voices; the Cadet stage rule and old saves; the test save's advance, reset and separation, and its starting stage.
- **`npm test` → `tests/celestial-words.test.ts`.** Every sky reading, for 40 charts, every sign, house, kind of aspect and pattern, read as complete sentences with nothing unfilled and no forecast; the ten "today" fragments in both frames; the review's wording as shown.
- **`tests/celestial-sky.mjs`**, in a real browser, Story Mode: a new test save beginning the story at once, at Cadet, with its controls above the story; the one-tap start when the story is waiting for a stage; Ask for help, advance one story day and find the lantern, with reloads and double taps on choices and on Advance applying nothing twice, and Reset leaving the real save exactly as it was; Stay a while across a reload; Rest for now with a skipped day; a first-version Cadet's regular save on real days (three days away, opened from the direct link, the lantern kept once and in its Memories); two signs with the same scenes and choices in their own voices.
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
- **Story Mode has one arc so far** (a draft, on the preview only). The starflower's outcome is the same for everyone by design; weather or other world rules could vary it later. Model-written lines are not used: every line is authored.
- **Two Cozmlings at the same stage with the same story history share the day's story.** Their voice lines and sky readings differ. Before November 14, 2026, each Cozmling's id also varied the lines.
- **Placidus houses are not offered.** Whole-sign only for now. Another house system would be a new `houseSystem` value, and saved charts would keep theirs.
- **A town not in the atlas** can't be chosen; the nearest bigger town gives nearly the same chart (the Rising sign moves about 1° for every 4 minutes of longitude).
- **No birth time of the player's own.** The time of day is the hatch minute; the place only changes the clock and the angles.
- **The device clock is trusted.** A hatch minute read from a wrong device clock gives a chart for that minute.
- **A few Cozmlings disagree with their chart.** Adventurers made on the preview before skies existed keep their calendar-based Starprint. If their real Sun sign differs, which is rare, the observatory says so.
- **Wording is a first draft.** `interpret.ts` is original COZMC writing, kept short. It is meant to be edited.

## What comes next

These follow the brief's own order.

1. ~~**MVP 2, Living Sky.**~~ Built: see above.
2. ~~**MVP 3, Living Story.**~~ Built: see above.
3. **MVP 4, Shared Journey.** Arcade, care and milestones in a Star Journal, with each story read and every choice made.
   - **Started: Story Mode** (above). Choices carry consequences into later visits through saved game state; the first arc, The Fading Starflower, is playable on the preview, with a test save to advance the story day.
   - **Still to come:** the Star Journal page itself (story history, read as it was), more arcs at each growth stage, arcade runs and care milestones in the journal (these need rebuild step 3: arcade runs counting for adventurers).
   - **Direction:** as Cozmlings grow older, their choices can carry consequences into later stories: a friend remembers a promise, a place shows how it changed, two friends revisit a decision. Cozmlings at the same stage with the same story history always get the same options, across every Starprint; the player can see what a choice changed and has room to reconsider; resting and setting a boundary stay worthwhile answers. Any cost to care, survival rule or effect on growth needs its own design first; none is in the care system.
4. **MVP 5.** "Then × now" overlays, and a slot for a licensed horoscope feed through a `DailyAstrologySource`. Nothing is copied or scraped.

Rewards tied to the sky stay switched off until they are reviewed. Nothing here ever changes prizes, scores, tickets or token amounts.

## Future NFT opportunities

None are built, and none should depend on this. A birth chart is a small, deterministic, versioned record, so it could one day be shown or proved alongside a collectible without changing how daily play works. That is a separate review.
