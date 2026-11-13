/* A Cozmling's sky in a real browser: its birth sky read at hatch, saved for good, shown in the Star
   Loft and the observatory; cusp birthdays; first-version Cozmlings only when asked; the astronomy
   failing to load; phones, the keyboard and reduced motion; the Cosmic Vortex behind it; and today's
   sky (read once a day, kept live, saved, offline, and a new day at the player's midnight).
   Nothing here touches Algorand or a wallet.

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

async function profile({ seed = [], viewport = PHONE, reducedMotion = 'no-preference', block = null, timezoneId = undefined } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion, ...(timezoneId ? { timezoneId } : {}) })
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
const mine = page => page.evaluate(() => {
  const s = window.__cozmling.getState(), c = s.companions.find(c => c.companionId === s.selectedId)
  if (!c) throw new Error(`no Cozmling is selected: ${JSON.stringify({ status: s.status, selectedId: s.selectedId, ids: s.companions.map(x => x.companionId) })}`)
  return JSON.parse(JSON.stringify(c))
})
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
  // the egg shows as soon as it is saved; it is recorded as the selected one a moment later
  await page.waitForFunction(() => { const s = window.__cozmling.getState(); return s.companions.some(c => c.companionId === s.selectedId) })
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
  assert.equal(egg.celestial, undefined); assert.equal(egg.starprint.status, 'partial'); assert.equal(egg.starprint.engineVersion, 'cozmc-celestial-2')
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

/* ---------------- the Cosmic Vortex behind the birth sky ---------------- */

const vortex = page => page.evaluate(() => {
  const cv = document.querySelector('.cv'), css = cv && getComputedStyle(cv), w = document.querySelector('.sk-wheel')?.getBoundingClientRect()
  return cv && { parent: cv.parentElement.tagName, state: cv.dataset.state, on: cv.classList.contains('is-on'), frames: +(cv.dataset.frames ?? 0), ms: +(cv.dataset.ms ?? 0), sphere: (cv.dataset.sphere ?? '').split(',').map(Number),
    position: css.position, z: css.zIndex, events: css.pointerEvents, hidden: cv.getAttribute('aria-hidden'), fallback: css.backgroundImage !== 'none',
    wheel: w && [w.left + w.width / 2, w.top + w.height / 2, w.width / 2] }
})
/** A few pixels from the canvas, in CSS pixels from the top left of the screen. */
const pixels = (page, points) => page.evaluate(points => {
  const c = document.querySelector('.cv canvas'), k = c.width / c.clientWidth, g = c.getContext('2d')
  return points.map(([x, y]) => [...g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data].slice(0, 3))
}, points)
const canvasPrint = page => page.evaluate(() => { const c = document.querySelector('.cv canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4 * 211) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return h })
async function toObservatory(p) {
  const page = await p.open()
  await adopt(page, { birthday: '2026-11-05' })
  await button(page, 'Hatch now').click(); await button(page, 'Play').waitFor()
  await page.goto(`${SITE}/#/cozmling/sky`); await page.locator('.sk-wheel').waitFor()
  await page.waitForFunction(() => document.querySelector('.cv')?.dataset.sphere, null, { timeout: 10000 })
  return page
}

await scenario('the cosmic vortex: behind everything, its sphere behind the chart, moving, and nothing on the page is blocked', async () => {
  const p = await profile({ viewport: DESK }), page = await toObservatory(p)
  await page.waitForTimeout(1500)
  const v = await vortex(page)
  assert.equal(v.parent, 'BODY'); assert.equal(v.position, 'fixed'); assert.equal(v.z, '-1'); assert.equal(v.events, 'none'); assert.equal(v.hidden, 'true')
  assert.equal(v.state, 'running'); assert.equal(v.on, true); assert.ok(v.fallback, 'a still CSS sky stands behind the canvas')
  // the sphere sits exactly behind the wheel: same centre, its rim just outside the wheel's outer ring
  assert.ok(Math.abs(v.sphere[0] - v.wheel[0]) <= 1 && Math.abs(v.sphere[1] - v.wheel[1]) <= 1, JSON.stringify(v))
  assert.ok(Math.abs(v.sphere[2] - (v.wheel[2] * 214 / 220 + 2)) <= 1, JSON.stringify(v))
  // the wheel is on top and still takes clicks
  assert.ok(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.sk-wheel'), v.wheel))
  await page.locator('.sk-w-pl').first().click()
  assert.match(await page.locator('.sk-reading h2').innerText(), / IN /)
  // it really is drawn: black behind the chart, gold in the disk beside it, and it moves
  const [centre] = await pixels(page, [[v.sphere[0], v.sphere[1]]])
  assert.ok(centre.every(x => x < 12), `the sphere is black: ${centre}`)
  // the disk beside the sphere: a share of the pixels there are warm gold (its rings are thin lines, so not most of them)
  const warm = await page.evaluate(([x, y, r]) => {
    const c = document.querySelector('.cv canvas'), k = c.width / c.clientWidth
    const x0 = Math.max(0, Math.round((x - r * 2.4) * k)), w = Math.round(r * 1.15 * k), y0 = Math.round((y - r * 0.3) * k), h = Math.round(r * 0.6 * k)
    const d = c.getContext('2d').getImageData(x0, y0, w, h).data
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 80 && d[i + 1] > 50 && d[i] > d[i + 2] * 1.3) n++
    return n / (d.length / 4)
  }, v.sphere)
  assert.ok(warm > 0.03, `gold in the disk beside the sphere: ${(warm * 100).toFixed(1)}% of pixels`)
  // still animating (its frame count is published every 30 frames, so a slow test machine gets a few seconds)
  const before = (await vortex(page)).frames
  await page.waitForFunction(n => +(document.querySelector('.cv')?.dataset.frames ?? 0) > n, before, { timeout: 5000 }).catch(() => assert.fail('still animating'))
  // it follows the chart as the page scrolls, and goes away (and stops) once the chart has gone by
  await page.evaluate(() => scrollBy(0, 400)); await page.waitForTimeout(300)
  const moved = await vortex(page)
  assert.ok(Math.abs(moved.sphere[1] - moved.wheel[1]) <= 1, 'still behind the wheel after scrolling')
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(1200)
  const away = await vortex(page)
  assert.equal(away.state, 'paused'); assert.equal(away.on, false)
  const stillFrames = away.frames
  await page.waitForTimeout(800)
  assert.equal((await vortex(page)).frames, stillFrames, 'no frames are drawn while it is away')
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(600)
  assert.equal((await vortex(page)).state, 'running')
  console.log(`     (drawing one frame: ${(await vortex(page)).ms} ms in this test browser, which draws without a graphics card)`)
  // it belongs to the observatory only: back in the Star Loft it is gone
  await page.getByRole('link', { name: '← Back to the Star Loft' }).click(); await button(page, 'Play').waitFor()
  assert.equal(await page.locator('.cv').count(), 0)
  await shot(page, 'vortex-loft-without-1280')
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('the cosmic vortex with reduced motion: one still frame that stays behind the chart, and nothing moves', async () => {
  const p = await profile({ viewport: PHONE, reducedMotion: 'reduce' }), page = await toObservatory(p)
  await page.waitForTimeout(400)
  const v = await vortex(page)
  assert.equal(v.state, 'static'); assert.equal(v.on, true)
  const a = await canvasPrint(page); await page.waitForTimeout(1200)
  assert.equal(await canvasPrint(page), a, 'the picture does not change by itself')
  await page.evaluate(() => scrollBy(0, 300)); await page.waitForTimeout(300)
  const after = await vortex(page)
  assert.ok(Math.abs(after.sphere[1] - after.wheel[1]) <= 1, 'redrawn behind the wheel after scrolling')
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('the cosmic vortex on a 360 px phone: the header, legend and panels stay readable and nothing sticks out', async () => {
  const p = await profile({ viewport: SMALL }), page = await toObservatory(p)
  await page.waitForTimeout(1200)
  assert.deepEqual(await sticksOut(page), [])
  const legend = await page.locator('.sk-legend').boundingBox()
  assert.ok(legend.x >= 0 && legend.x + legend.width <= 360)
  // text sits on dark: panels are nearly opaque, and the header has its own shade
  const shade = await page.evaluate(() => [getComputedStyle(document.querySelector('.sk-stage .panel')).backgroundColor, getComputedStyle(document.querySelector('.sk-head'), '::before').backgroundImage])
  assert.match(shade[0], /rgba\(4, 5, 11, 0\.8\d\)/); assert.match(shade[1], /radial-gradient/)
  await shot(page, 'vortex-observatory-360')
  await page.evaluate(() => scrollBy(0, 500)); await shot(page, 'vortex-observatory-360-scrolled')
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

/* ---------------- today's sky ---------------- */

const meta = (page, key) => page.evaluate(k => window.__cozmling.readMeta(k), key)
const ready = () => window.__cozmling?.getState().status === 'ready'
/** A hatched Cozmling with its birth sky, in the Star Loft. */
async function hatched(p, birthday = '2026-05-05') {
  const page = await p.open()
  await adopt(page, { birthday })
  await button(page, 'Hatch now').click(); await button(page, 'Play').waitFor()
  await page.waitForFunction(() => !!window.__cozmling.getState().companions[0].celestial)
  return page
}
const dayName = day => new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${day}T12:00:00Z`))
const dayBefore = day => new Date(Date.parse(`${day}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10)

await scenario('today’s sky: the Star Loft reads it by itself; the observatory shows the day’s reading and the sky now, with when it was worked out', async () => {
  const p = await profile({ viewport: DESK, timezoneId: 'America/New_York' }), page = await hatched(p)
  const c = await mine(page), key = `daily:${c.companionId}`
  // the Star Loft reads today's sky (once), saves it, and links to it
  const line = page.locator('.sl-today a'); await line.waitFor({ timeout: 15000 })
  const saved = await meta(page, key)
  assert.equal(saved.companionId, c.companionId); assert.equal(saved.timeZone, 'America/New_York'); assert.equal(saved.natalMoment, c.celestial.moment.ms)
  assert.equal(saved.day, await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())))
  assert.equal(new Date(saved.at).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }), '12:00 PM', 'read for midday, New York time')
  await line.click()
  await page.waitForURL(/#\/cozmling\/sky\/today$/); await page.locator('.sk-wheel').waitFor()
  assert.match(await page.locator('h1').innerText(), /ORBI’S SKY TODAY/i)
  assert.match(await page.locator('.sk-when').innerText(), new RegExp(`^${dayName(saved.day)}, where you are\\.`))
  assert.equal(await page.getByRole('link', { name: 'Today’s sky' }).getAttribute('aria-current'), 'page')
  assert.equal(await page.getByRole('link', { name: 'Birth sky' }).getAttribute('aria-current'), null)
  await page.waitForFunction(() => document.querySelector('.sk-live')?.dataset.state === 'live')
  assert.match(await page.locator('.sk-live').innerText(), /^LIVE · \d{1,2}:\d{2} (AM|PM)$/i)
  assert.match(await page.locator('.sk-tablebox').innerText(), /Worked out at \d{1,2}:\d{2} (am|pm), your time, and again every 10 minutes/)
  assert.equal((await meta(page, key)).calculatedAt, saved.calculatedAt, 'the day’s reading is the one saved, not read again')
  const n = saved.transits.length
  if (n) {
    assert.equal(await page.locator('.sk-transits li').count(), Math.min(n, 6))
    const first = await page.locator('.sk-transits li').first().innerText()
    assert.match(first, /Orbi’s/); assert.match(first, /exact \d{1,2}:\d{2} (am|pm)|\d+°\d\d′/)
    assert.match(await page.locator('.sk-reading h2').innerText(), /ORBI’S/i, 'the strongest transit is read first')
    assert.match(await page.locator('.sk-reading').innerText(), /A theme to play with, if it feels right\. It doesn’t decide anything\./)
    assert.equal(await page.locator('.sk-w-ghost').count(), 1, 'and drawn on the wheel')
  } else assert.match(await page.locator('.sk-o3').innerText(), /quiet sky/i)
  // a tap on today's Moon in the table
  await page.locator('.sk-tablebox').getByRole('button', { name: /Moon$/ }).click()
  assert.match(await page.locator('.sk-reading h2').innerText(), /^THE MOON IN \w+ TODAY$/i)
  assert.match(await page.locator('.sk-reading').innerText(), /passing through Orbi’s \d+(st|nd|rd|th) house/)
  assert.equal(await page.locator('.sk-w-ghost').count(), 0)
  assert.equal(await page.locator('.sk-tablebox tbody tr').count(), 10)
  assert.match(await page.locator('.sk-o4').innerText(), /The Moon is in \w+, [a-z ]+ and \d+% lit, passing through Orbi’s/)
  assert.match(await page.locator('.sk-about').innerText(), /astronomy-engine 2\.1\.19[\s\S]*doesn’t change Orbi’s needs, rewards or scores/)
  assert.deepEqual(await sticksOut(page), [])
  await shot(page, 'today-1280', true)
  // to the birth sky and back: the same vortex carries on behind both
  await page.evaluate(() => { document.querySelector('.cv').dataset.mark = 'same' })
  await page.getByRole('link', { name: 'Birth sky' }).click()
  await page.waitForURL(/#\/cozmling\/sky$/); await page.locator('.sk-reading h2').filter({ hasText: /SUN IN/i }).waitFor()
  assert.match(await page.locator('h1').innerText(), /ORBI’S BIRTH SKY/i)
  await page.waitForTimeout(500)
  const v = await vortex(page)
  assert.equal(await page.evaluate(() => document.querySelector('.cv')?.dataset.mark), 'same'); assert.equal(v.state, 'running')
  assert.ok(Math.abs(v.sphere[1] - v.wheel[1]) <= 1 && Math.abs(v.sphere[0] - v.wheel[0]) <= 1, 'behind the birth wheel')
  // once today's reading is saved, the Star Loft shows it without loading the astronomy at all
  const loft = await p.ctx.newPage(), asked = []
  loft.on('request', r => { if (ENGINE_FILES.test(r.url())) asked.push(r.url()) })
  await loft.goto(`${SITE}/#/cozmling`); await loft.waitForFunction(ready); await loft.locator('.sl-today a').waitFor()
  await loft.waitForTimeout(800)
  assert.deepEqual(asked, [])
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('today’s sky offline: today’s saved reading still shows, marked; an earlier day’s shows only with its day; back online, today’s is read', async () => {
  const p = await profile({ viewport: PHONE }), page = await hatched(p)
  const key = `daily:${(await mine(page)).companionId}`
  await page.locator('.sl-today a').waitFor({ timeout: 15000 })
  const saved = await meta(page, key)
  await p.ctx.route(ENGINE_FILES, r => r.abort())
  const off = await p.open('#/cozmling/sky/today')
  await off.locator('.sk-wheel').waitFor()
  await off.waitForFunction(() => document.querySelector('.sk-live')?.dataset.state === 'offline')
  assert.match(await off.locator('.sk-tablebox h2').innerText(), /midday/i)
  assert.match(await off.locator('.sk-about').innerText(), /can’t be worked out at the moment/)
  assert.equal(await off.locator('.sk-note').count(), 0, 'today’s reading is still today’s')
  assert.match(await off.locator('.sk-headline').innerText(), /^TODAY /i)
  if (saved.transits.length) assert.equal(await off.locator('.sk-transits li').count(), Math.min(saved.transits.length, 6))
  await shot(off, 'today-offline-390')
  // a reading from an earlier day, with the astronomy still missing: shown, labelled with its day, never as today's
  const before = dayBefore(saved.day)
  await off.evaluate(([k, v]) => window.__cozmling.writeMeta(k, v), [key, { ...saved, day: before }])
  const old = await p.open('#/cozmling/sky/today')
  await old.locator('.sk-note').waitFor()
  assert.match(await old.locator('.sk-note').innerText(), new RegExp(`couldn’t be worked out just now[\\s\\S]*Below is Orbi’s sky from ${dayName(before)}, the last one saved\\.`))
  assert.equal(await old.locator('.sk-headline').count(), 0, 'no headline is claimed for today')
  assert.match(await old.locator('.sk-tablebox h2').innerText(), new RegExp(`At midday on ${dayName(before)}`, 'i'))
  assert.match(await old.locator('.sl-id').innerText(), /^OFFLINE$/i, 'no Moon phase is claimed for today either')
  assert.match(await old.locator('.sk-o4').innerText(), /At midday the Moon was in /)
  if (saved.transits.length) assert.match(await old.locator('.sk-reading p').first().innerText(), new RegExp(`^On ${dayName(before)}, `))
  await shot(old, 'today-earlier-390', true)
  // the Star Loft doesn't pass it off as today's either
  await old.evaluate(() => { location.hash = '#/cozmling' }); await old.locator('.sl-today').waitFor()
  await old.waitForFunction(() => /can’t be read just now/.test(document.querySelector('.sl-today')?.textContent ?? ''))
  // back online: today's is read again and saved
  await p.ctx.unroute(ENGINE_FILES)
  const back = await p.open('#/cozmling/sky/today')
  await back.waitForFunction(() => document.querySelector('.sk-live')?.dataset.state === 'live', null, { timeout: 15000 })
  assert.equal((await meta(back, key)).day, saved.day)
  assert.equal(await back.locator('.sk-note').count(), 0)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('a new day begins at the player’s own midnight: an open page reads the new day’s sky by itself', async () => {
  const p = await profile({ viewport: DESK, timezoneId: 'America/New_York' })
  await p.ctx.clock.install({ time: new Date('2026-11-13T04:55:00Z') })           // 11:55 pm on Thursday in New York
  const page = await hatched(p, '2026-11-05')
  const key = `daily:${(await mine(page)).companionId}`
  await page.evaluate(() => { location.hash = '#/cozmling/sky/today' })
  await page.waitForFunction(() => document.querySelector('.sk-live')?.dataset.state === 'live' && !!document.querySelector('.sk-headline'), null, { timeout: 15000 })
  assert.match(await page.locator('.sk-when').innerText(), /^Thursday, November 12, where you are/)
  const thursday = await meta(page, key)
  assert.equal(thursday.day, '2026-11-12')
  await page.clock.fastForward('06:00')                                               // past midnight
  await page.waitForFunction(() => /^Friday, November 13/.test(document.querySelector('.sk-when')?.textContent ?? ''), null, { timeout: 10000 })
  const friday = await meta(page, key)
  assert.equal(friday.day, '2026-11-13'); assert.ok(friday.calculatedAt > thursday.calculatedAt)
  assert.equal(new Date(friday.at).toISOString(), '2026-11-13T17:00:00.000Z', 'midday in New York')
  assert.match(await page.locator('.sk-live').innerText(), /^LIVE · 12:0\d AM$/i)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('today’s sky on a 360 px phone: in reading order, and nothing sticks out', async () => {
  const p = await profile({ viewport: SMALL }), page = await hatched(p, '2026-11-05')
  await page.evaluate(() => { location.hash = '#/cozmling/sky/today' })
  await page.waitForFunction(() => document.querySelector('.sk-live')?.dataset.state === 'live' && !!document.querySelector('.sk-notes'), null, { timeout: 15000 })
  const ys = await page.evaluate(() => ['.sk-o1', '.sk-o2', '.sk-o3', '.sk-o4', '.sk-o5'].map(s => document.querySelector(s)?.getBoundingClientRect().top ?? null))
  assert.ok(ys.every(y => y != null) && ys.every((y, i) => i === 0 || y > ys[i - 1]), `wheel, reading, transits, the sky’s news, positions: ${ys}`)
  const tabs = await page.locator('.sk-tabs').boundingBox()
  assert.ok(tabs.x >= 0 && tabs.x + tabs.width <= 360)
  assert.deepEqual(await sticksOut(page), [])
  await shot(page, 'today-360', true)
  // picking something further down brings its reading into view
  await page.locator('.sk-tablebox').getByRole('button', { name: /Saturn$/ }).click()
  await page.waitForTimeout(700)
  const r = await page.locator('.sk-reading').boundingBox()
  assert.ok(r.y > -r.height && r.y < 740, `the reading is in view: ${r.y}`)
  assert.match(await page.locator('.sk-reading h2').innerText(), /^SATURN IN \w+ TODAY$/i)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

/* ---------------- today's story (MVP 3) ---------------- */

const storiesKept = (page, id) => page.evaluate(id => window.__cozmling.events(id).then(es => es.filter(e => e.type === 'story').map(e => ({ eventId: e.eventId, day: e.data.day }))), id)
/** Do what today's story invites, through the page's own buttons and links. */
async function takeUp(page, action) {
  if (action === 'feed') { await button(page, 'Feed').click(); await page.getByRole('menuitem', { name: /Comet cookie/ }).click() }
  else if (action === 'play') await button(page, 'Play').click()
  else if (action === 'pat') await button(page, 'Pat').click()
  else if (action === 'rest') await button(page, 'Rest').click()
  else if (action === 'observatory') {
    await page.locator('.sl-story__invite a').click()
    await page.waitForFunction(() => document.querySelector('.sk-live')?.dataset.state === 'live', null, { timeout: 15000 })
    await page.evaluate(() => { location.hash = '#/cozmling' })
    await page.locator('.sl-story h2').waitFor()
  } else throw new Error(`unexpected invitation: ${action}`)
}

await scenario('today’s story: written on the Cozmling’s page from its sky and its day, the same after a reload, kept once, and its invitation seen to be taken up', async () => {
  const p = await profile({ viewport: SMALL, timezoneId: 'America/New_York' }), page = await hatched(p)
  const id = (await mine(page)).companionId
  await page.locator('.sl-story h2').waitFor({ timeout: 15000 })
  const text = await page.locator('.sl-story').innerText(), day = await page.locator('.sl-story').getAttribute('data-day')
  assert.match(text, new RegExp(`^TODAY’S SKY · ${dayName(day)}`, 'i'))
  assert.match(text, /CELESTIAL INFLUENCE[\s\S]*Orbi’s/i)
  assert.match(text, /Orbi the Sprout/)
  assert.match(text, /Its happiness is at \d+%, and its sustenance is at \d+%\./)
  assert.match(text, /TODAY’S COSMIC INVITATION\s+“[^”]*Orbi[^”]*”/i)
  assert.match(text, /COZMC REFLECTION\s+“[^”]+”/i)
  assert.match(text, /A story to play with, not a prediction\. An invitation never changes rewards, scores or tokens\./)
  assert.deepEqual(await storiesKept(page, id), [{ eventId: `story:${id}:${day}`, day }])
  assert.deepEqual(await sticksOut(page), [])
  await shot(page, 'story-360', true)
  // opened again: the same story, and nothing new is written
  await page.reload(); await page.waitForFunction(ready); await page.locator('.sl-story h2').waitFor()
  assert.equal(await page.locator('.sl-story').innerText(), text)
  assert.equal((await storiesKept(page, id)).length, 1)
  // taking up the invitation: seen from what happened, with nothing rewarded
  const before = await mine(page)
  await takeUp(page, await page.locator('.sl-story__invite').getAttribute('data-action'))
  await page.waitForFunction(() => document.querySelector('.sl-story__invite')?.dataset.done === 'true', null, { timeout: 8000 })
  assert.match(await page.locator('.sl-story__status').innerText(), /Done\. Orbi noticed\./)
  assert.deepEqual(Object.keys(await mine(page)).sort(), Object.keys(before).sort(), 'no reward or new field appears on the Cozmling')
  assert.equal((await storiesKept(page, id)).length, 1, 'the story itself is never rewritten')
  // and it is one of its memories
  assert.match(await page.locator('.sl-memories__list').innerText(), /Orbi’s story: /)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('a new story at the player’s midnight, with the page open; yesterday’s is kept', async () => {
  const p = await profile({ viewport: DESK, timezoneId: 'America/New_York' })
  await p.ctx.clock.install({ time: new Date('2026-11-13T04:55:00Z') })                               // 11:55 pm on Thursday in New York
  const page = await hatched(p, '2026-11-05')
  const id = (await mine(page)).companionId
  await page.locator('.sl-story[data-day="2026-11-12"] h2').waitFor({ timeout: 15000 })
  await page.clock.fastForward('06:00')
  await page.locator('.sl-story[data-day="2026-11-13"] h2').waitFor({ timeout: 10000 })
  assert.match(await page.locator('.sl-story').innerText(), /^TODAY’S SKY · FRIDAY, NOVEMBER 13/i)
  assert.deepEqual((await storiesKept(page, id)).map(s => s.day), ['2026-11-12', '2026-11-13'])
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('offline: if today’s sky can’t be read, the last story is shown with its own day, never as today’s; back online, today’s is written', async () => {
  const p = await profile({ viewport: PHONE }), page = await hatched(p)
  const id = (await mine(page)).companionId
  await page.locator('.sl-story h2').waitFor({ timeout: 15000 })
  const today = await page.locator('.sl-story').getAttribute('data-day'), before = dayBefore(today)
  // as if today's sky and story had never been read, and the last story kept were yesterday's
  await page.evaluate(async ([id, today, before]) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('cozmc-cozmling-v2'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
    const tx = db.transaction(['events', 'meta'], 'readwrite'), events = tx.objectStore('events')
    const story = await new Promise(res => { const q = events.get(`story:${id}:${today}`); q.onsuccess = () => res(q.result) })
    events.delete(story.eventId)
    events.put({ ...story, eventId: `story:${id}:${before}`, at: story.at - 86_400_000, data: { ...story.data, day: before } })
    tx.objectStore('meta').delete(`daily:${id}`)
    await new Promise(res => { tx.oncomplete = res })
    db.close()
  }, [id, today, before])
  await p.ctx.route(ENGINE_FILES, r => r.abort())
  const off = await p.open('#/cozmling')
  await off.locator('.sl-story__note').waitFor({ timeout: 15000 })
  assert.match(await off.locator('.sl-story').innerText(), new RegExp(`^ORBI’S LAST STORY · ${dayName(before)}`, 'i'))
  assert.match(await off.locator('.sl-story__note').innerText(), new RegExp(`can’t be written just now[\\s\\S]*last one, from ${dayName(before)}`))
  assert.match(await off.locator('.sl-today').innerText(), /can’t be read just now/)
  await shot(off, 'story-offline-390')
  await p.ctx.unroute(ENGINE_FILES)
  const back = await p.open('#/cozmling')
  await back.locator(`.sl-story[data-day="${today}"] h2`).waitFor({ timeout: 15000 })
  assert.equal(await back.locator('.sl-story__note').count(), 0)
  assert.deepEqual((await storiesKept(back, id)).map(s => s.day).sort(), [before, today])
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

/* ---------------- where it was born ---------------- */

const ATLAS = /places\/cities\.json|\/static\/cities-[\w-]+\.js/

await scenario('birthplace: the COZMC default comes chosen; a place by search, or a surprise and another; its sky is read over that place, kept and shown; the player’s location is never asked for', async () => {
  const p = await profile({ viewport: DESK, timezoneId: 'America/New_York' })
  await p.ctx.addInitScript(() => { window.__geo = 0; try { Object.defineProperty(Navigator.prototype, 'geolocation', { configurable: true, get() { window.__geo++; return undefined } }) } catch {} })
  const page = await p.open()
  await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor({ timeout: 15000 })
  await page.locator('#sl-bday').fill('2026-05-05')
  // the default is already chosen, and explained
  assert.equal(await page.getByRole('radio', { name: /Use COZMC Default/ }).isChecked(), true)
  assert.match(await page.locator('.sl-bp__card').innerText(), /The Origin Observatory · Mauna Kea, Hawaii[\s\S]*19\.82° N, 155\.47° W/)
  assert.match(await page.locator('.sl-bp').innerText(), /completely optional[\s\S]*never asks where you are/)
  // a surprise, and another
  await page.getByRole('radio', { name: /Surprise Me!/ }).check()
  await page.locator('.sl-bp__card').filter({ hasNotText: 'Origin Observatory' }).waitFor({ timeout: 15000 })
  const first = await page.locator('.sl-bp__where').innerText()
  await page.getByRole('button', { name: 'Another place', exact: true }).click()
  await page.waitForFunction(f => document.querySelector('.sl-bp__where')?.textContent !== f, first)
  // a place by search: Next waits until one is picked
  await page.getByRole('radio', { name: /Choose a Place/ }).check()
  await page.locator('#sl-bp-q').waitFor()
  assert.equal(await button(page, 'Next').isDisabled(), true)
  await page.locator('#sl-bp-q').fill('reykjav')
  await page.getByRole('button', { name: /^Reykjavík, Iceland/ }).click()
  assert.match(await page.locator('.sl-bp__card').innerText(), /Reykjavík · Iceland[\s\S]*64\.15° N, 21\.95° W · Atlantic\/Reykjavik/)
  assert.match(await page.locator('.sl-banner__k').innerText(), /BORN MAY 5 · REYKJAVÍK/i)
  await shot(page, 'birthplace-chosen-1280')
  await button(page, 'Next').click(); await button(page, 'Next').click()
  await page.locator('#sl-name').fill('Ari')
  assert.match(await page.locator('.sl-summary').innerText(), /BORN MAY 5 IN REYKJAVÍK, ICELAND/i)
  await button(page, 'Create the Star Egg').click(); await button(page, 'Warm the egg').waitFor()
  assert.match(await page.locator('.sl-print').innerText(), /BIRTHPLACE\s+Reykjavík[\s\S]*over Reykjavík, Iceland/i)
  await button(page, 'Hatch now').click(); await button(page, 'Play').waitFor()
  await page.waitForFunction(() => !!window.__cozmling.getState().companions[0].celestial)
  const c = await mine(page)
  assert.deepEqual([c.celestial.birthplace.name, c.celestial.birthplace.latitude, c.celestial.birthplace.timeZone, c.celestial.birthplace.choice], ['Reykjavík', 64.15, 'Atlantic/Reykjavik', 'chosen'])
  // born on its birthday, at the time of day it hatched, on Reykjavík's clock
  const hatchLocal = await page.evaluate(t => new Intl.DateTimeFormat('en-GB', { timeZone: 'Atlantic/Reykjavik', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(t)), Math.floor(c.hatch.hatchedAt / 1000) * 1000)
  assert.equal(c.celestial.moment.observatoryLocal, `2026-05-05T${hatchLocal}`)
  // kept for good, and shown
  await page.reload(); await page.waitForFunction(ready)
  assert.deepEqual((await mine(page)).celestial, c.celestial)
  await page.evaluate(() => { location.hash = '#/cozmling/sky' }); await page.locator('.sk-wheel').waitFor()
  assert.match(await page.locator('.sk-when').innerText(), /in Reykjavík, Iceland \(Reykjavík time\)/)
  assert.match(await page.locator('.sk-about').innerText(), /Reykjavík, Iceland \(a real place, chosen by its player\), at 64\.1500° N, 21\.9500° W, on Atlantic\/Reykjavik time/)
  assert.equal(await page.evaluate(() => window.__geo), 0, 'the player’s location is never read')
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('birthplace on a 360 px phone; and with the atlas unreachable, it says so and the COZMC default still works', async () => {
  const q = await profile({ viewport: SMALL }), page = await q.open()
  await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor({ timeout: 15000 })
  await page.locator('#sl-bday').fill('2026-11-05')
  await page.getByRole('radio', { name: /Choose a Place/ }).check()
  await page.locator('#sl-bp-q').fill('san')
  await page.locator('.sl-bp__results button').first().waitFor()
  assert.equal(await page.locator('.sl-bp__results li').count(), 8)
  assert.deepEqual(await sticksOut(page), [])
  await shot(page, 'birthplace-search-360', true)
  await q.ctx.close()

  const p = await profile({ viewport: SMALL, block: ATLAS }), off = await p.open()
  await off.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor({ timeout: 15000 })
  await off.locator('#sl-bday').fill('2026-11-05')
  await off.getByRole('radio', { name: /Choose a Place/ }).check()
  await off.locator('.sl-bp__problem').waitFor({ timeout: 15000 })
  assert.match(await off.locator('.sl-bp__problem').innerText(), /couldn’t be loaded \(are you offline\?\)[\s\S]*COZMC default/)
  assert.equal(await button(off, 'Next').isDisabled(), true)
  assert.deepEqual(await sticksOut(off), [])
  await off.getByRole('radio', { name: /Use COZMC Default/ }).check()
  await button(off, 'Next').click(); await button(off, 'Next').click()
  await off.locator('#sl-name').fill('Orbi'); await button(off, 'Create the Star Egg').click()
  await button(off, 'Hatch now').click(); await button(off, 'Play').waitFor()
  await off.waitForFunction(() => !!window.__cozmling.getState().companions[0].celestial)
  assert.equal((await mine(off)).celestial.birthplace.id, 'origin-observatory')
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await browser.close()
console.log(`\n${results.filter(Boolean).length} of ${results.length} browser scenarios passed`)
process.exit(results.every(Boolean) ? 0 : 1)
