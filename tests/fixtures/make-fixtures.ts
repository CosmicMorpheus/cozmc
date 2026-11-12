/* Regenerates fixtures/legacy-local-v1.json and legacy-chain-notes-v1.json from the site's real v1 code.
   From the repo root:  npx tsx tests/fixtures/make-fixtures.ts tests/fixtures [path/to/care.ts]
   The `expect` blocks are what the CURRENT v1 parser returns, including its known defects. */
import { createHash, randomBytes } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
const store = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, String(v)), removeItem: (k: string) => store.delete(k) }
import { pathToFileURL } from 'node:url'
const care = await import(pathToFileURL(process.argv[3] ?? 'src/companion/care.ts').href)
const out = process.argv[2]
mkdirSync(out, { recursive: true })

// valid Algorand addresses from fixed seeds (deterministic, never funded, no keys kept)
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const b32 = (buf: Buffer) => { let bits = 0, v = 0, s = ''; for (const b of buf) { v = (v << 8) | b; bits += 8; while (bits >= 5) { s += B32[(v >>> (bits - 5)) & 31]; bits -= 5 } } if (bits) s += B32[(v << (5 - bits)) & 31]; return s }
const addr = (seed: string) => { const pk = createHash('sha256').update('cozmc-fixture:' + seed).digest(); const ck = createHash('sha512-256').update(pk).digest().subarray(28); return b32(Buffer.concat([pk, ck])) }
const W = { sprout: addr('sprout'), cadet: addr('cadet'), explorer: addr('explorer'), guardian: addr('guardian'), asleep: addr('asleep'), conflict: addr('conflict'), oldlook: addr('oldlook') }

const NOW = Date.UTC(2026, 10, 12, 18, 0, 0)          // fixed clock for reproducible results
const D = 86_400_000, H = 3_600_000
const look = (form: 'boy' | 'girl', body: number, glow: number, eyes: number) => ({ form, body, glow, eyes })
const base = (name: string, l: any, home: any, born: number, hatched: number | null, c: Partial<any>) => ({ v: 1, name, look: l, home, born, hatched, food: 70, fun: 60, energy: 80, at: NOW - 2 * H, asleep: null, fed: 0, played: 0, pets: 0, ...c })

type Fx = { id: string; storageKey: string; raw: string; expect: any; notes: string }
const fx: Fx[] = []
const add = (id: string, key: string, rec: any, notes: string, rawOverride?: string) => {
  const raw = rawOverride ?? JSON.stringify(rec)
  store.set(key, raw)
  const parsed = key.includes(':') ? care.load(key.split(':')[1]) : care.loadGuest()
  const expect = parsed ? { parses: true, name: parsed.name, look: parsed.look, home: parsed.home, hatched: !!parsed.hatched, stage: care.stageOf(parsed), growthPoints: care.growthPoints(parsed), counters: { fed: parsed.fed, played: parsed.played, pets: parsed.pets, arcade: parsed.arcade ?? 0, cheered: parsed.cheered ?? 0, checkins: parsed.checkins ?? 0 } } : { parses: false }
  fx.push({ id, storageKey: key, raw, expect, notes })
}
const K = 'cozmc-cozmling-v1'
add('guest-egg', K, base('Pip', look('boy', 0, 0, 0), 'loft', NOW - 3 * D, null, { food: 80, fun: 80, energy: 90 }), 'Guest Star Egg, never hatched. Must stay an egg after migration.')
add('guest-hatched-sprout', K + ':__unused', null, 'placeholder', 'null')   // removed below
fx.pop(); store.delete(K + ':__unused')
add('wallet-sprout', `${K}:${W.sprout}`, base('Nova', look('girl', 2, 1, 1), 'loft', NOW - 5 * D, NOW - 5 * D + H, { fed: 5, played: 3, pets: 10, arcade: 2, cheered: 1, checkins: 1, owner: W.sprout }), 'Hatched Sprout (growth < 40).')
add('wallet-cadet', `${K}:${W.cadet}`, base('Comet', look('boy', 1, 4, 2), 'moonbase', NOW - 20 * D, NOW - 20 * D + H, { fed: 40, played: 30, pets: 50, arcade: 20, cheered: 10, checkins: 5, owner: W.cadet, txid: 'FIXTURETXIDCADET', round: 55000000 }), 'Cadet (40 ≤ growth < 200), with a chain backup reference.')
add('wallet-explorer', `${K}:${W.explorer}`, base('Orbit', look('girl', 5, 2, 3), 'grove', NOW - 60 * D, NOW - 60 * D + H, { fed: 120, played: 90, pets: 200, arcade: 60, cheered: 40, checkins: 12, owner: W.explorer }), 'Explorer (200 ≤ growth < 600).')
add('wallet-guardian', `${K}:${W.guardian}`, base('Atlas', look('boy', 7, 7, 4), 'loft', NOW - 120 * D, NOW - 120 * D + H, { fed: 300, played: 200, pets: 500, arcade: 150, cheered: 100, checkins: 30, owner: W.guardian }), 'Guardian (growth ≥ 600). Must never be demoted by any rebalance.')
add('wallet-asleep-low', `${K}:${W.asleep}`, base('Luna', look('girl', 3, 5, 0), 'moonbase', NOW - 10 * D, NOW - 10 * D + H, { food: 12, fun: 8, energy: 30, asleep: NOW - 6 * H, at: NOW - 6 * H, fed: 15, played: 8, pets: 9, arcade: 6, cheered: 1, checkins: 2, owner: W.asleep }), 'Asleep with low food/fun. Tests offline settle + sleep preservation.')
add('wallet-pre-alien-look', `${K}:${W.oldlook}`, base('Rusty', { form: 'girl' }, 'loft', NOW - 40 * D, NOW - 40 * D + H, { fed: 20, played: 10, pets: 10, owner: W.oldlook }), 'Saved before the alien redesign: look has no body/glow/eyes. Current parser upgrades it to the default girl look. Preserve the raw bytes; render as the parser does.')
add('wallet-malformed-missing-fields', `${K}:${W.conflict}`, null, 'Incomplete v1 record ({v:1} plus a name only). The CURRENT parser accepts it (known defect). v2 migration must QUARANTINE it, not "fix" it silently.', JSON.stringify({ v: 1, name: 'Ghost', look: { form: 'boy', body: 0, glow: 0, eyes: 0 } }))
add('wallet-bad-json', `${K}:${addr('badjson')}`, null, 'Corrupt JSON. Must be quarantined, never deleted, never crash the page.', '{"v":1,"name":"Brok')

// chain notes, exactly as toNote() writes them
const notes: any[] = []
const note = (id: string, owner: string, body: any, round: number, roundTime: number, notesTxt: string) => {
  const parsed = care.fromNote(body)
  notes.push({ id, sender: owner, receiver: owner, amount: 0, confirmedRound: round, roundTime, notePrefix: 'cozmc:pet:v1:', noteJson: body, expect: parsed ? { parses: true, name: parsed.name, hasState: !!parsed.state } : { parses: false }, notes: notesTxt })
}
const cadetPet = care.load(W.cadet)!
note('note-full', W.cadet, care.toNote(cadetPet), 55000000, Math.floor((NOW - D) / 1000), 'Full v1 note with needs (k), settle time (u) and sleep (z). Note: no hatch flag, so an EGG restored from a note comes back hatched (known defect).')
note('note-checkin', W.cadet, care.toNote(cadetPet, true), 55000100, Math.floor(NOW / 1000), 'Check-in note: has the day field "d". Past giveaway draws count these; readers must keep working.')
const old = care.toNote(cadetPet) as any; delete old.k; delete old.u; delete old.z
note('note-old-no-state', W.explorer, old, 54000000, Math.floor((NOW - 30 * D) / 1000), 'Older note written before needs/sleep were backed up. restore() starts it fresh and awake.')
note('note-bad-palette', W.sprout, { ...care.toNote(care.load(W.sprout)!), b: 63 }, 55000200, Math.floor(NOW / 1000), 'Palette index 63 (palettes have 8/8/5 colours). Current parser ACCEPTS it (known defect). v2 validator must reject or clamp with a recorded warning.')
const eggNote = care.toNote(care.loadGuest()!)
note('note-egg', W.asleep, eggNote, 55000300, Math.floor(NOW / 1000), 'A note written from an unhatched egg. restore() turns it into a hatched Cozmling (known defect). v2 must record hatch provenance as unknown, never fabricate a hatch.')

// restore results for reference
for (const n of notes) {
  const s = care.fromNote(n.noteJson)
  if (s) { const r = care.restore(n.sender, s, n.id, n.confirmedRound, NOW); n.expect.restoredStage = care.stageOf(r); n.expect.restoredHatched = r.hatched !== null }
}

writeFileSync(`${out}/legacy-local-v1.json`, JSON.stringify({ generatedFrom: 'src/companion/care.ts @ e407bdb8867bcb31543425e67a517a8ca2015ed9', clockMs: NOW, howToUse: 'Scenarios: (1) each entry alone in a fresh browser; (2) guest-egg + wallet-cadet in the same browser = guest meets a wallet that already has a Cozmling (must ask, never overwrite); (3) all entries at once (multi-wallet browser). Each entry is a localStorage key and its exact raw value. Load raw into a fake localStorage, run migration, compare to expect (computed by the CURRENT v1 parser). v2 must preserve stage, counters, look and home exactly; malformed entries must be quarantined.', fixtures: fx }, null, 2))
writeFileSync(`${out}/legacy-chain-notes-v1.json`, JSON.stringify({ generatedFrom: 'care.toNote/fromNote/restore @ e407bdb', clockMs: NOW, howToUse: 'Mock indexer transactions (0-ALGO self-payments). note bytes = utf8("cozmc:pet:v1:" + JSON.stringify(noteJson)), base64 in indexer responses. For the >100-notes test, generate 120 copies of note-full with rising rounds; the highest round must win.', notes }, null, 2))
console.log(fx.map(f => `${f.id}: ${JSON.stringify(f.expect.parses ? { stage: f.expect.stage, gp: f.expect.growthPoints, hatched: f.expect.hatched } : f.expect)}`).join('\n'))
console.log(notes.map(n => `${n.id}: ${JSON.stringify(n.expect)}`).join('\n'))
