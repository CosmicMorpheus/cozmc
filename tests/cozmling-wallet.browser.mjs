/* Real Chrome, real Cozmling screens, simulated wallets and HTTP. Run from the COZMC checkout
   with Playwright installed: node tests/cozmling-wallet.browser.mjs
   PW_CHROMIUM may point at an installed Chrome/Chromium executable. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const { chromium } = require('playwright')
const origin = 'https://cozmling.test'
const walletFixture = fileURLToPath(new URL('./wallet-browser/wallet-fixture.ts', import.meta.url))
const fixtures = await build({
  entryPoints: [fileURLToPath(new URL('./wallet-browser/entry.tsx', import.meta.url))],
  outfile: 'wallet-review.js',
  write: false,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  jsx: 'automatic',
  loader: { '.webp': 'file' },
  define: {
    'import.meta.env.DEV': 'true',
    'import.meta.env.VITE_COZMLING_V2': '"1"',
    'import.meta.env.VITE_COZMLING_DEV': '"1"',
    'import.meta.env.VITE_COZMLING_WALLET_ACCOUNT': '"1"',
    'import.meta.env.VITE_COZMC_COMMUNITY_HATCH': '"1"',
  },
  plugins: [{
    name: 'wallet-review-fixture',
    setup(plugin) {
      plugin.onResolve({ filter: /^@txnlab\/use-wallet-react$|components\/Wallet$/ }, () => ({ path: walletFixture }))
    },
  }],
})
const contentTypes = { css: 'text/css', js: 'text/javascript', webp: 'image/webp' }
const files = new Map(fixtures.outputFiles.map(file => ['/' + basename(file.path), file.contents]))
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64')
// the site's own rule for text meant only for screen readers (from src/styles.css)
const srOnly = '.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}'
const html = `<!doctype html><html><head><link rel="stylesheet" href="/wallet-review.css"><style>${srOnly}</style></head><body><div id="root"></div><script type="module" src="/wallet-review.js"></script></body></html>`

function fixtureAddress(byte) {
  const key = Buffer.alloc(32, byte)
  const checksum = createHash('sha512-256').update(key).digest().subarray(-4)
  const bits = Array.from(Buffer.concat([key, checksum]), part => part.toString(2).padStart(8, '0')).join('').padEnd(290, '0')
  return bits.match(/.{5}/g).map(part => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[parseInt(part, 2)]).join('')
}

const one = fixtureAddress(1)
const two = fixtureAddress(2)
const receipt = { companionId: 'hatch-8fe2849d-47d9-4b95-95cd-67ae2810f250', lookId: 'grove-violet' }
const savedAccounts = new Map()
const contributions = new Set()   // wallets that lit a lantern during the event: each may claim an egg
const litToday = new Set()        // wallets that lit one today; midnight UTC clears it
const claims = new Set()
let phase = 'open'
let total = 0                     // the community's shared count, as the event reports it
let goal = 1
let denyOneLogout = false
let accountDelay = 0           // ms before the account list answers: shows a device waiting for its first sync
let hatchDelay = 0             // ms before the event answers a wallet's status
const errors = []
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
const records = address => savedAccounts.get(address) ?? []

async function makeBrowser(legacyFixture) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  if (legacyFixture) {
    await context.addInitScript(({ storageKey, raw }) => {
      if (!localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, JSON.stringify({ ...JSON.parse(raw), at: Date.now() - 60000 }))
      }
    }, legacyFixture)
  }
  let verified = null
  let offline = false            // this browser can't reach the account (its other requests still work)
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (offline && url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'temporarily_unavailable' } })
    if (url.origin !== origin) return route.abort()
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (files.has(url.pathname)) {
      return route.fulfill({ contentType: contentTypes[url.pathname.split('.').pop()], body: Buffer.from(files.get(url.pathname)) })
    }
    if (url.pathname === '/assets/card-face.webp' || /^\/assets\/cozmc-wordmark-v2-\d+\.webp$/.test(url.pathname)) {
      return route.fulfill({ contentType: 'image/png', body: pixel })
    }
    const body = request.method() === 'POST' ? request.postDataJSON() : null
    if (url.pathname === '/api/cozmling-wallet') {
      if (!body) return route.fulfill({ json: { address: url.searchParams.get('wallet') === verified ? verified : null } })
      if (body.action === 'challenge') {
        const data = Buffer.from(JSON.stringify({ address: body.address })).toString('base64')
        return route.fulfill({ json: { data, token: 'challenge-' + body.address } })
      }
      if (body.action === 'verify') {
        assert.deepEqual(Buffer.from(body.signature, 'base64'), Buffer.alloc(64, 7))
        assert.deepEqual(Buffer.from(body.authenticatorData, 'base64'), Buffer.alloc(32, 2))
        verified = JSON.parse(Buffer.from(body.data, 'base64').toString()).address
        assert.equal(body.token, 'challenge-' + verified)
        return route.fulfill({ json: { address: verified } })
      }
      if (body.action === 'logout') {
        if (denyOneLogout) {
          denyOneLogout = false
          return route.fulfill({ status: 503, json: { error: 'temporarily_unavailable' } })
        }
        if (verified === body.address) verified = null
        return route.fulfill({ json: { address: null } })
      }
    }
    const address = request.headers()['x-cozmc-wallet'] === verified ? verified : null
    if (url.pathname === '/api/community-hatch') {
      if (body && !address) return route.fulfill({ status: 401, json: { error: 'wallet_required' } })
      if (!body && address && hatchDelay) await sleep(hatchDelay)
      if (body?.action === 'contribute' && !litToday.has(address)) {
        litToday.add(address)
        contributions.add(address)
        total++
      }
      if (body?.action === 'claim') {
        assert.ok(contributions.has(address))
        claims.add(address)
      }
      return route.fulfill({ json: {
        eventId: 'grove-review', title: 'Light the Grove', phase, total, goal,
        opensAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-08T00:00:00Z', claimUntil: '2026-11-22T00:00:00Z',
        authenticatedWallet: address, eligible: contributions.has(address), contributedToday: litToday.has(address),
        lanternEligible: contributions.has(address), receipt: claims.has(address) ? receipt : null,
      } })
    }
    if (url.pathname === '/api/cozmling-account') {
      if (!address) return route.fulfill({ status: 401, json: { error: 'wallet_required' } })
      if (!body && accountDelay) await sleep(accountDelay)
      if (!body) return route.fulfill({ json: { companions: records(address) } })
      const companions = records(address)
      const snapshot = body.snapshot
      const existing = companions.find(item => item.snapshot.record.companionId === snapshot.record.companionId)
      if (body.action === 'adopt') {
        if (existing) return route.fulfill({ json: { companion: existing } })
        const companion = { revision: 0, snapshot }
        savedAccounts.set(address, [...companions, companion])
        return route.fulfill({ json: { companion } })
      }
      if (body.action === 'save') {
        assert.ok(existing, 'Save must target this wallet’s companion')
        if (existing.revision !== body.expectedRevision) {
          return route.fulfill({ status: 409, json: { error: 'stale_save', companion: existing } })
        }
        const companion = { revision: existing.revision + 1, snapshot }
        savedAccounts.set(address, companions.map(item => item === existing ? companion : item))
        return route.fulfill({ json: { companion } })
      }
    }
    return route.fulfill({ status: 404, body: '' })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => errors.push(error.message))
  page.setOffline = value => { offline = value }
  await page.goto(origin + '/#/cozmling')
  return page
}

const button = (page, name) => page.getByRole('button', { name, exact: typeof name === 'string' })
const heading = (page, name) => page.getByRole('heading', { name, exact: true })
const select = (page, address, supported = true) => page.evaluate(
  ([address, supported]) => window.__walletReview.select(address, supported), [address, supported],
)
const verify = page => button(page, /verify.*wallet|sign in with.*wallet/i)
async function adopt(page, name) {
  await page.locator('#sl-bday').fill('2026-11-05')
  await button(page, 'Next').click()
  await button(page, 'Next').click()
  await page.locator('#sl-name').fill(name)
  await button(page, 'Create the Star Egg').click()
}
async function until(predicate, label) {
  for (let elapsed = 0; elapsed < 15000; elapsed += 100) {
    if (predicate()) return
    await sleep(100)
  }
  throw new Error('Timed out waiting for ' + label)
}
// The Grove's twelve lanterns on screen: [sign, lit], in order, and what each tells a screen reader.
const ZODIAC = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']
const NAMES = ZODIAC.map(sign => sign[0].toUpperCase() + sign.slice(1))
const shownLanterns = page => page.evaluate(() => [...document.querySelectorAll('.community-hatch__lantern')]
  .map(item => [item.dataset.sign, item.dataset.lit === 'true']))
async function expectLit(page, count) {
  const list = page.getByRole('region', { name: 'Light the Grove' }).getByRole('list', { name: 'Zodiac lanterns' })
  await page.locator(`.community-hatch__lanterns[data-lit-count="${count}"]`).waitFor()
  assert.equal(await list.getByRole('listitem').count(), 12)
  assert.deepEqual(await shownLanterns(page), ZODIAC.map((sign, index) => [sign, index < count]), `${count} lit, in zodiac order`)
  assert.deepEqual(await list.locator('.sr-only').evaluateAll(items => items.map(item => item.textContent)),
    NAMES.map((name, index) => `${name} lantern: ${index < count ? 'lit' : 'unlit'}`))
}
// Tab from the top of the page until the named button has focus; the lanterns themselves take no stops.
async function tabTo(page, name) {
  await page.evaluate(() => document.activeElement?.blur())
  for (let presses = 1; presses <= 80; presses++) {
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const active = document.activeElement
      return active ? { name: active.textContent.trim(), inGrove: Boolean(active.closest('.community-hatch')), tag: active.tagName } : null
    })
    assert.notEqual(focused?.tag, 'svg', 'a lantern never takes focus')
    if (focused?.inGrove && focused.name === name) return presses
  }
  throw new Error('Tab never reached ' + name)
}

try {
  const a = await makeBrowser()
  const grove = a.getByRole('region', { name: 'Light the Grove' })
  // nobody has lit one yet: all twelve hang dark
  await expectLit(a, 0)
  // the keyboard reaches the Grove's wallet button, and Enter opens the wallet picker
  await button(grove, 'Connect wallet').waitFor()
  await tabTo(a, 'Connect wallet')
  await a.keyboard.press('Enter')
  assert.equal(await a.evaluate(() => window.__walletReview.details.connections), 1)
  assert.equal(await grove.getByRole('progressbar', { name: 'Lantern goal' }).getAttribute('value'), '0')
  assert.equal(await a.locator('#sl-bday').count(), 0)
  assert.equal(await button(a, 'Light a lantern').count(), 0)
  await select(a, one, false)
  await a.getByText(/Pera.*Lute|Lute.*Pera/i).first().waitFor()
  assert.equal(await a.locator('#sl-bday').count(), 0)
  await select(a, one)
  await a.evaluate(() => window.__walletReview.reject(true))
  await tabTo(a, 'Verify for the Grove')
  await a.keyboard.press('Space')
  await a.waitForFunction(() => window.__walletReview.details.signatures.length === 1)
  assert.equal(await a.locator('#sl-bday').count(), 0)
  await a.evaluate(() => window.__walletReview.reject(false))
  await verify(a).click()
  await heading(a, 'Adopt a Cozmling').waitFor()
  await adopt(a, 'Original')
  await button(a, 'Hatch now').click()
  await button(a, 'Feed').click()
  await a.getByRole('menuitem', { name: /Comet cookie/ }).click()
  await until(() => records(one)[0]?.snapshot.events.some(item => item.type === 'care'), 'the cloud care save')
  const original = records(one)[0].snapshot.record

  await a.getByText('Share Cozmling', { exact: true }).click()
  await button(a, 'Preview Discord card').click()
  await heading(a, 'Share your Cozmling').waitFor()
  await a.getByRole('img', { name: 'Your COZMC share graphic' }).waitFor()
  await a.keyboard.press('Escape')
  await tabTo(a, 'Light a lantern')
  await a.keyboard.press('Enter')
  await button(a, 'Lantern lit today').waitFor()
  assert.equal(await grove.getByRole('progressbar', { name: 'Lantern goal' }).getAttribute('value'), '1')
  // a goal of one: the first lantern lights all twelve signs
  await expectLit(a, 12)

  const b = await makeBrowser()
  await select(b, one)
  await verify(b).click()
  await heading(b, 'Original').waitFor()
  const fromSecondDevice = await b.evaluate(() => window.__cozmling.getState().companions.find(item => item.name === 'Original'))
  assert.equal(fromSecondDevice.companionId, original.companionId)
  assert.deepEqual(fromSecondDevice.progress.counters, original.progress.counters)
  const restoredEvents = await b.evaluate(id => window.__cozmling.events(id), original.companionId)
  assert.ok(restoredEvents.some(event => event.type === 'care'))
  await button(b, 'Lantern lit today').waitFor()
  assert.equal(await button(b, 'Lantern lit today').isDisabled(), true)

  denyOneLogout = true
  await button(b, 'Sign out of Cozmlings').click()
  await button(b, 'Retry sign-out').waitFor()
  assert.equal(await heading(b, 'Original').count(), 0)
  await b.reload()
  await b.waitForFunction(() => Boolean(window.__walletReview))
  await select(b, one)
  await button(b, 'Retry sign-out').click()
  await verify(b).click()
  await heading(b, 'Original').waitFor()

  phase = 'claim'
  await b.reload()
  await b.waitForFunction(() => Boolean(window.__walletReview))
  await select(b, one)
  await button(b, 'Claim my mystery egg').click()
  await button(b, 'Adopt my mystery egg').click()
  await heading(b, 'Adopt your Community Hatch Cozmling').waitFor()
  await adopt(b, 'Grove Sprout')
  await until(() => records(one).length === 2, 'the second wallet-owned adoption')
  assert.equal(records(one).find(item => item.snapshot.record.companionId === receipt.companionId).snapshot.record.appearance.skin, 'lilac')
  await select(b, two)
  assert.equal(await button(b, 'Claim my mystery egg').count(), 0)
  await verify(b).click()
  await heading(b, 'Adopt a Cozmling').waitFor()
  assert.equal(await heading(b, 'Original').count(), 0)
  assert.equal(records(two).length, 0)

  const legacySet = JSON.parse(await readFile(new URL('./fixtures/legacy-local-v1.json', import.meta.url), 'utf8'))
  const legacy = legacySet.fixtures.find(item => item.storageKey === 'cozmc-cozmling-v1' && JSON.parse(item.raw).name)
  assert.ok(legacy)
  const third = fixtureAddress(3)
  const c = await makeBrowser(legacy)
  await heading(c, JSON.parse(legacy.raw).name).waitFor()
  await select(c, third)
  await verify(c).click()
  await button(c, /adopt.*wallet-backed|adopt.*wallet companion/i).click()
  await adopt(c, 'Wallet Sprout')
  await until(() => records(third).length === 1, 'ordinary adoption from an existing local save')
  const kept = await c.evaluate(() => window.__cozmling.getState().companions)
  assert.ok(kept.some(item => item.kind === 'legacy' && item.legacy.pet.name === JSON.parse(legacy.raw).name))

  // Two devices play at once: neither stops, and each change is kept (a pat here, a meal there).
  const accountCopy = () => records(one).find(item => item.snapshot.record.companionId === original.companionId)
  const e = await makeBrowser()
  await select(e, one)
  await verify(e).click()
  // this wallet now has two Cozmlings: choose Original, as a player would
  await e.getByRole('button', { name: /^Original ·/ }).click()
  await heading(e, 'Original').waitFor()
  await button(a, 'Pat').waitFor()
  a.setOffline(true)
  await button(a, 'Pat').click()
  await a.getByText(/account save is unavailable/i).waitFor()
  const before = accountCopy().revision
  await button(e, 'Feed').click()
  await e.getByRole('menuitem', { name: /Comet cookie/ }).click()
  await until(() => accountCopy().revision > before, 'the other device’s save')
  const fromE = accountCopy().snapshot.record
  a.setOffline(false)
  await button(a, 'Retry account save').click()
  await a.getByText('Wallet account is up to date.').waitFor()
  await until(() => accountCopy().snapshot.record.progress.counters.pets > fromE.progress.counters.pets, 'the merged save')
  const merged = accountCopy().snapshot.record
  assert.equal(merged.progress.counters.fed, fromE.progress.counters.fed, 'the meal from the other device is kept')
  assert.equal(await a.getByText(/copy and the wallet account’s copy differ/).count(), 0, 'no conflict to resolve')

  // A device holding an older copy waits for the account before opening it.
  accountDelay = 1500
  await a.reload()
  await a.waitForFunction(() => Boolean(window.__walletReview))
  await select(a, one)
  await a.getByText('Opening Original’s saved progress…').waitFor()
  assert.equal(await heading(a, 'Original').count(), 0)
  await heading(a, 'Original').waitFor()
  accountDelay = 0

  // The share card: name and art always; Starprint and growth stage only when chosen; nothing private in the post.
  await a.getByText('Share Cozmling', { exact: true }).click()
  const options = a.locator('details:has(> summary:text-is("Share Cozmling")) input[type=checkbox]')
  assert.deepEqual(await options.evaluateAll(boxes => boxes.map(box => box.checked)), [false, false], 'Starprint and stage are off until chosen')
  async function card() {
    await button(a, 'Preview Discord card').click()
    const img = a.getByRole('img', { name: 'Your COZMC share graphic' })
    await img.waitFor()
    const bytes = await a.evaluate(async src => (await (await fetch(src)).arrayBuffer()).byteLength, await img.getAttribute('src'))
    const text = await a.locator('.modal textarea').inputValue()
    await a.screenshot({ path: process.env.SHARE_SHOT ? `${process.env.SHARE_SHOT}-${bytes}.png` : undefined })
    await a.keyboard.press('Escape')
    return { bytes, text }
  }
  const plain = await card()
  await options.nth(0).check()
  await options.nth(1).check()
  const labelled = await card()
  assert.notEqual(plain.bytes, labelled.bytes, 'the chosen labels change the card')
  for (const { text } of [plain, labelled]) {
    assert.equal(text, 'Meet Original, my Cozmling!')
    assert.ok(!text.includes(one) && !/2026-11-05|birth/i.test(text), 'no address or birthday in the post')
  }

  // A copy brought in from a save file is never replaced on its own: the player chooses the account's copy.
  const [download] = await Promise.all([a.waitForEvent('download'), button(a, 'Keep a copy').click()])
  const d = await makeBrowser(legacy)
  await heading(d, JSON.parse(legacy.raw).name).waitFor()
  await d.locator('input[type=file]').setInputFiles(await download.path())
  await button(d, 'Add the new one').click()
  await d.waitForFunction(id => window.__cozmling.getState().companions.some(item => item.companionId === id), original.companionId)
  await select(d, one)
  await verify(d).click()
  await d.getByText(/Original: this device’s copy and the wallet account’s copy differ/).waitFor()
  assert.equal((await d.evaluate(() => window.__cozmling.getState().accountOwners))[original.companionId], undefined, 'not replaced, not claimed')
  await button(d, 'Use the wallet account’s copy here').click()
  await d.getByText('Original now uses the wallet account’s copy on this device.').waitFor()
  assert.equal((await d.evaluate(() => window.__cozmling.getState().accountOwners))[original.companionId], one)
  await d.getByText('Wallet account is up to date.').waitFor()

  // Light the Grove with a three-lantern goal: each lantern lights four signs, in zodiac order, and the
  // signs follow the shared count, whoever lit them and whatever day it is.
  phase = 'open'
  goal = 3
  total = 0
  const g = await makeBrowser()
  const gGrove = g.getByRole('region', { name: 'Light the Grove' })
  await expectLit(g, 0)
  const fourth = fixtureAddress(4)
  await select(g, fourth)
  await verify(g).click()
  await button(gGrove, 'Light a lantern').click()
  await button(gGrove, 'Lantern lit today').waitFor()
  await expectLit(g, 4)
  assert.deepEqual(await gGrove.getByRole('progressbar', { name: 'Lantern goal' }).evaluate(bar => [bar.value, bar.max]), [1, 3])
  total = 2                       // someone else lights one
  await g.reload()
  await g.waitForFunction(() => Boolean(window.__walletReview))
  await expectLit(g, 8)
  // the wallet reconnects and the event answers for it a moment later: the lanterns stay lit meanwhile
  hatchDelay = 1500
  await select(g, fourth)
  await gGrove.getByText('Checking the Grove…').waitFor()
  await expectLit(g, 8)
  hatchDelay = 0
  await button(gGrove, 'Lantern lit today').waitFor()
  await expectLit(g, 8)
  // reopening shows the same signs for the same count, on this device and on another
  const lit8 = await shownLanterns(g)
  await g.reload()
  await expectLit(g, 8)
  assert.deepEqual(await shownLanterns(g), lit8)
  const other = await makeBrowser()
  await expectLit(other, 8)
  assert.deepEqual(await shownLanterns(other), lit8)
  // midnight UTC: this wallet may light another lantern; the Grove still shows the shared count
  litToday.clear()
  await g.reload()
  await g.waitForFunction(() => Boolean(window.__walletReview))
  await select(g, fourth)
  await button(gGrove, 'Light a lantern').waitFor()
  await expectLit(g, 8)
  await button(gGrove, 'Light a lantern').click()
  await expectLit(g, 12)
  assert.deepEqual(await gGrove.getByRole('progressbar', { name: 'Lantern goal' }).evaluate(bar => [bar.value, bar.max]), [3, 3])
  total = 5                       // past the goal: still twelve
  await other.reload()
  await expectLit(other, 12)

  // Every sign on screen, in order, apart and inside the page, from desktop down to a 320 px phone.
  total = 1                       // four lit, eight dark: both looks at once
  await other.reload()
  await expectLit(other, 4)
  for (const [width, height, rows, minLantern, minSymbol] of [[1440, 1000, 1, 66, 24], [390, 844, 2, 48, 18], [360, 780, 2, 44, 18], [320, 720, 2, 38, 18]]) {
    await other.setViewportSize({ width, height })
    const shown = await other.evaluate(() => {
      const box = item => item.getBoundingClientRect().toJSON()
      const list = document.querySelector('.community-hatch__lanterns')
      return {
        width: innerWidth, scrollWidth: document.documentElement.scrollWidth, panel: box(document.querySelector('.community-hatch')),
        lanterns: [...list.querySelectorAll('.community-hatch__lantern')].map(item => ({
          sign: item.dataset.sign, lantern: box(item), glyph: box(item.querySelector('.community-hatch__sign')),
        })),
      }
    })
    const at = `${width} px`
    assert.ok(shown.scrollWidth <= shown.width, `${at}: no sideways scrolling`)
    assert.deepEqual(shown.lanterns.map(item => item.sign), ZODIAC, `${at}: all twelve, in order`)
    // one garland of twelve on a wide screen; on a phone, two rows of six, Aries to Virgo above Libra to Pisces
    const lines = []
    for (const item of shown.lanterns) {
      const line = lines.find(group => Math.abs(group[0].lantern.top - item.lantern.top) < item.lantern.height / 2)
      if (line) line.push(item)
      else lines.push([item])
    }
    assert.deepEqual(lines.map(line => line.map(item => item.sign)), rows === 1 ? [ZODIAC] : [ZODIAC.slice(0, 6), ZODIAC.slice(6)], `${at}: rows`)
    for (const { sign, lantern, glyph } of shown.lanterns) {
      assert.ok(lantern.width >= minLantern, `${at}: ${sign} is ${lantern.width.toFixed(1)} px across`)
      assert.ok(Math.max(glyph.width, glyph.height) >= minSymbol, `${at}: ${sign}'s symbol is ${glyph.width.toFixed(1)}×${glyph.height.toFixed(1)} px`)
      assert.ok(lantern.left >= shown.panel.left && lantern.right <= shown.panel.right && lantern.left >= 0 && lantern.right <= shown.width, `${at}: ${sign} is inside the Grove`)
      assert.ok(glyph.left >= lantern.left && glyph.right <= lantern.right && glyph.top >= lantern.top && glyph.bottom <= lantern.bottom, `${at}: ${sign}'s symbol sits on its lantern`)
    }
    // no lantern overlaps another
    shown.lanterns.forEach((first, i) => shown.lanterns.slice(i + 1).forEach(second => {
      const apart = first.lantern.right <= second.lantern.left + 0.5 || second.lantern.right <= first.lantern.left + 0.5
        || first.lantern.bottom <= second.lantern.top + 0.5 || second.lantern.bottom <= first.lantern.top + 0.5
      assert.ok(apart, `${at}: ${first.sign} and ${second.sign} overlap`)
    }))
    if (process.env.GROVE_REPORT) console.log(at, `${lines.length} row(s)`, 'smallest lantern', Math.min(...shown.lanterns.map(item => item.lantern.width)).toFixed(1), 'symbols', shown.lanterns.map(item => `${item.sign} ${item.glyph.width.toFixed(1)}×${item.glyph.height.toFixed(1)}`).join(', '))
  }
  assert.deepEqual(errors, [])
  console.log('Wallet-backed Cozmling browser smoke passed.')
} finally {
  await browser.close()
}
