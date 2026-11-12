/* Cozmling care, without a browser: `npm test`. localStorage is a small stand-in. */
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

const store = new Map<string, string>()
let broken = false   // a browser that refuses to store anything
const fail = () => { throw new Error('storage is off') }
;(globalThis as any).localStorage = {
  getItem: (k: string) => (broken ? fail() : store.get(k) ?? null),
  setItem: (k: string, v: string) => { if (broken) fail(); store.set(k, v) },
  removeItem: (k: string) => { if (broken) fail(); store.delete(k) },
}

const care = await import('../src/companion/care')
const { adopt, arcadeRun, cheer, claimFor, clearGuest, fromNote, growthPoints, guestKept, load, loadGuest, restore, save, saveGuest, settle, toNote } = care
const { DEFAULT_LOOK } = await import('../src/companion/look')

const GUEST_KEY = 'cozmc-cozmling-v1'
const WALLET = 'WALLETAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const H = 3_600_000, T0 = Date.UTC(2026, 10, 12, 12)
const look = { ...DEFAULT_LOOK.girl, body: 3, glow: 2, eyes: 1 }
const hatchedGuest = (at = T0) => ({ ...adopt('Nova', look, 'grove', at), hatched: at })

beforeEach(() => { broken = false; store.clear(); clearGuest() })

test('guest adopt: kept in this browser with no wallet, and found again', () => {
  assert.equal(loadGuest(), null)
  const p = adopt('Nova', look, 'grove', T0)
  saveGuest(p)
  assert.deepEqual(loadGuest(), p)
  assert.equal(p.owner, undefined); assert.equal(p.txid, undefined)
  assert.equal(p.born, T0); assert.equal(p.hatched, null)
  assert.deepEqual([...store.keys()], [GUEST_KEY])            // the only thing written, under the wallet-free key
  assert.equal(guestKept(), true)
  assert.deepEqual([...store.keys()], [GUEST_KEY])            // the storage check leaves nothing behind
})

test('guest: an egg needs nothing, however long it waits', () => {
  const later = settle(adopt('Nova', look, 'grove', T0), T0 + 72 * H)
  assert.deepEqual([later.food, later.fun, later.energy], [80, 80, 90])
})

test('settle across a day: needs run down while the tab is closed, and it naps when it runs out of energy', () => {
  saveGuest(hatchedGuest())
  const next = settle(loadGuest()!, T0 + 24 * H)
  assert.ok(next.food < 20 && next.food >= 0, `food ${next.food}`)   // hungry by now, never below empty
  assert.ok(next.fun < 20 && next.fun >= 0, `fun ${next.fun}`)
  assert.ok(next.asleep != null && next.asleep > T0 && next.asleep < T0 + 24 * H, 'dozed off by itself')
  assert.equal(next.energy, 100, 'and rested while asleep')
  assert.equal(next.at, T0 + 24 * H)
  assert.equal(next.name, 'Nova'); assert.equal(next.born, T0)
  // a short absence just lowers the bars
  const soon = settle(hatchedGuest(), T0 + 6 * H)
  assert.equal(soon.asleep, null)
  assert.equal(Math.round(soon.food), 55); assert.equal(Math.round(soon.fun), 50); assert.equal(Math.round(soon.energy), 57)
})

test('arcadeRun on a guest: Fun up, Energy and Food down, growth added, exactly as for a wallet Cozmling', () => {
  const guest = hatchedGuest(), mine = { ...hatchedGuest(), owner: WALLET, txid: 'TX', round: 5 }
  const g = arcadeRun(guest, { daily: false, best: false }, T0), w = arcadeRun(mine, { daily: false, best: false }, T0)
  assert.deepEqual([g.fun, g.energy, g.food], [10, -6, -4])
  assert.deepEqual([g.fun, g.energy, g.food], [w.fun, w.energy, w.food])
  assert.equal(g.pet.arcade, 1); assert.equal(g.pet.cheered, 1)
  assert.equal(growthPoints(g.pet), growthPoints(guest) + 4)
  assert.equal(growthPoints(g.pet), growthPoints(w.pet))
})

test('cheer: with no wallet the guest is cheered and saved; an egg or a sleeper is left alone', () => {
  assert.equal(cheer(null, { daily: false, best: false }, T0), null)   // nobody to cheer
  saveGuest(hatchedGuest())
  const out = cheer(null, { daily: true, best: false }, T0)!
  assert.equal(out.fun, 16)
  assert.equal(loadGuest()!.arcade, 1)
  assert.equal(Math.round(loadGuest()!.energy), 84)
  saveGuest({ ...hatchedGuest(), asleep: T0 })
  assert.equal(cheer(undefined, { daily: false, best: false }, T0 + 1000)!.fun, 0)
  assert.equal(loadGuest()!.arcade, undefined)
})

test('cheer: a connected wallet\'s Cozmling is the one cheered, and the guest is untouched', () => {
  saveGuest(hatchedGuest())
  save(WALLET, { ...hatchedGuest(), name: 'Zib', owner: WALLET })
  cheer(WALLET, { daily: false, best: false }, T0)
  assert.equal(load(WALLET)!.arcade, 1)
  assert.equal(loadGuest()!.arcade, undefined)
  // a wallet with no Cozmling in this browser yet: the guest still plays along
  cheer('OTHERWALLET', { daily: false, best: false }, T0)
  assert.equal(loadGuest()!.arcade, 1)
  assert.equal(load('OTHERWALLET'), null)
})

test('guest to wallet: name, look, home, birth date and care counts move across, then the guest copy is gone', () => {
  const guest = { ...hatchedGuest(), fed: 7, played: 4, pets: 12, arcade: 3, cheered: 2 }
  saveGuest(guest)
  assert.equal(claimFor(loadGuest(), false), 'save')
  // what the page does: settle, write the note, keep the wallet copy, drop the guest
  const now = T0 + 2 * H
  const moved = { ...settle(loadGuest()!, now), owner: WALLET, txid: 'TXID', round: 99 }
  const note = JSON.parse(JSON.stringify(toNote(moved)))
  save(WALLET, moved); clearGuest()

  assert.equal(loadGuest(), null)
  assert.equal(store.has(GUEST_KEY), false)
  const mine = load(WALLET)!
  for (const k of ['name', 'look', 'home', 'born', 'hatched', 'fed', 'played', 'pets', 'arcade', 'cheered'] as const) assert.deepEqual(mine[k], guest[k], k)
  assert.equal(mine.owner, WALLET); assert.equal(mine.txid, 'TXID')

  // and the note on Algorand carries the same Cozmling, in the format wallets already use
  assert.deepEqual(Object.keys(note).sort(), ['a', 'b', 'c', 'e', 'f', 'g', 'h', 'k', 'm', 'n', 'p', 's', 't', 'u', 'x', 'z'])
  const back = restore(WALLET, fromNote(note)!, 'TXID', 99, now)
  for (const k of ['name', 'look', 'home', 'born', 'fed', 'played', 'pets', 'arcade', 'cheered'] as const) assert.deepEqual(back[k], guest[k], k)
})

test('the wallet already has one: the guest is never saved over it without a choice', () => {
  const walletPet = { ...hatchedGuest(T0 - 30 * 24 * H), name: 'Zib', fed: 50, owner: WALLET, txid: 'OLD', round: 1 }
  save(WALLET, walletPet)
  saveGuest(hatchedGuest())
  assert.equal(claimFor(loadGuest(), !!load(WALLET)), 'choose')
  assert.equal(claimFor(null, true), 'none'); assert.equal(claimFor(null, false), 'none')
  // until the visitor chooses, both are exactly as they were
  assert.deepEqual(load(WALLET), walletPet)
  assert.equal(loadGuest()!.name, 'Nova')
  // keep the wallet's: only the guest goes
  clearGuest()
  assert.deepEqual(load(WALLET), walletPet); assert.equal(loadGuest(), null)
})

test('private browsing with storage off: the guest lasts for the visit, and the page can say so', () => {
  broken = true
  assert.equal(guestKept(), false)
  const p = hatchedGuest()
  saveGuest(p)                                   // must not throw
  assert.deepEqual(loadGuest(), p)
  assert.equal(cheer(null, { daily: false, best: false }, T0)!.fun, 10)
  assert.equal(loadGuest()!.arcade, 1)
  clearGuest()
  assert.equal(loadGuest(), null)
  assert.equal(store.size, 0)
})

test('rollback: the code from before guests reads a guest copy the way it read its own wallet-free Cozmling', () => {
  saveGuest({ ...hatchedGuest(), arcade: 2 })
  const raw = JSON.parse(store.get(GUEST_KEY)!)
  // the old reader: version 1 with a look that has a body, nothing else required
  assert.equal(raw.v, 1); assert.ok('body' in raw.look)
  const known = ['v', 'name', 'look', 'home', 'born', 'hatched', 'food', 'fun', 'energy', 'at', 'asleep', 'fed', 'played', 'pets', 'arcade', 'cheered', 'checkins', 'owner', 'txid', 'round', 'preview']
  for (const k of Object.keys(raw)) assert.ok(known.includes(k), `unexpected field ${k}`)
})

test('a stage preview left by the old prototype controls is dropped on load', () => {
  store.set(`${GUEST_KEY}:${WALLET}`, JSON.stringify({ ...hatchedGuest(), preview: 'guardian' }))
  assert.equal('preview' in load(WALLET)!, false)
  assert.equal(care.stageOf(load(WALLET)!), 'sprout')
})
