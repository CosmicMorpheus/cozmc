# The original Cozmling scene: recovery notes

The first Cozmling on cozmc.us lived in a pixel-art scene: a purple night sky, a big glowing moon and stars, dark pine forest, grass with glowing mushrooms, fireflies, and a small pixel alien that wanders, blinks, eats, plays and sleeps. This page records how it was found and brought back into the current site.

**Recover first. Preserve second. Expand third.**

## 1. What was found

Nothing had been lost. The original implementation is the site's own code, still in the repository and still running:

| Part | File | History |
|---|---|---|
| The pixel Cozmling (5 stages, 2 forms, colours, poses: idle, happy, eat, play, sad, sleep) | `src/companion/look.ts` | Unchanged since the first commit, `615d04f` (22 Oct 2026, "COZMC v3 test version") |
| The homes, drawn in code on a 144×96 pixel grid. **The Cosmic Grove** is the scene in the reference video: dithered purple sky bands, 46 stars, the moon with craters and a halo, two lines of pines, dithered grass and soil, a woven nest with a purple blanket, a mossy log, four glowing mushrooms (cyan and pink on the left, cyan and purple on the right) and seven fireflies. The Moon Base is the other original home. | `src/companion/scene.ts` | The Cosmic Grove is unchanged since `615d04f`. The painted Star Loft room was added in `78df9d3`, 33 minutes later. |
| The Room: wandering, blinking, food that drops in and is eaten, the star ball, hearts, sleeping with the lights out, the egg cracking and hatching with a flash, the thought bubble when something is needed | `src/companion/room.ts` | Small changes since, for the painted Star Loft's scale |
| The care rules: Food, Fun, Energy, mood, needs, sleep, growth points and stage thresholds | `src/companion/care.ts` | Extended since: staying asleep until woken, guest copies, wallet back-up |

Drawn from today's code, the Cosmic Grove with a sky-blue Cadet (red antenna glow, low on energy, its thought bubble showing a Z) matches the reference video: the same layout, colours and details, compared side by side.

Why it seemed gone:

- `78df9d3` (22 Oct) added the painted **Star Loft** room and made it the default home for new Cozmlings on the live page. The Cosmic Grove stayed, but only as a choice in the home picker.
- The rebuilt Cozmling (`src/cozmling/`, behind `VITE_COZMLING_V2`, on the preview only) drew **new Starprint adventurers** with placeholder concept art (`render/AdventurerRenderer.tsx`) in a different room. The original creature and the Grove appeared there only for first-version Cozmlings.

Branches and tags: `main`, `TestVersion`, `cozmling-v2`, `cozmling-celestial` (no tags). Older Netlify deploys were not needed: the editable source is in git, and a compiled deploy holds nothing more.

## 2. What was restored, and what changed

Recovery branch: `cozmling-recovery`, made from `cozmling-celestial` (which stays as it was). Nothing was reverted, and `look.ts`, `scene.ts` and the care rules are untouched.

**In the rebuilt Cozmling page (preview):**

- **Every Cozmling is drawn in the original scene.** `render/OriginalSceneRenderer.tsx` (the first-version wrapper, generalised) draws any companion with the original `Room`.
- **A new adventurer is the original creature**, mapped in `integrations/originalScene.ts`:
  - Look A and Look B are the original's two forms.
  - The skin colour chosen is its body colour.
  - Its antenna glows in its Starprint element's colour: fire red-orange, earth green, air gold, water cyan.
  - The same record always draws the same Cozmling.
- **It lives in the Cosmic Grove** unless its player moves it. The wardrobe offers the original homes (Cosmic Grove, Moon Base, Star Loft), saved with the record.
- **It grows on the original ladder** with the original thresholds: Star Egg → Sprout (0) → Cadet (40) → Explorer (200) → Guardian (600 points). The Star Loft shows that ladder and its progress bar, and the preview tools can show each stage without saving anything.
- **Choosing a look** shows the original creature in the chosen colours, growing through its stages on a loop, like the first version's adoption preview.
- **Reduced motion:** the Room has a new, opt-in `calm` mode.
  - The scene holds still, and care shows as a pose instead of falling food, bouncing balls, hearts, sparks and flashes.
  - It is used only when a player asks for reduced motion.
  - With it off (the default, and always on the first version's own page), the Room draws exactly as before.
- **The concept-art figures are kept, not deleted.** Set `ADVENTURER_SCENE` in `integrations/originalScene.ts` to `'concept-art'` to bring them back for adventurers.

**On the live page (first version):** new Cozmlings start in the **Cosmic Grove** again (`src/tabs/Companion.tsx`). Cozmlings already saved keep their home. This reaches cozmc.us only when it is pushed live.

**Saved data:** no schema change. An adventurer's appearance fields are reused:
- `rendererVersion: 'original-1'` and `home`;
- records from before the recovery (`'layers-1'`) are shown in the Grove with no migration.

## 3. Ready for the pet system to come

Nothing below is built yet. The recovered scene is structured so each can be added without replacing it.

| Planned | Where it fits now |
|---|---|
| Egg → Baby → Teen → Adult | The original ladder: Star Egg → Sprout (baby) → Cadet (child) → Explorer (teen) → Guardian (adult). Thresholds are one table, `GROWTH` in `src/companion/care.ts`. |
| Passion and Sustenance | Today's meters are Fun and Food (plus Energy), by the first version's rules (`src/companion/care.ts`). Renaming them, or adding a meter, is a change in one place, which the scene already reads through `mood()` and needs. |
| Feeding, sleeping, playing, caring | The Room's reactions, driven by the v2 care rules (`src/cozmling/domain/care.ts`). |
| Personality and celestial birth charts | The Starprint and the birth sky (`src/cozmling/celestial/`). The element already colours the antenna. |
| Daily astrology-inspired stories | Today's sky report (`celestial/daily.ts`) is the sky half. The story engine (MVP 3) will add mood, needs and recent care. |
| Arcade-based progression | Arcade runs already count double toward growing up (`growthPoints`). |
| Persistent individual pet records | The v2 store (IndexedDB, revisions, export and import, validators), one record per Cozmling. |
| Optional wallet association, future NFTs | `walletLinks` on every record. The first version's wallet back-up note still works on the live page. |

## 4. Network and wallets: confirmed from the code, not changed

The site runs on **Algorand MainNet**, not TestNet:

- `src/config.ts`: algod and indexer at `mainnet-api.algonode.cloud` and `mainnet-idx.algonode.cloud`, with the COZMC token ASA 3739851986.
- `src/lib/wallets.ts`: the wallet manager is built for MainNet only (`defaultNetwork: NetworkId.MAINNET`).
- The preview site uses the same settings.
- The only TestNet path is an option in `scripts/daily-payout.ts` (`ALGOD_URL` and `INDEXER_URL`).

The recovery touches no chain, wallet or payout code. Guest play and off-chain care need no wallet. Moving the test site to TestNet would be a separate, reviewed change to the build settings.

## 5. Checks

- **`npm test`:** `tests/cozmling-original-scene.test.ts` (6 tests):
  - the look mapping, and that every skin and element is distinct;
  - homes, with an older record's `loft` never mistaken for a choice;
  - the original ladder and thresholds;
  - asleep, low and need from the care rules;
  - first-version Cozmlings unchanged;
  - the concept-art renderer kept.
- **`tests/cozmling-loft.mjs`:**
  - The Grove's pixels (moon, mushrooms) and the creature's colours, with every image file blocked, so the scene is drawn entirely in code.
  - A still scene under reduced motion; lights out with the mushrooms still glowing.
  - Moving home and back, saved across a reload; the stage preview.
  - The living scene with full motion: fireflies, wandering, feeding.
- The other suites still pass: the sky, the save system, and the site journey with the new Cozmling switched off.

## 6. Roadmap

1. **Review on the preview**, then decide whether new Cozmlings on the live page should start in the Cosmic Grove again (this branch does that).
2. **Bring the rebuilt page to the rest of the site** (step 3 of the rebuild): the Home Spotlight and the Arcade Buddy show the original creature for adventurers too, and arcade runs count for them.
3. **The daily story (celestial MVP 3):** today's sky plus mood, needs and recent care, told on the Cozmling's page.
4. **Name the stages and meters** as the pet system needs (Baby, Teen, Adult; Passion, Sustenance), in one place each, with the scene unchanged.
5. **More of the original world:** new homes drawn in the same 144×96 pixel style, and seasonal or sky-event touches in the Grove (the full moon, meteor nights). Each would be a new function in `scene.ts`, with the originals left as they are.
6. **Wallets and collectibles, when reviewed:** a TestNet build for testing, then optional wallet links. Nothing on chain is needed for play.
