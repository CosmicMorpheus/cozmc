/* Site-wide keyboard and layout checks in real Chrome, against a running build:
     npm run dev -- --port 5199        (or vite preview of a build)
     SITE=http://localhost:5199 node tests/site.browser.mjs
   Covers: games never take keys typed into the site search (and only take keys during a run), the skip link
   stays on the current page, focus lands on a new page after navigation, Home leads with the introduction,
   the wallet picker explains Cozmling sign-in when opened from the Grove, and the Arcade states the cost of
   posting a score, and the header fits beside Connect at every desktop width. Outside requests are blocked;
   nothing touches Algorand. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const { chromium } = createRequire(import.meta.url)('playwright')
const SITE = process.env.SITE || 'http://localhost:5199'
// PW_PROXY: an outbound proxy, for checking a deployed site from behind one
const browser = await chromium.launch({
  ...(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {}),
  ...(process.env.PW_PROXY ? { proxy: { server: process.env.PW_PROXY, bypass: 'localhost,127.0.0.1' } } : {}),
})
// a visitor outside UTC, so event times show both their own time and UTC
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, timezoneId: 'America/New_York' })
// outside requests are blocked, except the site's Google Fonts, which the header's widths depend on
await context.route(u => !u.href.startsWith(SITE) && !/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname), route => route.abort())
// a simulated Grove event (open, one of three lanterns lit) and no signed-in wallet, so builds with the
// Community Hatch show it whether or not their server runs the event
await context.route('**/api/community-hatch', route => route.fulfill({ json: {
  eventId: 'site-test', title: 'Light the Grove', phase: 'open', total: 1, goal: 3,
  opensAt: '2026-11-15T08:00:00Z', endsAt: '2026-11-17T00:00:00Z', claimUntil: '2026-11-24T00:00:00Z',
  eligible: false, contributedToday: false, lanternEligible: false, receipt: null, authenticatedWallet: null,
} }))
await context.route('**/api/cozmling-wallet*', route => route.fulfill({ json: { address: null } }))
await context.route('**/api/cozmling-account', route => route.fulfill({ status: 401, json: { error: 'wallet_required' } }))
const page = await context.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
const go = async hash => { await page.goto(`${SITE}/#/${hash}`); await page.waitForTimeout(1200) }
const active = () => page.evaluate(() => {
  const a = document.activeElement
  return { tag: a?.tagName, text: a?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 40), inMain: !!a?.closest('main') }
})
// whether a key press on the page would be taken (default prevented) by the game
const taken = key => page.evaluate(k => { const e = new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }); document.body.dispatchEvent(e); return e.defaultPrevented }, key)

try {
  for (const game of ['brick-by-brick', 'moon-bounce', 'moonshot']) {
    await go(`arcade/${game}`)
    // before a run, the page keeps its keys (Space and the arrows scroll)
    assert.equal(await taken('ArrowDown'), false, `${game}: no run, no keys taken`)
    // the site search gets every letter, and Space typed there doesn't start a run
    await page.locator('.site-menu__toggle').click()
    await page.locator('#site-search').focus()
    for (const ch of 'wisdom') await page.keyboard.press(ch)
    assert.equal(await page.locator('#site-search').inputValue(), 'wisdom', `${game}: search keeps every letter`)
    await page.keyboard.press(' ')
    assert.equal(await page.locator('.cabinet.is-playing').count(), 0, `${game}: Space in the search doesn't start a run`)
    await page.keyboard.press('Escape')
    // during a run the game has its keys
    await page.locator('.cabinet').getByRole('button', { name: 'Start', exact: true }).click()
    await page.waitForTimeout(400)
    const key = game === 'moonshot' ? ' ' : 'ArrowLeft'
    assert.equal(await taken(key), true, `${game}: a run takes its keys`)
    // …but still not the ones typed into the search
    await page.locator('.site-menu__toggle').click()
    await page.locator('#site-search').focus()
    await page.keyboard.press('a'); await page.keyboard.press('d')
    assert.equal(await page.locator('#site-search').inputValue(), 'ad', `${game}: typing during a run reaches the search`)
    await page.keyboard.press('Escape')
  }

  // Skip to content: focus moves into the page, the address doesn't change (a fresh load, as a visitor arrives)
  await go('community/wisdom')
  await page.reload(); await page.waitForTimeout(1200)
  await page.keyboard.press('Tab')
  assert.equal((await active()).text, 'Skip to content')
  await page.keyboard.press('Enter'); await page.waitForTimeout(400)
  assert.ok(page.url().endsWith('#/community/wisdom'), `still on Wisdom (${page.url()})`)
  const skipped = await active()
  assert.ok(skipped.inMain && skipped.tag === 'H1', `focus is on the page heading (${JSON.stringify(skipped)})`)

  // After moving to another page by keyboard, focus is on that page, not left in the header
  await page.locator('header.top .tabs a[href="#/about"], header.top .tabs a[href*="about"]').first().focus()
  await page.keyboard.press('Enter'); await page.waitForTimeout(800)
  const landed = await active()
  assert.ok(landed.inMain, `focus moved to the About page (${JSON.stringify(landed)})`)

  // Home leads with the introduction; today's prizes follow in one line
  await go('home')
  const order = await page.evaluate(() => [...document.querySelectorAll('main .hero, main .gw-strip')].map(e => e.classList.contains('hero') ? 'intro' : 'strip'))
  assert.equal(order[0], 'intro', `the introduction comes first (${order.join(', ')})`)
  for (const name of ['Play free', 'Meet the Cozmlings', 'Join the community']) {
    assert.equal(await page.locator('.hero__actions').getByText(name, { exact: false }).count(), 1, `the hero offers "${name}"`)
  }

  // The wallet picker: the general wording from the header, Cozmling sign-in from the Grove (when it's built in)
  await page.locator('header.top').getByRole('button', { name: /connect/i }).first().click()
  assert.match(await page.getByRole('dialog').innerText(), /post scores and burn COZMC/)
  await page.keyboard.press('Escape')
  await go('cozmling')
  const groveConnect = page.locator('.community-hatch').getByRole('button', { name: 'Connect wallet' })
  await groveConnect.waitFor({ timeout: 10000 }).catch(() => {})    // the Cozmling page loads on demand
  if (await groveConnect.count()) {
    // the Grove counts contributions and glowing signs separately, and gives the whole egg schedule
    const grove = (await page.locator('.community-hatch').innerText()).replace(/\u00a0/g, ' ')
    assert.match(grove, /1 of 3\s*lanterns lit by the community/)
    assert.match(grove, /4 of 12 zodiac signs glowing/)
    assert.match(grove, /Light one lantern a day until Nov 16, 7:00 PM EST \(Nov 17, 00:00 UTC\)/)
    assert.match(grove, /Claim it after the lanterns close, until Nov 23, 7:00 PM EST \(Nov 24, 00:00 UTC\)/)
    assert.match(grove, /Once claimed, adopt it any time/)
    await groveConnect.click()
    const text = await page.getByRole('dialog').innerText()
    assert.match(text, /sign in to your Cozmlings/)
    assert.match(text, /costs nothing and sends no transaction/)
    await page.keyboard.press('Escape')
  } else console.log('  (this build has no Community Hatch: Grove wallet wording not checked)')

  // The Arcade says what posting a score costs before anyone plays
  await go('arcade')
  assert.match(await page.locator('main header').first().innerText(), /0\.1 ALGO plus network fees/)

  // The header fits at every desktop width: Connect (or a connected wallet's wider button) stays on screen.
  // Measured in the site's own pixel font: a narrower fallback font would hide an overflow.
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('700 12px Silkscreen') })
  if (!fonts) console.log('  (Google Fonts could not load here: header widths measured in a fallback font)')
  for (const width of [1201, 1280, 1366, 1440, 1501, 1920]) {
    await page.setViewportSize({ width, height: 860 })
    await go('home')
    const fit = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('header.top button')].find(b => /connect/i.test(b.textContent))
      const plain = Math.round(btn.getBoundingClientRect().right)
      const label = btn.textContent
      btn.textContent = 'G6YFT…T5ZMA ▾'
      const connected = Math.round(btn.getBoundingClientRect().right)
      btn.textContent = label
      return { plain, connected, page: document.documentElement.scrollWidth }
    })
    assert.ok(fit.plain <= width && fit.connected <= width && fit.page <= width, `the header fits at ${width}px (${JSON.stringify(fit)})`)
  }

  assert.deepEqual(errors, [])
  console.log('Site keyboard and layout checks passed.')
} finally {
  await browser.close()
}
