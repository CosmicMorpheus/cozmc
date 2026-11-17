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

1. **Run the wallet account in production.** Today the server refuses to run the wallet account, and so
   minting, on cozmc.us (it is preview-only by design). Launch plan section (a) covers this: a production
   database, production config, and a hatch the server decides. This is the largest remaining piece.
2. **Do a full TestNet rehearsal with a real wallet.** Use Pera or Lute in TestNet mode and run mint, receive
   and the explorer check on the preview. The site's wallet setup is MainNet-only, so this is the check that
   signing a TestNet payment works on a phone.
3. **Make these decisions:**
   - the metadata host: today it is cozmc.us/api/starprint-meta/N; the launch plan suggests ARC-19 with IPFS
     on two providers, which needs provider keys;
   - the final artwork (today it uses the card face as a placeholder);
   - the Genesis edition policy, terms and the public page.

When those are done:

1. Create a **new issuer account** for Starprints only. Keep its balance small (25 ALGO covers about 240
   Starprints).
2. Use a **separate cold account** as the manager and keep it offline.
3. In Netlify, on the **production** site only, set:
   - `COZMC_STARPRINT_ISSUER_MNEMONIC`: the issuer's recovery phrase, marked **secret**, Functions scope.
     Only Mark enters this; Claude never sees it.
   - `COZMC_STARPRINT_MANAGER`: the cold manager address.
   - `COZMC_STARPRINT_DAILY_CAP`: start at `1`.
   - `COZMC_STARPRINT_MINT=1`, `COZMC_STARPRINT_NETWORK=mainnet`, `COZMC_STARPRINT_MAINNET=1`.
   - The build flag `VITE_COZMC_STARPRINT_MINT=1`.
4. Deploy outside **00:00–01:00 UTC** (the daily prize payout).
5. Mint the first Starprint yourself. Check the asset, the burn and the delivery on the explorer, then raise
   the cap.

To switch MainNet off again, unset `COZMC_STARPRINT_MAINNET` (it falls back to TestNet) or
`COZMC_STARPRINT_MINT` (everything off).

## Known limits

- A fee payment is remembered on the device that paid it. If the player starts again on another device
  before the mint finishes, they could pay twice.
- The asset's metadata lives at a cozmc.us address. If that address ever changes, older Starprints keep
  pointing at the old one (ARC-19 would fix this).
- The asset's name is "Starprint #N" and the unit name is STAR. Both fit Algorand's limits (32 and 8 bytes).
