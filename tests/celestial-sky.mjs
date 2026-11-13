/* A Cozmling's birth sky in a real browser: read at hatch, saved for good, shown in the Star Loft and
   the observatory; cusp birthdays; first-version Cozmlings only when asked; the astronomy failing to
   load; phones, the keyboard and reduced motion. Nothing here touches Algorand or a wallet.

   It needs Playwright (not one of the site's dependencies) and a dev server with v2 switched on:
     VITE_COZMLING_V2=1 VITE_COZMLING_DEV=1 npm run dev -- --port 5198
     SITE=http://localhost:5198 node tests/celestial-sky.mjs [folder for screenshots]
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
const PHONE = { width: 390, height: 844 }, SMALL = { width: 360, height: 740 }, DESK = { width: 1280, height: 900 }
const HOME = new URL(SITE).hostname
/** The astronomy, wherever it is served from: the dev server's own files, or the built chunk on a deployed site. */
const ENGINE_FILES = /astronomy-engine|\/celestial\/engine\.ts|\/static\/engine-[\w-]+\.js/

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), ...(process.env.PW_PROXY ? { proxy: { server: process.env.PW_PROXY } } : {}) })
const results = []

async function profile({ seed = [], viewport = PHONE, reducedMotion = 'no-preference', block = null } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion })
  const errors = []
  await ctx.route(u => !['localhost', '127.0.0.1', HOME].includes(new URL(u).hostname), r => r.abort())
  if (block) await ctx.route(block, r => r.abort())
  await ctx.addInitScript(entries => {
    if (localStorage.getItem('__seeded')) return
    for (const [k, v] of entries) localStorage.setItem(k, v)
    localStorage.setItem('__seeded', '1')
  }, seed)
  const open = async (hash = '#/cozmling') => {
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource|Failed to fetch dynamically imported module|error loading dynamically imported module/.test(m.text())) errors.push(m.text()) })
    await page.goto(`${SITE}/${hash}`)
    await page.waitForFunction(() => window.__cozmling?.getState().status === 'ready', null, { timeout: 20000 })
    return page
  }
  return { ctx, open, errors }
}
const button = (page, name) => page.getByRole('button', { name, exact: true })
const mine = page => page.evaluate(() => { const s = window.__cozmling.getState(); return JSON.parse(JSON.stringify(s.companions.find(c => c.companionId === s.selectedId))) })
const stored = (page, id) => page.evaluate(id => new Promise((res, rej) => {
  const r = indexedDB.open('cozmc-cozmling-v2'); r.onerror = () => rej(r.error)
  r.onsuccess = () => { const q = r.result.transaction('companions').objectStore('companions').get(id); q.onsuccess = () => { r.result.close(); res(q.result) } }
}), id)
const shot = async (page, name, full = false) => { if (SHOTS) { await page.waitForTimeout(400); await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full }) } }
const sticksOut = page => page.evaluate(() => [...document.querySelectorAll('main *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) }).map(el => `${el.tagName.toLowerCase()}.${String(el.className.baseVal ?? el.className).split(' ')[0]} ${Math.round(el.getBoundingClientRect().right)}`).slice(0, 5))
async function adopt(page, { birthday = '2026-05-05', name = 'Orbi' } = {}) {
  await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor({ timeout: 15000 })
  await page.locator('#sl-bday').fill(birthday)
  await button(page, 'Next').click(); await button(page, 'Next').click()
  await page.locator('#sl-name').fill(name)
  await button(page, 'Create the Star Egg').click()
  await button(page, 'Warm the egg').waitFor({ timeout: 10000 })
}
async function scenario(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return
  const t0 = Date.now()
  try { await fn(); results.push(true); console.log(`ok   ${name} (${Math.round((Date.now() - t0) / 1000)}s)`) }
  catch (e) { results.push(false); console.log(`FAIL ${name}\n     ${String(e?.message ?? e).split('\n').slice(0, 8).join('\n     ')}`) }
}

await scenario('hatching reads its birth sky: Sun, Moon and Rising in the Starprint, saved for good, the same after care and a reload', async () => {
  const p = await profile(), page = await p.open()
  await adopt(page)
  assert.match(await page.locator('.sl-print').innerText(), /birth sky is read the minute it hatches/)
  const egg = await mine(page)
  assert.equal(egg.celestial, undefined); assert.equal(egg.starprint.status, 'partial'); assert.equal(egg.starprint.engineVersion, 'cozmc-celestial-1')
  for (let i = 0; i < 4; i++) await button(page, 'Warm the egg').click()
  await button(page, 'Play').waitFor()
  await page.waitForFunction(() => /Sun in Taurus, Moon in \w+/.test(document.querySelector('.sl__say')?.textContent ?? ''), null, { timeout: 8000 })
  const c = await mine(page), sky = c.celestial
  assert.equal(sky.kind, 'birth'); assert.equal(sky.rule, 'chosen-day-hatch-minute'); assert.equal(sky.moment.birthday, '2026-05-05'); assert.equal(sky.moment.hatchedAt, c.hatch.hatchedAt)
  assert.equal(Object.keys(sky.bodies).length, 10); assert.ok(sky.angles && sky.houses.length === 12)
  assert.equal(sky.birthplace.place, 'Mauna Kea, Hawaii'); assert.equal(sky.birthplace.timeZone, 'Pacific/Honolulu')
  // the birth moment: May 5 on the observatory's clock, at the time of day it hatched there
  const hst = ms => new Date(ms - 10 * 3_600_000).toISOString()
  assert.equal(hst(sky.moment.ms).slice(0, 10), '2026-05-05'); assert.equal(hst(sky.moment.ms).slice(11, 19), hst(Math.floor(c.hatch.hatchedAt / 1000) * 1000).slice(11, 19))
  assert.equal(c.starprint.status, 'calculated'); assert.equal(c.starprint.moon, sky.bodies.moon.sign); assert.equal(c.starprint.rising, sky.angles.ascendant.sign)
  const panel = await page.locator('.sl-print').innerText()
  assert.match(panel, /SUN\s+\S*\s*Taurus/i); assert.match(panel, /MOON/); assert.match(panel, /RISING/)
  await shot(page, 'sky-starprint-390')
  // care doesn't touch it; a reload brings back exactly the same sky
  await button(page, 'Play').click(); await button(page, 'Pat').click()
  await page.waitForFunction(() => window.__cozmling.getState().companions[0].revision >= 3)
  await page.reload(); await page.waitForFunction(() => window.__cozmling?.getState().status === 'ready')
  assert.deepEqual((await mine(page)).celestial, sky)
  assert.deepEqual((await stored(page, c.companionId)).celestial, sky)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('the observatory: the wheel, every placement, readings by tap and by keyboard, nothing cut off on a 360 px phone', async () => {
  const p = await profile({ viewport: SMALL }), page = await p.open()
  await adopt(page)
  await button(page, 'Hatch now').click(); await button(page, 'Play').waitFor()
  await page.waitForFunction(() => !!window.__cozmling.getState().companions[0].celestial)
  await page.getByRole('link', { name: 'Open its birth sky' }).click()
  await page.locator('.sk-wheel').waitFor()
  const sky = (await mine(page)).celestial
  assert.match(await page.locator('h1').innerText(), /ORBI’S BIRTH SKY/i)
  assert.match(await page.locator('.sk-when').innerText(), /^Born May 5, 2026.*Origin Observatory on Mauna Kea \(Hawaii time\)/)
  assert.equal(await page.locator('.sk-wheel').getAttribute('role'), 'img')
  assert.equal(await page.locator('.sk-table tbody tr').count(), 12)
  assert.equal(await page.locator('.sk-w-pl').count(), 10)
  assert.match(await page.locator('.sk-reading h2').innerText(), /SUN IN TAURUS/i)
  // a tap on the Moon in the wheel
  await page.locator('.sk-w-pl').nth(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'].map(b => sky.bodies[b].lon - sky.angles.ascendant.lon).map(a => ((a % 360) + 360) % 360).map((a, i) => [a, i]).sort((x, y) => x[0] - y[0]).findIndex(([, i]) => i === 1)).click()
  assert.match(await page.locator('.sk-reading h2').innerText(), /^MOON IN /i)
  // the keyboard: the table's buttons, then an aspect
  await page.getByRole('button', { name: /Rising$/ }).focus(); await page.keyboard.press('Enter')
  assert.match(await page.locator('.sk-reading h2').innerText(), / RISING$/i)
  assert.match(await page.locator('.sk-reading').innerText(), /symbolises the way it first meets the world/)
  await page.locator('.sk-list button').first().focus(); await page.keyboard.press('Enter')
  assert.match(await page.locator('.sk-reading p').first().innerText(), /apart, .* from an exact /)
  if (sky.aspects.length > 8) { await page.getByRole('button', { name: `Show all ${sky.aspects.length}` }).click(); assert.equal(await page.locator('.sk-o4 .sk-list li').count(), sky.aspects.length) }
  assert.match(await page.locator('.sk-about').innerText(), /fictional place[\s\S]*19\.8207° N, 155\.4681° W[\s\S]*Tropical[\s\S]*Whole-sign[\s\S]*Nothing: every part of this chart could be worked out/)
  assert.deepEqual(await sticksOut(page), [])
  await shot(page, 'sky-observatory-360', true)
  await page.getByRole('link', { name: '← Back to the Star Loft' }).click()
  await button(page, 'Play').waitFor()
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('the observatory on a desktop, and with reduced motion nothing moves', async () => {
  const p = await profile({ viewport: DESK, reducedMotion: 'reduce' }), page = await p.open()
  await adopt(page, { birthday: '2026-11-05' })
  await button(page, 'Hatch now').click(); await button(page, 'Play').waitFor()
  await page.goto(`${SITE}/#/cozmling/sky`); await page.locator('.sk-wheel').waitFor()
  const box = await page.locator('.sk-wheel').boundingBox()
  assert.ok(box.width > 400 && box.width <= 600, `wheel ${box.width}px`)
  assert.deepEqual(await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.constructor.name !== 'CSSTransition' && a.effect?.target?.closest?.('.sk-page')).length), 0)
  assert.deepEqual(await sticksOut(page), [])
  await shot(page, 'sky-observatory-1280', true)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('a cusp birthday says so: the Sun changes sign that day, and the hatch minute will decide', async () => {
  const p = await profile(), page = await p.open()
  await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor()
  let found = null
  for (const day of ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23']) {
    await page.locator('#sl-bday').fill(day)
    await page.waitForFunction(() => !!document.querySelector('.sl-hint')?.textContent)
    await page.waitForTimeout(150)
    if (/cusp day/.test(await page.locator('.sl-hint').innerText())) { found = day; break }
  }
  assert.ok(found, 'one of these days is a cusp day')
  assert.match(await page.locator('.sl-hint').innerText(), /moves from Scorpio into Sagittarius at \d{1,2}:\d{2} (am|pm) Mauna Kea time/)
  await shot(page, 'sky-cusp-390')
  await p.ctx.close()
})

await scenario('first-version Cozmlings: nothing is read unless asked; a recorded hatch gives its birth sky, an unknown one an awakening', async () => {
  const cadet = fx('wallet-cadet'), raw = JSON.parse(cadet.raw)
  const restored = { ...raw, name: 'Pip', hatched: raw.born }                                   // as a wallet restore leaves it: no real hatch time
  const p = await profile({ seed: [[cadet.storageKey, cadet.raw], ['cozmc-cozmling-v1', JSON.stringify(restored)]], viewport: DESK }), page = await p.open()
  await page.locator('.sl-hero h1').waitFor()
  const st = await page.evaluate(() => JSON.parse(JSON.stringify(window.__cozmling.getState())))
  assert.ok(st.companions.every(c => !c.celestial), 'no sky is read for a first-version Cozmling by itself')
  // the restored guest shows first (as on the old page); it can only be given an awakening sky
  assert.match(await page.locator('.sl-skyask').innerText(), /never recorded[\s\S]*awakening sky/)
  assert.equal(await page.getByRole('button', { name: /Read Pip’s sky/ }).count(), 0)
  await page.getByRole('button', { name: 'Give Pip an awakening sky' }).click()
  await page.waitForFunction(() => { const s = window.__cozmling.getState(); return !!s.companions.find(c => c.companionId === s.selectedId)?.celestial })
  const pip = await mine(page)
  assert.equal(pip.celestial.kind, 'awakening'); assert.equal(pip.celestial.rule, 'awakening-moment'); assert.equal(pip.celestial.moment.hatchedAt, null)
  assert.deepEqual(pip.legacy.pet, (st.companions.find(c => c.companionId === pip.companionId)).legacy.pet, 'nothing else about it changed')
  assert.match(await page.locator('.sl-print').innerText(), /AWAKENING SKY/i)
  await page.goto(`${SITE}/#/cozmling/sky`); await page.locator('.sk-wheel').waitFor()
  assert.match(await page.locator('h1').innerText(), /PIP’S AWAKENING SKY/i)
  assert.match(await page.locator('.sk-about').innerText(), /Birth sky: The moment Pip hatched was never recorded/)
  // the other one hatched at a recorded moment: its real birth sky, read at that moment
  await page.goto(`${SITE}/#/cozmling`); await page.locator('.sl-hero h1').waitFor()
  await page.getByRole('region', { name: 'Your Cozmlings' }).getByRole('button', { name: new RegExp(raw.name) }).click()
  await page.getByRole('button', { name: `Read ${raw.name}’s sky` }).click()
  await page.waitForFunction(n => { const s = window.__cozmling.getState(), c = s.companions.find(x => x.companionId === s.selectedId); return c?.legacy?.pet.name === n && !!c.celestial }, raw.name)
  const it = await mine(page)
  assert.equal(it.celestial.kind, 'birth'); assert.equal(it.celestial.rule, 'hatch-moment'); assert.equal(it.celestial.moment.ms, Math.floor(raw.hatched / 1000) * 1000)
  assert.equal(it.celestial.moment.birthday, null)
  const v1 = JSON.parse(await page.evaluate(k => localStorage.getItem(k), cadet.storageKey))
  assert.equal(v1.celestial, undefined, 'the first version’s own save is left exactly as it was')
  await shot(page, 'sky-first-version-1280', true)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('if the astronomy can’t load, the egg still hatches; its sky is read from its record as soon as it can be', async () => {
  const p = await profile({ block: ENGINE_FILES }), page = await p.open()
  await adopt(page)                                                  // the calendar's sign stands in while the astronomy is missing
  await button(page, 'Hatch now').click(); await button(page, 'Play').waitFor()
  const c = await mine(page)
  assert.equal(c.hatch.status, 'hatched'); assert.equal(c.celestial, undefined)
  assert.match(await page.locator('.sl-print').innerText(), /Reading the sky it was born under/)
  await p.ctx.unroute(ENGINE_FILES)
  const later = await p.open()
  await later.waitForFunction(() => !!window.__cozmling.getState().companions[0].celestial, null, { timeout: 15000 })
  const read = await mine(later)
  assert.equal(read.celestial.moment.hatchedAt, c.hatch.hatchedAt); assert.ok(read.celestial.calculatedAt > c.hatch.hatchedAt)
  assert.equal(read.celestial.moment.birthday, '2026-05-05')
  await p.ctx.close()
})

await scenario('an adventurer from before skies existed, opened straight at the observatory, gets its sky from its record', async () => {
  const p = await profile({ viewport: DESK }), page = await p.open()
  const id = await page.evaluate(async () => {
    const s = window.__cozmling, now = Date.now(), hatchedAt = now - 86_400_000
    const c = { schemaVersion: 2, kind: 'adventurer', companionId: 'preview-old-0001', revision: 0, createdAt: hatchedAt - 60_000, updatedAt: hatchedAt, hatch: { status: 'hatched', hatchedAt, provenance: 'known' }, walletLinks: [],
      name: 'Kip', starprint: { chosenBirthday: '2026-05-05', coreSign: 'taurus', element: 'earth', archetype: 'Keeper', status: 'partial', engineVersion: 'calendar-1' },
      appearance: { rendererVersion: 'layers-1', appearanceOption: 'b', skin: 'rose', outfit: 'starter', home: 'loft', decor: [] },
      care: { food: 80, fun: 80, energy: 90, asleepAt: null, settledAt: hatchedAt, ruleVersion: 'v1-care' }, progress: { experience: 0, visualStageVersion: 'fixture-1', visualStage: 'hatchling', counters: {} } }
    await s.commit(c, null); await s.select(c.companionId)
    return c.companionId
  })
  await page.goto(`${SITE}/#/cozmling/sky`)
  await page.locator('.sk-wheel').waitFor({ timeout: 15000 })
  const c = await mine(page)
  assert.equal(c.companionId, id); assert.equal(c.celestial.rule, 'chosen-day-hatch-minute'); assert.equal(c.celestial.moment.hatchedAt, c.hatch.hatchedAt)
  assert.equal((await page.evaluate(id => window.__cozmling.events(id), id)).filter(e => e.type === 'sky-read').length, 1)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await browser.close()
console.log(`\n${results.filter(Boolean).length} of ${results.length} browser scenarios passed`)
process.exit(results.every(Boolean) ? 0 : 1)
