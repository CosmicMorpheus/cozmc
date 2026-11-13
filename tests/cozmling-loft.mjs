/* The rebuilt Cozmling page in a real browser: adopt, hatch, look after, reload, with no wallet.
   Also: the keyboard alone, reduced motion, the original scene (recovered), a first-version Cozmling
   inside the new page, a browser that stores nothing, two tabs, and a 360 px phone.
   Nothing here touches Algorand or any wallet: every outside request is refused.

   It needs Playwright (not one of the site's dependencies) and a dev server with v2 and its
   preview tools switched on:
     VITE_COZMLING_V2=1 VITE_COZMLING_DEV=1 npm run dev -- --port 5198
     SITE=http://localhost:5198 node tests/cozmling-loft.mjs [folder for screenshots]
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
/** A saved first-version Cozmling, as if saved a minute ago. (Its needs run down with real time, so an
    old save would otherwise be found hungry or asleep, and a test of playing with it would depend on the date.) */
const fresh = raw => { const pet = JSON.parse(raw); return JSON.stringify({ ...pet, at: Date.now() - 60_000 }) }
const PHONE = { width: 390, height: 844 }, SMALL = { width: 360, height: 740 }, DESK = { width: 1280, height: 900 }

const browser = await chromium.launch({ ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}), ...(process.env.PW_PROXY ? { proxy: { server: process.env.PW_PROXY } } : {}) })
const HOME = new URL(SITE).hostname            // the site under test may be a deployed preview (set PW_PROXY if it is reached through a proxy)
const results = []

/** A fresh browser profile. */
async function profile({ seed = [], viewport = PHONE, noStorage = false, reducedMotion = 'no-preference', blockArt = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion })
  const errors = [], outside = []
  await ctx.route(u => !['localhost', '127.0.0.1', HOME].includes(new URL(u).hostname), r => { outside.push(`${r.request().method()} ${r.request().url()}`); return r.abort() })
  if (blockArt) await ctx.route('**/assets/cozmling/**', r => r.abort())
  await ctx.addInitScript(({ entries, noStorage }) => {
    // did the page ever offer adoption? (it must not, while a Cozmling that exists is still loading)
    window.__sawAdopt = false
    new MutationObserver(() => { if (/Adopt a Cozmling/.test(document.querySelector('main')?.textContent ?? '')) window.__sawAdopt = true }).observe(document, { subtree: true, childList: true, characterData: true })
    if (noStorage) {
      Object.defineProperty(window, 'indexedDB', { get: () => undefined })
      const fail = () => { throw new DOMException('storage is off', 'SecurityError') }
      Object.defineProperty(window, 'localStorage', { get: () => ({ get length() { return fail() }, key: fail, getItem: fail, setItem: fail, removeItem: fail }) })
      return
    }
    if (localStorage.getItem('__seeded')) return
    for (const [k, v] of entries) localStorage.setItem(k, v)
    localStorage.setItem('__seeded', '1')
  }, { entries: seed.map(id => [fx(id).storageKey, fresh(fx(id).raw)]), noStorage })
  const open = async (hash = '#/cozmling') => {
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errors.push(m.text()) })
    await page.goto(`${SITE}/${hash}`)
    await ready(page)
    return page
  }
  return { ctx, open, errors, outside }
}
const ready = page => page.waitForFunction(() => window.__cozmling?.getState().status === 'ready', null, { timeout: 20000 })
const state = page => page.evaluate(() => JSON.parse(JSON.stringify(window.__cozmling.getState())))
const mine = async page => { const s = await state(page); return s.companions.find(c => c.companionId === s.selectedId) }
const events = (page, id) => page.evaluate(id => window.__cozmling.events(id), id)
const button = (page, name) => page.getByRole('button', { name, exact: true })
/** Wait for the Cozmling's speech bubble to say something (it speaks once the change has really been saved). */
const says = (page, text) => page.waitForFunction(t => (document.querySelector('.sl__say')?.textContent ?? '').includes(t), text, { timeout: 8000 })
const shot = async (page, name, full = false) => { if (SHOTS) { await page.waitForTimeout(350); await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: full }) } }
/** Everything inside the page that sticks out past the edge of the screen. */
const sticksOut = page => page.evaluate(() => [...document.querySelectorAll('main *')].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) }).map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(el.getBoundingClientRect().right)}`).slice(0, 5))

/** Go through the three adoption steps with the mouse. */
async function adopt(page, { birthday = '2026-11-05', look = 'a', skin = '', name = 'Orbi' } = {}) {
  await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor({ timeout: 15000 })
  await page.locator('#sl-bday').fill(birthday)
  await button(page, 'Next').click()
  if (look === 'b') await page.getByRole('radio', { name: 'Look B' }).check()
  if (skin) await page.getByRole('radio', { name: skin }).check()
  await button(page, 'Next').click()
  await page.locator('#sl-name').fill(name)
  await button(page, 'Create the Star Egg').click()
  await button(page, 'Warm the egg').waitFor({ timeout: 10000 })
}

async function scenario(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return          // ONLY="keyboard" runs just the scenarios whose name has that word
  const t0 = Date.now()
  try { await fn(); results.push(true); console.log(`ok   ${name} (${Math.round((Date.now() - t0) / 1000)}s)`) }
  catch (e) { results.push(false); console.log(`FAIL ${name}\n     ${String(e?.message ?? e).split('\n').slice(0, 8).join('\n     ')}`) }
}

await scenario('a guest adopts, hatches and looks after a Cozmling, and it is all still there after a reload, with no wallet', async () => {
  const p = await profile(), page = await p.open()
  await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor()
  await shot(page, 'adopt-1-birthday-390', true)
  // step 1: the Cozmling's birthday, and the sign it gives
  assert.equal(await button(page, 'Next').isDisabled(), true)
  await page.locator('#sl-bday').fill('2026-11-05')
  assert.match(await page.locator('.sl-hint').innerText(), /November 5 falls under Scorpio/)
  assert.match(await page.locator('.sl-banner').innerText(), /SCORPIO/i)
  await button(page, 'Next').click()
  // step 2: its Starprint, a look and a skin colour
  assert.match(await page.locator('.sl-adopt').innerText(), /Scorpio.*water element, the Seeker/s)
  assert.doesNotMatch(await page.locator('.sl-adopt').innerText(), /\bMoon\b|Rising/)                 // nothing is made up
  await page.getByRole('radio', { name: 'Look B' }).check()
  await page.getByRole('radio', { name: 'Rose' }).check()
  await shot(page, 'adopt-2-starprint-390', true)
  await button(page, 'Next').click()
  // step 3: its name
  assert.equal(await button(page, 'Create the Star Egg').isDisabled(), true)
  await page.locator('#sl-name').fill('<O>r!b_i*')
  assert.equal(await page.locator('#sl-name').inputValue(), 'Orbi')                                    // cleaned as the first version cleans names
  assert.equal(await page.locator('#sl-name').getAttribute('maxlength'), '14')
  await shot(page, 'adopt-3-name-390', true)
  await button(page, 'Create the Star Egg').click()

  // a Star Egg in the Star Loft
  await button(page, 'Warm the egg').waitFor()
  assert.equal(await page.locator('.sl-hero h1').innerText(), 'ORBI')
  assert.match(await page.locator('.sl-hero').innerText(), /SCORPIO[\s\S]*WATER[\s\S]*THE SEEKER[\s\S]*STAR EGG/)
  assert.match(await page.locator('[data-save-chip]').innerText(), /SAVED ON THIS DEVICE/)
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1')                       // the keyboard starts at the top of the new page
  let c = await mine(page)
  const id = c.companionId
  assert.equal(c.kind, 'adventurer'); assert.equal(c.hatch.status, 'egg'); assert.equal(c.appearance.appearanceOption, 'b'); assert.equal(c.appearance.skin, 'rose')
  assert.deepEqual(c.starprint, { chosenBirthday: '2026-11-05', coreSign: 'scorpio', element: 'water', archetype: 'Seeker', status: 'partial', engineVersion: 'cozmc-celestial-1', observatoryVersion: 'origin-observatory-1' })   // from the real sky; final once it hatches
  assert.deepEqual(c.walletLinks, [])
  await shot(page, 'loft-egg-390')

  // warm it four times and it hatches, once
  for (let i = 0; i < 4; i++) await button(page, 'Warm the egg').click()
  await button(page, 'Play').waitFor()
  await says(page, 'Welcome to the world, Orbi!')
  assert.match(await page.locator('.sl-hero').innerText(), /SPROUT/)                                // the original creature's first stage
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'sl-feed-btn')                   // the egg's buttons are gone: the keyboard moves to Feed
  c = await mine(page)
  assert.equal(c.hatch.status, 'hatched'); assert.equal(c.hatch.provenance, 'known'); assert.equal(c.progress.visualStage, 'hatchling'); assert.equal(c.revision, 1)
  await page.waitForTimeout(1700)
  await shot(page, 'loft-hatched-390', true)

  // care, by the first version's numbers
  await button(page, 'Play').click()
  await says(page, 'Again, again!')
  await button(page, 'Feed').click()
  await page.getByRole('menuitem', { name: /Comet cookie/ }).click()
  await button(page, 'Pat').click()
  await page.waitForFunction(id => window.__cozmling.getState().companions.find(c => c.companionId === id)?.revision === 4, id)
  c = await mine(page)
  assert.deepEqual({ fed: c.progress.counters.fed, played: c.progress.counters.played, pets: c.progress.counters.pets }, { fed: 1, played: 1, pets: 1 })
  assert.ok(Math.abs(c.care.fun - 100) < 0.5 && Math.abs(c.care.food - (80 - 4 + 12)) < 0.5 && Math.abs(c.care.energy - (90 - 8)) < 0.5, JSON.stringify(c.care))
  assert.equal(await page.locator('.sl-meter--fun [role="meter"]').getAttribute('aria-valuenow'), '100')
  await button(page, 'Rest').click()
  await button(page, 'Wake up').waitFor()
  assert.equal(await button(page, 'Play').isDisabled(), true)
  assert.match(await page.locator('.sl-mood').innerText(), /fast asleep/)
  await shot(page, 'loft-asleep-390')
  // what was recorded: adopted, hatched, and one care memory for the day (not one per tap)
  assert.deepEqual((await events(page, id)).map(e => e.type).sort(), ['adopted', 'care', 'hatched'])
  assert.match(await page.locator('.sl-mempanel').innerText(), /You adopted Orbi[\s\S]*|Orbi hatched/)

  // reload: the same Cozmling, the same progress, and never a flash of "adopt one"
  await page.reload()
  await ready(page)
  await button(page, 'Wake up').waitFor()
  assert.equal(await page.evaluate(() => window.__sawAdopt), false)
  const again = await mine(page)
  assert.equal(again.companionId, id); assert.equal(again.revision, 5); assert.equal(again.name, 'Orbi'); assert.equal(again.hatch.status, 'hatched')
  assert.deepEqual(again.progress.counters, c.progress.counters); assert.ok(again.care.asleepAt)
  await button(page, 'Wake up').click()
  await page.waitForFunction(id => window.__cozmling.getState().companions.find(c => c.companionId === id)?.care.asleepAt == null, id)

  // no wallet, no first-version save, and nothing sent anywhere. (The site's own header still looks up public
  // figures such as the burn total, as it does on every page: those are plain reads, and are the only outside requests.)
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('cozmc-cozmling-v1'))), [])
  assert.deepEqual(p.outside.filter(u => !u.startsWith('GET ') || /walletconnect|perawallet|defly|lute/i.test(u)), [])
  assert.equal(await page.getByRole('button', { name: /^connect$/i }).count() > 0, true)             // still not connected at the end
  assert.deepEqual(await sticksOut(page), [])
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('the keyboard alone can adopt, hatch and look after a Cozmling', async () => {
  const p = await profile({ viewport: DESK }), page = await p.open()
  await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor()
  const key = k => page.keyboard.press(k), focus = () => page.evaluate(() => { const a = document.activeElement; return `${a?.tagName.toLowerCase()}${a?.id ? '#' + a.id : ''}:${(a?.textContent || a?.getAttribute('aria-label') || '').trim().slice(0, 24)}` })
  await page.locator('#sl-bday').focus()
  for (let i = 0; i < 5 && !/button:Today/.test(await focus()); i++) await key('Tab')               // a date field has a stop for each of its parts
  assert.match(await focus(), /button:Today/); await key('Enter')
  for (let i = 0; i < 6 && !/button:Next/.test(await focus()); i++) await key('Tab')
  assert.match(await focus(), /button:Next/); await key('Enter')
  assert.match(await focus(), /h2#sl-s2/)                                                            // the new step starts at its heading
  await key('Tab'); await key('ArrowRight')                                                          // the look: radios, moved with the arrows
  assert.equal(await page.getByRole('radio', { name: 'Look B' }).isChecked(), true)
  await key('Tab'); await key('ArrowRight')                                                          // the skin colour
  assert.equal(await page.getByRole('radio', { name: 'Lilac' }).isChecked(), true)
  await key('Tab'); assert.match(await focus(), /button:Back/); await key('Tab'); await key('Enter')
  assert.match(await focus(), /h2#sl-s3/)
  await key('Tab'); await page.keyboard.type('Kip')
  for (let i = 0; i < 4 && !/button:Create the Star Egg/.test(await focus()); i++) await key('Tab')
  await key('Enter')
  await button(page, 'Warm the egg').waitFor()
  assert.match(await focus(), /^h1:Kip/)
  await key('Tab'); assert.match(await focus(), /button:Warm the egg/)
  for (let i = 0; i < 4; i++) await key('Enter')
  await button(page, 'Play').waitFor()
  assert.match(await focus(), /button#sl-feed-btn/)
  await key('Enter'); assert.match(await focus(), /button:Moon cheese/)
  await key('ArrowDown'); assert.match(await focus(), /button:Star fruit/)
  await key('ArrowUp'); await key('End'); assert.match(await focus(), /button:Comet cookie/)
  await key('Escape'); assert.match(await focus(), /button#sl-feed-btn/)                            // Escape closes the menu and gives the keyboard back to Feed
  assert.equal(await page.getByRole('menu').count(), 0)
  await key('Enter'); await key('ArrowDown'); await key('Enter')                                     // Star fruit
  assert.match(await focus(), /button#sl-feed-btn/)
  await key('Tab'); assert.match(await focus(), /button:Play/); await key('Enter')
  await key('Tab'); assert.match(await focus(), /button:Pat/); await key('Enter')
  await key('Tab'); assert.match(await focus(), /button:Rest/); await key('Enter')
  if (process.env.DEBUG) { await page.waitForTimeout(500); console.log(await focus(), await page.locator('.sl__say').innerText(), JSON.stringify((await mine(page)).care)) }
  await button(page, 'Wake up').waitFor()
  const c = await mine(page)
  assert.equal(c.name, 'Kip'); assert.equal(c.appearance.appearanceOption, 'b'); assert.equal(c.appearance.skin, 'lilac'); assert.equal(c.hatch.status, 'hatched')
  assert.deepEqual({ fed: c.progress.counters.fed, played: c.progress.counters.played, pets: c.progress.counters.pets }, { fed: 1, played: 1, pets: 1 }); assert.ok(c.care.asleepAt)
  // the buttons the keyboard lands on can be seen to have it
  await page.getByRole('button', { name: 'Wake up', exact: true }).focus(); await key('Shift+Tab')
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none')
  await shot(page, 'loft-keyboard-1280')
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('reduced motion: nothing in the page moves, and hatching still works at once', async () => {
  const p = await profile({ reducedMotion: 'reduce' }), page = await p.open()
  await adopt(page)
  // animations and scripted movement in the Cozmling's page (a button's brief colour change on press is not movement)
  const moving = () => page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.constructor.name !== 'CSSTransition' && a.effect?.target?.closest?.('.sl-page, .sl-adopt')).map(a => a.animationName || 'script'))
  assert.deepEqual(await moving(), [])
  await button(page, 'Hatch now').click()                                                             // the skip: no tapping, no waiting
  await button(page, 'Play').waitFor()
  await page.waitForTimeout(200)
  assert.deepEqual(await moving(), [])
  assert.equal(await page.locator('.sl-flash').count() ? await page.locator('.sl-flash').evaluate(el => getComputedStyle(el).display) : 'none', 'none')
  await button(page, 'Play').click()
  await says(page, 'Again, again!')
  assert.deepEqual(await moving(), [])
  assert.equal((await mine(page)).progress.counters.played, 1)
  await shot(page, 'loft-reduced-motion-390')
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

/* ---- the original Cozmling scene, recovered: the first version's own pixel creature and Cosmic Grove ---- */

/** Pixels of the Cozmling's scene, by the room's own 144×96 grid (each grid pixel is 8×8 on the canvas). */
const scenePixels = (page, points) => page.evaluate(points => {
  const g = document.querySelector('.sl__screen canvas').getContext('2d')
  return points.map(([x, y]) => [...g.getImageData(x * 8 + 4, y * 8 + 4, 1, 1).data].slice(0, 3).join(','))
}, points)
/** Wait until at least `min` pixels of the scene are this colour (within a few steps: glows are drawn see-through). */
const sceneShows = (page, rgb, min = 1) => page.waitForFunction(([rgb, min]) => {
  const [r, g, b] = rgb.split(',').map(Number), c = document.querySelector('.sl__screen canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
  let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) <= 3 && Math.abs(d[i + 1] - g) <= 3 && Math.abs(d[i + 2] - b) <= 3 && ++n >= min) return true
  return false
}, [rgb, min], { timeout: 6000, polling: 250 })
const sceneFingerprint = page => page.evaluate(() => { const c = document.querySelector('.sl__screen canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4 * 97) h = (h * 31 + d[i] + d[i + 1] * 3 + d[i + 2] * 7) >>> 0; return h })
const sceneIs = async (page, key, value) => {
  try { await page.waitForFunction(([k, v]) => document.querySelector('.sl__screen canvas')?.dataset[k] === v, [key, value], { timeout: 8000 }) }
  catch { throw new Error(`the scene's ${key} should be ${value}, but is ${await page.evaluate(k => document.querySelector('.sl__screen canvas')?.dataset[k], key)}`) }
}
/** Where things are in the Cosmic Grove (scene.ts): the moon's lit side, and a glowing mushroom cap each side of the clearing. */
const GROVE = { moon: [110, 22], cyanL: [36, 76], pinkL: [42, 79], cyanR: [127, 79], purpleR: [133, 77] }
const RGB = { moon: '246,240,216', cyan: '89,230,255', pink: '255,138,216', purple: '176,107,255', skyBody: '124,200,255', roseBody: '255,156,207', fireGlow: '255,106,74' }

await scenario('the original Cozmling, recovered: a new adventurer is the pixel creature in the Cosmic Grove, drawn in code with no image files at all', async () => {
  // with reduced motion the room holds still and the Cozmling stands in the middle, so the pixels checked are the scene's own
  const p = await profile({ blockArt: true, reducedMotion: 'reduce' })
  await p.ctx.route(/\.(png|webp|jpe?g|gif)(\?.*)?$/, r => r.abort())                                 // no image file loads at all
  const page = await p.open()
  await adopt(page, { birthday: '2026-03-30', skin: 'Sky', name: 'Moss' })                            // an Aries: fire
  await sceneIs(page, 'scene', 'original'); await sceneIs(page, 'home', 'grove'); await sceneIs(page, 'stage', 'egg')
  await button(page, 'Hatch now').click(); await button(page, 'Play').waitFor()
  await sceneIs(page, 'stage', 'sprout')
  assert.equal(await page.locator('.sl__screen canvas').getAttribute('aria-label'), 'Moss, Sprout, in the Cosmic Grove')
  // the Cosmic Grove, as the first version painted it: the big moon, and the glowing mushrooms either side
  await page.waitForTimeout(300)
  assert.deepEqual(await scenePixels(page, [GROVE.moon, GROVE.cyanL, GROVE.pinkL, GROVE.cyanR, GROVE.purpleR]), [RGB.moon, RGB.cyan, RGB.pink, RGB.cyan, RGB.purple])
  // the original creature in the colours chosen: a sky-blue body, and a red-orange antenna for a fire sign
  await sceneShows(page, RGB.skyBody, 500)                                                            // its sky-blue body
  await sceneShows(page, RGB.fireGlow, 20)                                                            // its fire-coloured antenna
  // the original ladder, and its stage under its name
  assert.match(await page.locator('.sl-grow').innerText(), /STAR EGG[\s\S]*SPROUT[\s\S]*CADET[\s\S]*EXPLORER[\s\S]*GUARDIAN/)
  assert.match(await page.locator('.sl-grow__row').innerText(), /0 \/ 40 to Cadet/)
  assert.match(await page.locator('.sl-hero').innerText(), /ARIES[\s\S]*FIRE[\s\S]*SPROUT/)
  // reduced motion: nothing moves, and care still shows and counts
  const still = await sceneFingerprint(page); await page.waitForTimeout(1200)
  assert.equal(await sceneFingerprint(page), still, 'the scene holds still')
  await button(page, 'Play').click(); await says(page, 'Again, again!')
  await shot(page, 'loft-original-grove-390')
  // lights out: the clearing darkens, and the mushrooms still glow
  await button(page, 'Rest').click(); await button(page, 'Wake up').waitFor()
  await page.waitForFunction(() => /, asleep$/.test(document.querySelector('.sl__screen canvas')?.getAttribute('aria-label') ?? ''))
  await page.waitForTimeout(200)
  const [moonAtNight, mushroomAtNight] = await scenePixels(page, [GROVE.moon, GROVE.cyanR])
  assert.notEqual(moonAtNight, RGB.moon, 'the sky dims'); assert.equal(mushroomAtNight, RGB.cyan, 'the mushrooms still glow')
  await shot(page, 'loft-original-asleep-390')
  await button(page, 'Wake up').click(); await button(page, 'Rest').waitFor()
  // the original homes: moved to the Moon Base, kept after a reload, and back to the Grove
  await button(page, 'Customize').click()
  await page.getByRole('button', { name: 'Moon Base', exact: true }).click()
  await sceneIs(page, 'home', 'moonbase')
  const moved = await mine(page)
  assert.deepEqual([moved.appearance.home, moved.appearance.rendererVersion], ['moonbase', 'original-1'])
  await page.reload(); await ready(page); await sceneIs(page, 'home', 'moonbase')
  await button(page, 'Customize').click()
  await page.getByRole('button', { name: 'Cosmic Grove', exact: true }).click()
  await sceneIs(page, 'home', 'grove')
  // the preview tools show it at each original stage, and save nothing
  const rev = (await mine(page)).revision
  await page.getByRole('button', { name: 'Guardian', exact: true }).click(); await sceneIs(page, 'stage', 'guardian')
  await page.getByRole('button', { name: 'Sprout', exact: true }).click(); await sceneIs(page, 'stage', 'sprout')     // its real stage again
  assert.equal((await mine(page)).revision, rev)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('the original scene moves as it always did: fireflies drift, the Cozmling wanders, food drops in and is eaten', async () => {
  const p = await profile({ viewport: DESK }), page = await p.open()
  await adopt(page, { birthday: '2026-05-05', look: 'b', skin: 'Rose', name: 'Pip' })                 // Look B is the original's other form
  await button(page, 'Hatch now').click(); await button(page, 'Play').waitFor()
  await sceneIs(page, 'stage', 'sprout')
  const a = await sceneFingerprint(page); await page.waitForTimeout(700)
  assert.notEqual(await sceneFingerprint(page), a, 'the scene is alive')
  await sceneShows(page, RGB.roseBody, 500)                                                           // its rose body, once the hatching flash has faded
  await button(page, 'Feed').click(); await page.getByRole('menuitem', { name: /Comet cookie/ }).click()
  await page.waitForFunction(() => { const s = window.__cozmling.getState(); return s.companions.find(c => c.companionId === s.selectedId)?.progress.counters.fed === 1 })
  await page.waitForTimeout(500)
  await shot(page, 'loft-original-eating-1280')
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('a first-version Cozmling shows in the new page as itself, and what you do is kept for the old page too', async () => {
  const p = await profile({ seed: ['wallet-cadet'], viewport: DESK }), page = await p.open()
  await page.locator('.sl-hero h1').waitFor()
  const f = fx('wallet-cadet')
  assert.equal(await page.evaluate(() => window.__sawAdopt), false)
  assert.equal(await page.locator('.sl-hero h1').innerText(), JSON.parse(f.raw).name.toUpperCase())
  assert.match(await page.locator('.sl-hero').innerText(), /CADET/)
  assert.equal(await page.locator('.sl__screen canvas').count(), 1)                                   // drawn by the first version's own renderer
  assert.equal(await page.locator('.sl-scene').count(), 0)
  assert.match(await page.locator('.sl-print').innerText(), /First-version Cozmling[\s\S]*Cadet/)
  assert.doesNotMatch(await page.locator('main').innerText(), /Starprint|Scorpio|Taurus/i)            // it is not given a sign
  const before = await mine(page)
  assert.deepEqual({ fed: before.legacy.pet.fed, played: before.legacy.pet.played, pets: before.legacy.pet.pets }, { fed: f.expect.counters.fed, played: f.expect.counters.played, pets: f.expect.counters.pets })
  await shot(page, 'loft-first-version-1280', true)
  await button(page, 'Play').click()
  await page.waitForFunction(() => { const s = window.__cozmling.getState(); return s.companions.find(c => c.companionId === s.selectedId)?.revision === 1 })
  const after = await mine(page)
  assert.equal(after.legacy.pet.played, before.legacy.pet.played + 1)
  assert.equal(JSON.parse(await page.evaluate(k => localStorage.getItem(k), f.storageKey)).played, before.legacy.pet.played + 1)
  // its own ladder and numbers, exactly
  assert.match(await page.locator('.sl-grow').innerText(), /STAR EGG[\s\S]*SPROUT[\s\S]*CADET[\s\S]*EXPLORER[\s\S]*GUARDIAN/)
  assert.match(await page.locator('.sl-grow__row').innerText(), /\/ 200 to Explorer/)
  // the wardrobe moves it to another of its homes
  await button(page, 'Customize').click()
  await page.getByRole('button', { name: 'Cosmic Grove', exact: true }).click()
  await page.waitForFunction(() => { const s = window.__cozmling.getState(); return s.companions.find(c => c.companionId === s.selectedId)?.legacy.pet.home === 'grove' })
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('a first-version egg hatches into a Sprout, once, and the arcade Buddy (still the first version) finds it', async () => {
  const p = await profile({ seed: ['guest-egg'] }), page = await p.open()
  await button(page, 'Warm the egg').waitFor()
  assert.match(await page.locator('.sl-hero').innerText(), /STAR EGG/)
  for (let i = 0; i < 4; i++) await button(page, 'Warm the egg').click()
  await button(page, 'Play').waitFor()
  assert.match(await page.locator('.sl-hero').innerText(), /SPROUT/)
  const c = await mine(page)
  assert.equal(c.hatch.status, 'hatched'); assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('cozmc-cozmling-v1'))).hatched)
  assert.equal((await events(page, c.companionId)).filter(e => e.type === 'hatched').length, 1)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('a first-version Cozmling and a new adventurer live side by side, and the choice between them is remembered', async () => {
  const p = await profile({ seed: ['wallet-cadet'], viewport: DESK }), page = await p.open()
  await page.locator('.sl-hero h1').waitFor()
  await page.getByRole('button', { name: 'adopt another Cozmling' }).click()                          // a preview tool: whether players may keep several is still to be decided
  await adopt(page, { name: 'Nova', birthday: '2026-05-05' })
  assert.equal(await page.locator('.sl-hero h1').innerText(), 'NOVA')
  const st = await state(page)
  assert.equal(st.companions.length, 2); assert.equal(st.companions.filter(c => c.kind === 'legacy').length, 1)
  assert.equal(st.companions.find(c => c.kind === 'legacy').revision, 0)                              // the first one was not touched
  const sw = page.getByRole('region', { name: 'Your Cozmlings' })
  await sw.getByRole('button', { name: /Comet/ }).click()
  await page.waitForFunction(() => document.querySelector('.sl-hero h1')?.textContent === 'Comet')
  assert.equal(await page.evaluate(() => document.activeElement?.tagName), 'H1')
  await page.reload(); await ready(page)
  await page.locator('.sl-hero h1').waitFor()
  assert.equal(await page.locator('.sl-hero h1').innerText(), 'COMET')
  await shot(page, 'loft-two-cozmlings-1280', true)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('a browser that stores nothing: adoption works for the visit, and the page says it will not last', async () => {
  const p = await profile({ noStorage: true }), page = await p.open()
  await adopt(page, { name: 'Zib' })
  assert.match(await page.locator('[data-save-chip]').innerText(), /THIS VISIT ONLY/)
  assert.match(await page.locator('[data-save="visit"]').innerText(), /This visit only: this browser isn’t storing anything, so Zib won’t be here next time/)
  assert.doesNotMatch(await page.locator('main').innerText(), /Saved on this device/i)
  await button(page, 'Hatch now').click()
  await button(page, 'Play').click()
  await says(page, 'Again, again!')
  assert.equal((await mine(page)).progress.counters.played, 1)
  await shot(page, 'loft-visit-only-390')
  await p.ctx.close()
})

await scenario('two tabs: an egg hatched in one is hatched in the other, and only once', async () => {
  const p = await profile(), a = await p.open()
  await adopt(a)
  const b = await p.open()
  await button(b, 'Warm the egg').waitFor()
  await button(a, 'Hatch now').click()
  await button(a, 'Play').waitFor()
  await button(b, 'Play').waitFor({ timeout: 10000 })                                                  // the other tab catches up by itself
  assert.equal(await button(b, 'Warm the egg').count(), 0)
  const id = (await mine(a)).companionId
  await button(b, 'Play').click()
  await a.waitForFunction(id => window.__cozmling.getState().companions.find(c => c.companionId === id)?.progress.counters.played === 1, id, { timeout: 10000 })
  assert.equal((await events(a, id)).filter(e => e.type === 'hatched').length, 1)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await scenario('on a 360 px phone nothing is cut off: the four care buttons, the food menu and every step of adoption fit', async () => {
  const p = await profile({ viewport: SMALL }), page = await p.open()
  await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor()
  assert.deepEqual(await sticksOut(page), [])
  await page.locator('#sl-bday').fill('2026-11-05'); await button(page, 'Next').click()
  assert.deepEqual(await sticksOut(page), [])
  await button(page, 'Next').click(); await page.locator('#sl-name').fill('Wwwwwwwwwwwwww')        // the widest name there can be
  assert.deepEqual(await sticksOut(page), [])
  await button(page, 'Create the Star Egg').click()
  await button(page, 'Warm the egg').waitFor()
  assert.deepEqual(await sticksOut(page), [])
  await shot(page, 'loft-egg-360')
  await button(page, 'Hatch now').click()
  await button(page, 'Play').waitFor()
  await page.waitForTimeout(1700)
  assert.deepEqual(await sticksOut(page), [])
  const acts = await page.evaluate(() => [...document.querySelectorAll('.sl-act')].map(b => { const r = b.getBoundingClientRect(); return { text: b.textContent, left: r.left, right: r.right, w: r.width, h: r.height, clipped: b.scrollWidth > b.clientWidth + 1 } }))
  assert.deepEqual(acts.map(a => a.text), ['Feed', 'Play', 'Pat', 'Rest'])
  for (const a of acts) assert.ok(a.left >= 0 && a.right <= 360 && a.h >= 44 && a.w >= 44 && !a.clipped, JSON.stringify(a))
  // the three needs each have a label that fits its place (the longest is "Energy")
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.sl-meter__label')].filter(l => l.scrollWidth > l.clientWidth + 1).map(l => l.textContent)), [])
  // the four buttons sit together on one row, on screen at the same time as each other
  assert.equal(new Set(await page.evaluate(() => [...document.querySelectorAll('.sl-act')].map(b => Math.round(b.getBoundingClientRect().top)))).size, 1)
  await button(page, 'Feed').click()
  const menu = await page.getByRole('menu').boundingBox()
  assert.ok(menu.x >= 0 && menu.x + menu.width <= 360, JSON.stringify(menu))
  await page.keyboard.press('Escape')
  // the Cozmling itself is not covered by anything: a tap on it reaches it
  await page.locator('.sl__screen').scrollIntoViewIfNeeded()
  const scene = await page.locator('.sl__screen canvas').boundingBox()                                 // where it stands in the clearing
  assert.ok(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName === 'CANVAS', [scene.x + scene.width / 2, scene.y + scene.height * 0.8]))
  // the identity can be read at this size: the glyph is a real drawing at least 18 px across
  const glyph = await page.locator('.sl-hero .sl-id__sign .sl-glyph').boundingBox()
  assert.ok(glyph.width >= 18 && glyph.height >= 18, JSON.stringify(glyph))
  await button(page, 'Rest').click(); await button(page, 'Wake up').waitFor()                         // the longest label still fits its button
  assert.equal(await page.getByRole('button', { name: 'Wake up', exact: true }).evaluate(b => b.scrollWidth > b.clientWidth + 1), false)
  await shot(page, 'loft-360', true)
  assert.deepEqual(p.errors, [])
  await p.ctx.close()
})

await browser.close()
console.log(`\n${results.filter(Boolean).length} of ${results.length} browser scenarios passed`)
process.exit(results.every(Boolean) ? 0 : 1)
