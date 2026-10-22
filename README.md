# COZMC v3: arcade after dark

A tab-based site for COZMC (ASA 3739851986) on Algorand. It has a free arcade with on-chain leaderboards, holder ranks, a philosophy Oracle, and **the Bonfire**, where anyone can burn COZMC with a wish.

There is no backend. Everything reads from and writes to Algorand directly, so there's no server or database to run.

## The tabs

Five tabs: **Home · Cozmling · Arcade · Community · About**. Arcade and Community each have a row of pages under the header. Old links (`#/leaderboard`, `#/holders`, `#/philosophy`, `#/giveaway`, `#/card`) redirect to their new places.

| Tab | Page | What it does |
|---|---|---|
| **Home** | | The holographic card hero, the **Cozmling spotlight** (your Cozmling live in its room, or an invite to adopt one), the three paths, the arcade shelf, live numbers, the giveaway strip and the community section |
| **Cozmling** | | The companion game (prototype): adopt a little alien, boy or girl, free with a wallet. Feed it, play, pat it, put it to bed; it grows from a Star Egg to a Guardian. Saved to the wallet as a 0-ALGO note (`cozmc:pet:v1:`), so it comes back on any device |
| **Arcade** | Games | Game cabinets: **Moon Bounce** (stomp aliens on a moon trampoline, chain for combos; inspired by Sunflat's PapiTrampoline) **Brick by Brick** (a falling-block puzzle: stack, clear lines, don't top out) and **Moonshot** (a Kitten Cannon-style launch game: lock the angle, lock the power, fire the astronaut across the moon; fuel cans and pads boost you, black holes swallow you unless you skim them for a slingshot, octos grab you). Free to play with no wallet. Each game has **Free play** and the **Daily Challenge**. Connect a wallet to post your run on-chain and to unlock tier skins |
| | Leaderboards | One board per game (each wallet's best run), switchable between all-time and today's Daily, plus **Top Burners** |
| | Giveaway | The weekly giveaway (see below) |
| | Your card | Your holographic player card: tier art, name (NFD if you have one), holder rank, balance, burns, daily streak and best scores. Foil gets louder with each tier. Flip it for your badges; share it on X. Below it, all 25 badges (one is a secret) |
| **Community** | Holders | Every holder ranked into six tiers, from Stardust to Black Hole, plus your own rank and progress when connected |
| | Bonfire | Everything burned, the community goal, the latest wishes and the top burners |
| | Wisdom | Daily wisdom: a CRT that types out a new quote every day (philosophers, poets, proverbs), tap for another, plus the six COZMC principles |
| **About** | | About us, values, the ecosystem (Haystack and Pact), facts, the world map, how it started, the FAQ and official channels |

The fire strip across the top of every tab opens the burn dialog and shows the **community burn goal**. Under the header, a **live ticker** scrolls the latest burns, posted runs and new holders.

The site is also an installable app (PWA): "Install the arcade" appears in the footer on Chrome, Edge and Android, and iPhone users get Add to Home Screen instructions. The games work offline once the site has loaded.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build in dist/
npm run preview   # serve that build locally, exactly as it would go live
```

**Trying a branch before merging it** (for example `TestVersion`). This runs on your computer only; nothing goes live:

```bash
git clone -b TestVersion https://github.com/CosmicMorpheus/cozmc.git cozmc-test
cd cozmc-test
npm install
npm run dev
```

Open http://localhost:5173. To try a wallet on your phone, run `npm run dev -- --host` and open the "Network" address it prints on a phone on the same Wi-Fi. If you like it, merge the branch into `main` on GitHub.

## Deploy (Netlify)

There are two ways to deploy. Both update the existing cozmc.us site and keep the domain.

**Quick way (drag and drop)**
1. Run `npm install`, then `npm run build`. This makes the `dist` folder.
2. In Netlify, open the cozmc.us site and go to the **Deploys** tab.
3. Drag the **`dist`** folder (the folder itself, not the whole project) onto the drop area at the bottom of that page.
4. Netlify publishes it in a few seconds. To undo, click an older deploy and choose **Publish deploy**.

**Proper way (auto-deploy from GitHub)**
1. Put this folder in a GitHub repo; the `.gitignore` already leaves out `node_modules` and `dist`.
2. In Netlify go to **Site configuration → Build & deploy → Link repository** and pick the repo.
3. `netlify.toml` sets everything: build `npm run build`, publish `dist`, Node 22. From then on, every push to `main` redeploys the site. Other branches, like `TestVersion`, never touch the live site.

**After the first deploy**, set these in `src/config.ts` and redeploy:
- `SOCIAL`: your X, Discord and Telegram links (empty ones show "coming soon").
- `BURN_GOAL.reward`: what hitting the community burn goal unlocks. It currently says "unlocks the next arcade game".

To rebuild the `dist` folder yourself after edits: `npm install`, then `npm run build`.

Visitors who already have the site open pick up a new deploy on their next visit (the app's offline cache updates itself).

## Edit the basics: `src/config.ts`

- `SOCIAL`: your X, Discord, Telegram and email links. Empty ones show as "coming soon".
- `MUSIC_ID`: the background music's YouTube id. Set it to `""` to remove the music button.
- `KNOWN_ACCOUNTS`: labels on Community › Holders. Add each new liquidity pool or contract with `exclude: true` so it isn't ranked like a person.
- `PACT_FARMS`: the Pact farms for COZMC and the ALGO/COZMC LP. New farms are picked up automatically from Pact's public API; this list is only the fallback if that API is down.
- `BURN_GOAL`: the community burn target and what it unlocks. **Set `reward` to something you'll actually deliver.** It currently reads "unlocks the next arcade game" as a placeholder.
- `DAILY_START`: the date of Daily #1 (UTC). The numbering counts up from there.

## How the on-chain parts work

**Wallets.** Wallet connection uses [TxnLab use-wallet v5](https://github.com/TxnLab/use-wallet) with Pera, Defly, Lute and Exodus. Change the list in `src/lib/wallets.ts`. Rekeyed accounts work: before anything is signed, the site looks up the account's real signer so its checks match what the wallet will do.

**Pact.fi.** The Pact panels (About, Home) and the footer button link to the ALGO/COZMC pool's Add Liquidity page and to each COZMC farm. Farm APRs and TVL come live from Pact's public API (`pact.fi/api/v1/factory-farms`). They're shown as APR, which is what Pact shows for these farms, because rewards are paid in POW and don't compound by themselves.

**Burning.** A burn is a COZMC transfer to the **Bonfire**, the ARC-54 burn app: app `1257620981`, address `BNFIRE…7BPHY`. That app can receive tokens but has no way to send them, so a burn is permanent.
- The burner's wish is stored in the transaction note as `cozmc:burn:v1:<wish>`.
- The Bonfire wasn't opted into COZMC when this was built. The first burn therefore also calls `arc54_optIntoASA` in the same atomic group, which costs 0.002 ALGO in fees. After that a burn costs 0.001 ALGO.
- Both cases were tested against mainnet with Algorand's transaction simulator.

**Scores.** Playing is free. Posting a score costs **0.1 ALGO**, which buys COZMC on Pact and burns it, all in one atomic group the player signs once (`buildScoreGroup` in `src/lib/chain.ts`):
1. *(only for wallets that don't hold COZMC)* opt in to COZMC
2. pay 0.1 ALGO to the Pact Vault, carrying the note `cozmc:arcade:v1:{"g":"<game id>","s":<score>,"d":<ms>}`
3. call the Pact ALGO/COZMC pool's `swap` (app `3744648325`), which pays the COZMC out to the player
4. send the COZMC to the Bonfire. Wallets that didn't hold COZMC close out to the Bonfire, so every unit burns and their 0.1 ALGO opt-in deposit comes back.

- Before asking for a signature, the site simulates the swap against the live pool to quote the COZMC, then simulates the whole group again.
- It burns at least 97% of the quote (`SCORE_SLIPPAGE`). A holder may keep up to 3% as dust if the price doesn't move.
- Network fees are about 0.006 ALGO. The fee amount and pool are set in `src/config.ts`.
- The leaderboard reads these notes from the indexer and keeps each wallet's best run.
- A paid score only counts if its group also contains the burn, so swapping without burning doesn't get you on the board.
- Scores posted free before this existed (`FREE_SCORES_BEFORE_ROUND`) still count.
- Posted runs show in the wish feed and ticker with the COZMC they burned, and they count toward the burn goal and Top Burners.
- A Daily Challenge run adds `"day":<UTC day number>` to the note. It only counts on that day's board if it was posted that day (or within 15 minutes after midnight UTC, for runs that ended at the bell).
- Browser games can always be spoofed. Each game sets `maxScore` and `maxPerSecond`, and runs outside those limits are ignored. If cheating ever matters, the next step is a small server that verifies replays.

**Daily Challenge.** Every UTC day, each game gets one seed (`src/lib/daily.ts`), so everyone plays the identical run: the same brick order in Brick by Brick, the same alien waves in Moon Bounce, the same course in Moonshot. Play it as often as you like; your best counts. Playing a daily on consecutive days builds a streak. The board resets at midnight UTC.

**Badges, bests and streaks** are kept in the player's browser (`src/lib/profile.ts`): 25 badges for gameplay moments, dailies, streaks, burning, holding and sharing. Wallet-backed badges (holder, Planet, Black Hole, burner, on the board) are awarded from chain data whenever a wallet connects, so they come back on a new device. Add or rename badges in the `ACHIEVEMENTS` list.

**Skins.** Each game has six looks, one per holder tier: Classic for everyone, then Comet, Moon, Planet, Star and Black Hole. A skin unlocks when the connected wallet holds that tier's amount. They're cosmetic only and never affect the score.

**Holder ranks count what people hold through Pact.** A holder's total is:
- the COZMC in their wallet,
- plus the COZMC inside any ALGO/COZMC LP tokens they hold (valued at the pool's current COZMC per LP),
- plus anything staked in the Pact farms (read from each farm app's local state, since farm stakes sit in Pact's shared Vault).

Staking never costs anyone their rank or tier. The Holders table shows the breakdown under each total.

**Holder tiers** live in `src/lib/tiers.ts`:

| Tier | COZMC held |
|---|---|
| Stardust | under 10K |
| Comet | 10K to 100K |
| Moon | 100K to 1M |
| Planet | 1M to 10M |
| Star | 10M to 50M |
| Black Hole | 50M and up |

Names, thresholds and the pixel badges can all be edited there.

## Weekly giveaway (Arcade › Giveaway)

**Entering.**
- Every score posted in the arcade during the week is one ticket, with no limit per wallet.
- Every wallet can also claim **one free ticket per week**: a 0-ALGO note, network fee only. That's the "no purchase necessary" route.
- **Cozmling bonus.** A wallet whose Cozmling checks in on 5 different UTC days in a week gets **one bonus ticket**, at most one per wallet per week. Each check-in is a 0-ALGO `cozmc:pet:v1:` note with a day field, and days are counted by block time. The check-in also backs up the Cozmling's stats to the wallet.
- Weeks run Monday 00:00 UTC to the next Monday, and tickets reset each week.

**The draw is automatic and anyone can check it.**
- Once the week ends, the site takes the first Algorand block stamped at or after the deadline.
- It hashes that block's random seed with the week number and picks the winning ticket from the result.
- The Past winners list shows the block, the seed and the winning ticket, so anyone can re-check it.
- Nobody, including you, can choose or predict the winner.

**Where it shows.** The gold chip in the header, a banner with a live countdown on Home, the gold Giveaway button under Arcade, and the check-in panel on the Cozmling page.

**Paying the winner.**
1. Connect the creator wallet (`GIVEAWAY.payer`) and open Arcade › Giveaway.
2. Each drawn week in Past winners shows a **Send 100K COZMC** button. One signature pays the prize, with a note that marks the week as paid on the site.
3. If the winner hasn't opted in to COZMC yet, the page says so. When the winner connects, they get an "Opt in to receive your prize" button.

**Changing the prize** (`GIVEAWAY` in `src/config.ts`):
- `prize` is the default amount each week.
- `prizes: { 4: 250_000 }` overrides one week.
- `extras: { 4: 'plus a custom Moonshot skin' }` adds bonus text to a week.
- `start` is the Monday that week 1 begins.
- `checkinDays` is how many check-in days earn the Cozmling bonus (5).

**A caution.** Paid tickets plus a random prize can count as a lottery in some places. The free weekly ticket and the "void where prohibited" rules on the page are there to reduce that, but check what applies where you are.

## Sharing on X

High scores (game over plus any leaderboard row), Daily Challenge runs ("COZMC Daily #N"), burns (the reward screen plus Top Burners rows), the player card and Daily wisdom quotes each have a Share button. It draws a COZMC-branded 1200x675 graphic in the browser (`src/lib/share.ts`) with ready-made post text (`src/lib/sharePayloads.ts`).
- X's share links can carry text but not images, so **Post on X** copies the graphic to the clipboard and opens X; paste it into the post.
- On phones, **Share…** uses the native share sheet, which attaches the image directly.
- The site URL used in posts is `SITE_URL` in `src/config.ts`.

## Add a quote

Append `{ t, a, src?, y? }` to `WISDOM` in `src/data/quotes.ts` (y = year, negative for BC; leave src/y off for proverbs). The daily order reshuffles automatically. Please only add lines with a real source; a lot of famous quotes online are fakes.

## Add a game

1. Create `src/arcade/games/yourGame.ts` that exports an `ArcadeGame`. The contract is in `src/arcade/types.ts`, and `moonBounce.ts` and `brickByBrick.ts` are complete examples. A game draws to a canvas and calls `onHud()` and `onOver({ score, ms })`.
2. Add it to the `GAMES` list in `src/arcade/games/index.ts`.

Set `maxLives` to control the hearts in the HUD, and `touch: [...]` (left, right, jump, rotate, down, drop, hold, in display order) to get on-screen buttons on phones. They press the same keys as a keyboard, so the game only has to listen for keys.

To join in on everything else:
- **Daily Challenge:** `start({ seed })` hands you a seed. Draw every gameplay random number from `rng(seed)` (in `src/lib/daily.ts`) instead of `Math.random()`. Cosmetic randomness like particles can stay on `Math.random()`.
- **Skins:** set `skins: TIER_SKINS`, read `opts.skin` in `create()`, and implement `setSkin(id)`.
- **Badges:** call `hooks.onEvent?.(type, value)` at big moments, then map them to badges in `gameEvent()` in `src/lib/profile.ts`.

It automatically gets a cabinet, a leaderboard tab and on-chain score posting. Pick a permanent `id`, because it's written into every score.

## Files

```
src/config.ts          addresses, links, labels
src/App.tsx            tabs + layout
src/tabs/              Home, Arcade, Leaderboard, Holders, Card, Philosophy, About
src/components/        Burn (bar, goal, dialog, reward), Wallet, HoloCard, Ticker, Daily,
                       Unlocks (badge pop-ups), Install, pixel art, UI bits
src/lib/daily.ts       the Daily Challenge clock and seeded random numbers
src/lib/profile.ts     bests, streaks, badges and skins kept in the browser
src/arcade/            game contract, sound effects, games/
src/lib/chain.ts       every Algorand read and write
src/data/quotes.ts     the Daily wisdom collection, every line sourced
public/assets/         card video/poster, wordmark, share image
public/icons/          app icons; public/manifest.webmanifest + public/sw.js make it installable
archive/               the previous single-file versions of the site
```
