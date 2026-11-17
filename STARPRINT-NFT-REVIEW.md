# Starprint NFTs: review, costs and Mark's MainNet checklist

Branch `starprints-launch`. Status on Nov 17, 2026: the minting path is built and tested and runs on
Algorand **TestNet** on the preview (https://cozmc-preview.netlify.app). MainNet is built but **switched off**.
Every MainNet signature, funding action and switch belongs to Mark.

## What a player does

1. On a hatched Starprint saved to their verified wallet, they open **Starprint NFT** in the Star Loft.
2. They see the fee, what goes public, and an optional checkbox to include the Starprint's name.
3. **Mint**: their wallet asks them to approve the **0.01 ALGO** fee.
   - TestNet: a 0.01 TestNet ALGO payment to the COZMC issuer.
   - MainNet: the same group as posting a score. The 0.01 ALGO is paid to the Pact Vault, swapped for COZMC,
     and every unit of that COZMC goes to the Bonfire. (A MainNet simulation on Nov 17 showed 0.01 ALGO
     buying and burning about 231.6 COZMC, with about 0.006 ALGO in network fees.)
4. The server checks the fee on chain, then mints one asset: supply 1, no decimals, unit STAR,
   "Starprint #N", no freeze or clawback, not frozen by default, and a manager that is a different account
   from the issuer.
5. **Receive in my wallet**: their wallet asks them to accept the asset (an opt-in), then the issuer sends it.

## What's public

On the asset and its metadata: the serial number, the Star Chart's Sun sign, element and archetype, and the
Starprint's name only if the player ticked the box. Never the birthplace, birthday, care, story or anything
else about the player. A test checks this.

## Safeguards (all covered by tests on a real PostgreSQL database with a simulated Algorand node)

- **One asset per Starprint**: repeated requests, two at once, a lost answer from the node, a send that never
  arrived and a closed validity window all still give one asset. The signed transaction is saved before it is
  sent and re-sent within its window; a new one is only signed once the old one can no longer confirm.
- **The fee**: nothing is minted before a confirmed payment of at least 0.01 from that wallet, with that
  mint's note, to the right receiver. On MainNet the same group must also burn COZMC in the Bonfire. Each
  payment pays for one mint only.
- **Delivery**: only to the owning wallet, only after it opts in, and with a supply of 1 it can only ever be
  sent once.
- **Ownership and limits**: only the verified owner of a hatched Starprint can mint it, with a daily cap
  (`COZMC_STARPRINT_DAILY_CAP`, default 20). A payment that was already made always gets its mint, even if
  the cap is reached in the meantime.
- **Keys**: the TestNet issuer key is made by the preview database and never leaves it. The MainNet issuer key
  is read only from the environment (a Netlify secret) and never written to the database (tested).
- **MainNet guard rails**:
  - MainNet runs only with `COZMC_STARPRINT_NETWORK=mainnet` **and** `COZMC_STARPRINT_MAINNET=1`.
  - It refuses to start without the issuer key and a separate manager address.
  - It refuses to mint from any address but https://cozmc.us, because an asset's URL is fixed forever.
- **Scores are untouched**: posting a score builds exactly the same transactions as before. This was checked
  against MainNet by simulation, and Starprint fee notes (`cozmc:starprint:v1:fee:`) can never count as scores.

## Costs on MainNet

| Who | What | Amount |
|---|---|---|
| Player | Mint fee (buys and burns COZMC) | 0.01 ALGO |
| Player | Network fees for the fee group | about 0.006 ALGO |
| Player | Accepting the asset (opt-in) | 0.001 ALGO fee, plus 0.1 ALGO held in their balance while they keep it |
| COZMC issuer | Creating the asset | 0.001 ALGO fee |
| COZMC issuer | Minimum balance for each asset it created | 0.1 ALGO, locked for as long as the asset exists |
| COZMC issuer | Sending it to the player | 0.001 ALGO fee |

- **COZMC pays about 0.102 ALGO per Starprint**: 0.1 of it locked, 0.002 spent. The 0.01 fee is burned, so it
  doesn't come back to COZMC.
- That's about 102 ALGO per 1,000 Starprints, and at most about 2.04 ALGO a day at a cap of 20.

## Mark's MainNet checklist

Prerequisites, before any MainNet switch:

1. **Set up production** (see "Production on cozmc.us" below), and finish the hatch decided by the server (launch
   plan section 1), which is still to come.
2. **Do a full TestNet rehearsal with a real wallet.** Use Pera or Lute in TestNet mode and run mint, receive
   and the explorer check on the preview. The site's wallet setup is MainNet-only, so this is the check that
   signing a TestNet payment works on a phone.
3. **Make these decisions:**
   - the metadata host: today it is cozmc.us/api/starprint-meta/N; the launch plan suggests ARC-19 with IPFS
     on two providers, which needs provider keys;
   - the final artwork (today it uses the card face as a placeholder);
   - the Genesis edition policy, terms and the public page.

When those are done:

1. Create a **new issuer account** for Starprints only, and a **separate cold account** as the manager, kept
   offline.
2. In Netlify, on the **production** site only, set:
   - `COZMC_STARPRINT_ISSUER_MNEMONIC`: the issuer's recovery phrase, marked **secret**, Functions scope.
     Only Mark enters this; Claude never sees it.
   - `COZMC_STARPRINT_MANAGER`: the cold manager address.
   - `COZMC_STARPRINT_MINT=1`, `COZMC_STARPRINT_NETWORK=mainnet`, `COZMC_STARPRINT_MAINNET=1`.
   - The build flag `VITE_COZMC_STARPRINT_MINT=1`.
3. Deploy outside **00:00–01:00 UTC** (the daily prize payout). Change switches and the cap outside that hour
   too.

## How many Starprints a player can have (decided Nov 17, 2026)

- Each wallet can have up to **10 Starprints**, on TestNet and MainNet. Mystery eggs from events are separate.
- The server enforces this under a per-wallet lock: even 12 adoptions sent at once make exactly 10 (tested on
  a real database).
- `COZMC_STARPRINTS_PER_WALLET` can change it (1–100); without it, the cap is 10.
- The Star Loft shows **Create a new Starprint** with how many of the 10 are used.
- Each one can be minted, so one wallet can cost COZMC at most about 1 ALGO (10 × 0.102). The daily mint cap
  still limits the total across everyone.

## How the launch runs (decided Nov 17, 2026)

The fee stays **0.01 ALGO, all of it burned**. COZMC covers about 0.102 ALGO per Starprint as a launch cost,
and the daily cap is the budget limit.

1. **Cap of 1, then 20.**
   - Set `COZMC_STARPRINT_DAILY_CAP=1`, fund the issuer with about **2 ALGO**, and mint the first Starprint
     yourself from your own wallet.
   - Check it on the explorer: the asset (supply 1, STAR, your manager address, no freeze or clawback), the
     0.01 ALGO fee, the COZMC burned in the Bonfire, and the Starprint arriving in your wallet.
   - If all of that is right, set `COZMC_STARPRINT_DAILY_CAP=20`.
2. **Top up in small amounts as it's used.**
   - Check the minting account with the read-only report (it signs and sends nothing):

     ```
     node scripts/starprint-report.mjs --issuer <ISSUER ADDRESS>
     ```

   - It shows the Starprints minted and delivered, the ALGO locked and spendable, the COZMC burned by fees,
     the last 7 days' pace, and how long the balance lasts.
   - When spendable ALGO drops below **2**, it says to top up, by about a week's worth at the current pace
     (at least 2 ALGO). At the full cap of 20 a day, that's about 15 ALGO a week.
   - A small balance also limits what could be lost if the issuer key were ever exposed.
3. **Review after 30 days.**
   - Run the report with `--since <launch date>` for the month's numbers.
   - If the cost is too high, switch to **splitting the fee**: send about 0.102 ALGO of each fee to the minting
     account and burn the rest, which needs a higher fee (about 0.11 ALGO or more). Changing the fee doesn't
     affect anyone who already minted.

To switch MainNet off again, unset `COZMC_STARPRINT_MAINNET` (it falls back to TestNet) or
`COZMC_STARPRINT_MINT` (everything off).

## Known limits

- A fee payment is remembered on the device that paid it. If the player starts again on another device
  before the mint finishes, they could pay twice.
- The asset's metadata lives at a cozmc.us address. If that address ever changes, older Starprints keep
  pointing at the old one (ARC-19 would fix this).
- The asset's name is "Starprint #N" and the unit name is STAR. Both fit Algorand's limits (32 and 8 bytes).

## Production on cozmc.us (built Nov 17, 2026; everything off until Mark sets it)

The account, game and minting can now run on cozmc.us, but only when **every** production setting below is in
place on the live site. Without them, the live site behaves exactly as today. This was checked: the regular build
contains none of the new code, the existing site test passes on it, and with the settings missing every account,
game and mint route answers "disabled".

### Settings (Netlify, live site only)

| Setting | Value | Notes |
|---|---|---|
| `COZMC_ACCOUNT_ENABLED` | `1` | **Wallet switch**: wallet sign-in and reading saved Starprints. |
| `COZMC_PRODUCTION` | `1` | Allows production at all. |
| `COZMC_PRODUCTION_SITE_ID` | the live site's ID | Settings copied to another site do nothing. |
| `COZMC_ACCOUNT_ORIGIN` | `https://cozmc.us` | Exactly this; anything else refuses to start. |
| `DATABASE_URL` | the **production** database (secret) | Its own database, never the preview's. On first use it is bound to cozmc.us, so a preview can never use it. |
| `COZMC_ACCOUNT_SESSION_SECRET` | 32 random bytes, base64url (secret) | Signs sign-in sessions. Required in production. |
| `COZMC_GAME_ENABLED` | `1` to turn on | **Game switch**: adoption, saves and the Grove. Off: Starprints can still be read and exported. |
| `COZMC_STARPRINT_MINT` | `1` to turn on | **Mint switch**: TestNet unless the two MainNet settings are also set. |
| `COZMC_STARPRINT_DAILY_CAP` | `1`, then `20` | Mints a day across everyone. |
| `COZMC_STARPRINT_MONTHLY_BUDGET_ALGO` | for example `60` | Refuses a new mint that would take the month past this (0.102 ALGO each). |
| `COZMC_STARPRINT_LOW_BALANCE_ALGO` | `2` | The level for the low-balance alert. |
| `COZMC_ALERT_WEBHOOK_URL` | optional (secret) | A private Discord channel webhook for the hourly low-balance alert. |
| `COZMC_STARPRINTS_PER_WALLET` | leave unset (10) | Starprints per wallet. |
| Build flags | `VITE_COZMLING_V2=1`, `VITE_COZMLING_WALLET_ACCOUNT=1`, `VITE_COZMC_STARPRINT_MINT=1` | The player-facing parts. Never set `VITE_COZMLING_DEV` on the live site. |

To make the session secret:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

### Safety built in

- **The live database never changes itself.** Production stops with `database_not_migrated` until the
  migration script has brought the database to the code's version.
- **The minting account is checked before the player pays.** A mint is refused, and nothing is charged, if the
  issuer can't afford it (`issuer_low`), or if the daily cap or monthly budget would be passed.
- **Hourly low-balance alert.** It writes to the function logs, and to the webhook if one is set. It only reads.

### Steps to go live (outside 00:00–01:00 UTC)

1. **Create the production database.** It must be separate from the preview's. Put its URL in `DATABASE_URL`
   on the live site, marked secret.
2. **Back up, then migrate**, from your own computer:

   ```
   DATABASE_URL=… scripts/db-backup.sh backup ~/cozmc-backups
   DATABASE_URL=… node scripts/db-migrate.mjs            # dry run: shows the version, changes nothing
   DATABASE_URL=… node scripts/db-migrate.mjs --apply
   ```

3. **Set the production settings with the game and mint switches off**, and deploy. Check that the site works and
   that wallet sign-in works.
4. **Turn the game on**: set `COZMC_GAME_ENABLED=1`, redeploy, then create a Starprint with your own wallet.
5. **Turn minting on, on TestNet first**: set `COZMC_STARPRINT_MINT=1` and run a TestNet mint on the live site.
6. **MainNet**: follow "Mark's MainNet checklist" and "How the launch runs" above. Cap of 1, your own first mint,
   then 20.

### Pause

- **Instantly, with no redeploy:**

  ```
  DATABASE_URL=… node scripts/starprint-pause.mjs on      # pause minting
  DATABASE_URL=… node scripts/starprint-pause.mjs status
  DATABASE_URL=… node scripts/starprint-pause.mjs off     # resume
  ```

  While paused, nothing new is started, signed or sent. Anything queued or already paid for is kept and carries
  on when minting resumes. Starprint descriptions and the rest of the site keep working.
- **With a redeploy:** set `COZMC_STARPRINT_PAUSED=1`. Or turn a whole part off: `COZMC_STARPRINT_MINT`, then
  `COZMC_GAME_ENABLED`, then `COZMC_ACCOUNT_ENABLED` (everything account-related off; the site works as today).
- Keep `COZMC_ACCOUNT_ENABLED` on once Starprints exist. Their descriptions are served by the site, so turning
  it off hides them until it's back on. IPFS metadata (ARC-19) would remove this dependency.

### Roll back

- **The site:** in Netlify's Deploys list, publish the previous deploy. It's instant.
- **Database changes are additive** (new tables, columns and wider checks), so the previous code runs on the
  migrated database and no database rollback is needed. There's one exception: deploys from before the
  10-per-wallet change relied on a database rule that has since been removed, so they wouldn't enforce any
  per-wallet limit. Production starts on the new code, so this only matters if the live site were rolled back
  past it.
- **Data:** if data itself goes wrong, pause minting and turn the game off first, then restore the latest backup:

  ```
  DATABASE_URL=… scripts/db-backup.sh restore ~/cozmc-backups/cozmc-YYYYMMDD-HHMMSS.dump --confirm
  ```

  Anything written after that backup is lost, and on-chain assets are not undone. Compare
  `scripts/starprint-report.mjs` with the restored mint records before turning minting back on.

Backup and restore were tested on PostgreSQL 16: a backup, a change, then a restore brought back the backed-up
contents and schema version. Restoring refuses to run without `--confirm`.
