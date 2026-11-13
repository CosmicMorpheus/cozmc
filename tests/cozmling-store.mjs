/* The Cozmling v2 save system in a real browser: IndexedDB, reloads, two tabs, a browser that
   stores nothing. Nothing here touches Algorand: every outside request is refused.

   It needs Playwright (not one of the site's dependencies) and a dev server with v2 switched on:
     VITE_COZMLING_V2=1 npm run dev -- --port 5198
     SITE=http://localhost:5198 node tests/cozmling-store.mjs [folder for screenshots]
   Set PW_CHROMIUM to a Chromium binary if Playwright's own isn't installed.                      */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const { chromium } = createRequire(import.meta.url)('playwright')

const SITE = process.env.SITE || 'http://localhost:5198'
const SHOTS = process.argv[2] || ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/legacy-local-v1.json', import.meta.url), 'utf8')).fixtures
const fx = id => fixtures.find(f => f.id === id)
const GOOD = ['guest-egg', 'wallet-sprout', 'wallet-cadet', 'wallet-explorer', 'wallet-guardian', 'wallet-asleep-low', 'wallet-pre-alien-look']
const STAGE = { egg: 'Star Egg', sprout: 'Sprout', cadet: 'Cadet', explorer: 'Explorer', guardian: 'Guardian' }

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const results = []

/** A fresh browser profile. `seed` = fixture ids to put in localStorage before the site first runs. */
async function profile({ seed = [], viewport = { width: 1280, height: 900 }, noStorage = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 })
  const errors = []
  await ctx.route(u => !['localhost', '127.0.0.1'].includes(new URL(u).hostname), r => r.abort())
  await ctx.addInitScript(({ entries, noStorage }) => {
    if (noStorage) {      // a browser that won't store anything
      Object.defineProperty(window, 'indexedDB', { get: () => undefined })
      const fail = () => { throw new DOMException('storage is off', 'SecurityError') }
      Object.defineProperty(window, 'localStorage', { get: () => ({ get length() { return fail() }, key: fail, getItem: fail, setItem: fail, removeItem: fail }) })
      return
    }
    if (localStorage.getItem('__seeded')) return
    for (const [k, v] of entries) localStorage.setItem(k, v)
    localStorage.setItem('__seeded', '1')
  }, { entries: seed.map(id => [fx(id).storageKey, fx(id).raw]), noStorage })
  const open = async (hash = '#/cozmling/dev') => {
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errors.push(m.text()) })
    await page.goto(`${SITE}/${hash}`)
    await page.waitForFunction(() => window.__cozmling?.getState().status === 'ready', null, { timeout: 20000 })
    if (hash.endsWith('/dev')) await page.locator('[data-dev="save"]').waitFor({ timeout: 20000 })
    return page
  }
  return { ctx, open, errors }
}
const state = page => page.evaluate(() => { const s = window.__cozmling.getState(); return JSON.parse(JSON.stringify(s)) })
const idb = page => page.evaluate(() => new Promise((res, rej) => {
  const r = indexedDB.open('cozmc-cozmling-v2')
  r.onerror = () => rej(r.error)
  r.onsuccess = () => {
    const tx = r.result.transaction(['companions', 'sources', 'events'], 'readonly'), out = {}
    for (const n of ['companions', 'sources', 'events']) { const q = tx.objectStore(n).getAll(); q.onsuccess = () => { out[n] = q.result } }
    tx.oncomplete = () => { r.result.close(); res(out) }
  }
}))
const byKey = (st, key) => st.companions.find(c => c.kind === 'legacy' && c.legacy.sourceKey === key && !c.archived)

async function scenario(name, fn) {
  const t0 = Date.now()
  try { await fn(); results.push(true); console.log(`ok   ${name} (${Math.round((Date.now() - t0) / 1000)}s)`) }
  catch (e) { results.push(false); console.log(`FAIL ${name}\n     ${String(e?.message ?? e).split('\n').slice(0, 6).join('\n     ')}`) }
}

await scenario('every first-version save is brought into IndexedDB as itself, and survives a reload', async () => {
  const p = await profile({ seed: fixtures.map(f => f.id) }), page = await p.open()
  const first = await state(page)
  assert.equal(first.durable, true); assert.equal(first.companions.length, 7); assert.equal(first.quarantined.length, 2); assert.equal(first.lastSync.migrated.length, 7)
  for (const id of GOOD) {
    const c = byKey(first, fx(id).storageKey)
    assert.ok(c, id)
    assert.equal(await page.locator(`[data-id="${c.companionId}"] [data-dev="stage"]`).textContent(), STAGE[fx(id).expect.stage], id)
    assert.deepEqual({ fed: c.legacy.pet.fed, played: c.legacy.pet.played, pets: c.legacy.pet.pets, arcade: c.legacy.pet.arcade ?? 0, cheered: c.legacy.pet.cheered ?? 0, checkins: c.legacy.pet.checkins ?? 0 }, fx(id).expect.counters, id)
  }
  // the v1 keys are untouched, byte for byte
  const raws = await page.evaluate(keys => keys.map(k => localStorage.getItem(k)), fixtures.map(f => f.storageKey))
  fixtures.forEach((f, i) => assert.equal(raws[i], f.raw, f.id))
  const stored = await idb(page)
  assert.equal(stored.companions.length, 7); assert.equal(stored.sources.length, 9); assert.equal(stored.events.length, 7)
  assert.ok(stored.sources.every(s => s.originalRaw === fx(fixtures.find(f => f.storageKey === s.sourceKey).id).raw))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dev-store-desktop.png`, fullPage: true })

  await page.reload()
  await page.waitForFunction(() => window.__cozmling?.getState().status === 'ready')
  const second = await state(page)
  assert.deepEqual(second.companions.map(c => [c.companionId, c.revision]).sort(), first.companions.map(c => [c.companionId, c.revision]).sort())
  assert.equal(second.selectedId, first.selectedId); assert.deepEqual(second.lastSync.migrated, []); assert.equal(second.quarantined.length, 2)
  assert.equal((await idb(page)).events.length, 7)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('a change is saved once, survives a reload, and the old page reads the same Cozmling', async () => {
  const p = await profile({ seed: ['guest-egg'] }), page = await p.open()
  const id = (await state(page)).companions[0].companionId
  // hatch the egg through the store (the new Star Loft will call exactly this)
  const res = await page.evaluate(id => window.__cozmling.updateLegacy(id, (pet, now) => ({ ...pet, hatched: now, at: now }), { eventId: `hatched:${id}`, type: 'hatched' }), id)
  assert.equal(res.ok, true); assert.equal(res.companion.revision, 1); assert.equal(res.companion.hatch.provenance, 'known')
  const after = await state(page)
  assert.ok(after.savedAt > 0); assert.equal(after.saveProblem, null)
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('cozmc-cozmling-v1'))), res.companion.legacy.pet)     // the v1 key now holds the same thing

  await page.reload()
  await page.waitForFunction(() => window.__cozmling?.getState().status === 'ready')
  const c = (await state(page)).companions[0]
  assert.equal(c.companionId, id); assert.equal(c.revision, 1); assert.equal(c.hatch.status, 'hatched')
  assert.equal(await page.locator('[data-dev="stage"]').textContent(), 'Sprout')
  // the Cozmling page shows the hatched Sprout. (With v2 on, that page is the new Star Loft. The first version's own
  // code reading this same save is covered by the unit tests, and by tests/journey.mjs run with v2 switched off.)
  await page.goto(`${SITE}/#/cozmling`)
  await page.getByText('Pip', { exact: false }).first().waitFor({ timeout: 15000 })
  assert.match(await page.locator('main').innerText(), /Sprout/)
  assert.doesNotMatch(await page.locator('main').innerText(), /waiting to hatch/i)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('two tabs: a change in one shows in the other, and neither overwrites the other', async () => {
  const p = await profile({ seed: ['wallet-cadet'] }), a = await p.open(), b = await p.open()
  const id = (await state(a)).companions[0].companionId
  await a.evaluate(id => window.__cozmling.updateLegacy(id, pet => ({ ...pet, fed: pet.fed + 1 })), id)
  await b.waitForFunction(id => window.__cozmling.getState().companions.find(c => c.companionId === id)?.revision === 1, id, { timeout: 10000 })
  const res = await b.evaluate(id => window.__cozmling.updateLegacy(id, pet => ({ ...pet, played: pet.played + 1 })), id)
  assert.equal(res.ok, true); assert.equal(res.companion.revision, 2)
  await a.waitForFunction(id => window.__cozmling.getState().companions.find(c => c.companionId === id)?.revision === 2, id, { timeout: 10000 })
  const end = (await idb(a)).companions[0]
  assert.equal(end.legacy.pet.fed, 41); assert.equal(end.legacy.pet.played, 31)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('two tabs opened at once on a first visit bring each save in once', async () => {
  const p = await profile({ seed: ['guest-egg', 'wallet-cadet', 'wallet-guardian'] })
  const [a, b] = await Promise.all([p.open(), p.open()])
  const stored = await idb(a)
  assert.equal(stored.companions.length, 3); assert.equal(stored.events.length, 3)
  assert.deepEqual((await state(a)).companions.map(c => c.companionId).sort(), (await state(b)).companions.map(c => c.companionId).sort())
  await p.ctx.close()
})

await scenario('a browser that stores nothing: it works for the visit and says it is not saved', async () => {
  const p = await profile({ noStorage: true }), page = await p.open()
  const st = await state(page)
  assert.equal(st.durable, false); assert.deepEqual(st.companions, [])
  assert.match(await page.locator('[data-dev="save"]').textContent(), /this visit only/)
  await p.ctx.close()
})

await scenario('the dev view fits a 390 px phone', async () => {
  const p = await profile({ seed: GOOD, viewport: { width: 390, height: 844 } }), page = await p.open()
  assert.equal(await page.locator('[data-dev="companions"] canvas').count(), 7)
  await page.waitForTimeout(600)          // let the rooms draw
  // nothing sticks out past the edge of the screen
  const wide = await page.evaluate(() => [...document.querySelectorAll('main *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 }).map(el => `${el.tagName.toLowerCase()} ${Math.round(el.getBoundingClientRect().right)}`))
  assert.deepEqual(wide.slice(0, 5), [])
  // every room has really been painted (a blank canvas would be a single colour)
  const painted = await page.evaluate(() => [...document.querySelectorAll('[data-dev="companions"] canvas')].map(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, seen = new Set(); for (let i = 0; i < d.length; i += 4 * 997) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); return seen.size }))
  assert.ok(painted.every(n => n > 8), `colours per canvas: ${painted}`)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/dev-store-390.png`, fullPage: true })
  await p.ctx.close()
})

await browser.close()
console.log(`\n${results.filter(Boolean).length} of ${results.length} browser scenarios passed`)
process.exit(results.every(Boolean) ? 0 : 1)
