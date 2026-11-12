# Legacy save fixtures

Generated from the site's real v1 code (`src/companion/care.ts` at `e407bdb`) with a fixed clock, so every value has exactly the shape real players' saves have. Copy this folder to `tests/fixtures/` in the feature branch.

| File | What's in it |
|---|---|
| `legacy-local-v1.json` | 9 localStorage entries: the exact key and raw string value, plus what the current parser makes of them (`expect`) |
| `legacy-chain-notes-v1.json` | 5 Algorand self-notes in the exact `toNote()` format, plus what `fromNote()` and `restore()` produce |
| `make-fixtures.ts` | Regenerates both files: `npx tsx tests/fixtures/make-fixtures.ts tests/fixtures` from the repo root |

## Coverage

| Fixture | Current v1 result | v2 migration must… |
|---|---|---|
| `guest-egg` | Egg, 0 growth | stay an egg |
| `wallet-sprout` | Sprout, 26 growth | stay a Sprout with the same counters |
| `wallet-cadet` | Cadet, 190 growth, has a chain backup reference | stay a Cadet and keep `txid`/`round` |
| `wallet-explorer` | Explorer, 570 growth | stay an Explorer |
| `wallet-guardian` | Guardian, 1,400 growth | stay a Guardian, never demoted |
| `wallet-asleep-low` | Cadet, asleep, low food/fun | keep the sleep start and settle needs correctly |
| `wallet-pre-alien-look` | look has only `form`, so the parser upgrades it to the default girl look | keep the raw bytes and render as the parser does |
| `wallet-malformed-missing-fields` | **accepted** by the parser (known defect) | quarantine it, never silently "fix" it |
| `wallet-bad-json` | not parsed | quarantine it, never delete it, never crash |
| `note-full` / `note-checkin` | restore to Cadet | keep working; check-in notes feed past giveaway proofs |
| `note-old-no-state` | restores fresh and awake | same |
| `note-bad-palette` | body index 63 **accepted** (known defect) | reject or clamp, with a recorded warning |
| `note-egg` | an egg restores as a hatched **Sprout** (known defect) | record hatch provenance as unknown, never invent a hatch |

## Scenarios to run

1. Each entry alone in a fresh browser.
2. `guest-egg` plus `wallet-cadet` in the same browser: a guest meets a wallet that already has a Cozmling. The player must choose; nothing is overwritten.
3. All entries at once (a browser that has used several wallets).
4. Over 100 notes: 120 copies of `note-full` with rising rounds. The highest round must win.

Wallet addresses are valid Algorand addresses made from fixed text seeds. No keys exist for them, and they hold nothing.
