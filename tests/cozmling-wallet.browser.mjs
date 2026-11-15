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
const files = new Map(fixtures.outputFiles.map(file => ['/' + basename(file.path), file.contents]))
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==', 'base64')
const html = '<!doctype html><html><head><link rel="stylesheet" href="/wallet-review.css"></head><body><div id="root"></div><script type="module" src="/wallet-review.js"></script></body></html>'

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
const contributions = new Set()
const claims = new Set()
let phase = 'open'
let denyOneLogout = false
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
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== origin) return route.abort()
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (files.has(url.pathname)) {
      return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: Buffer.from(files.get(url.pathname)) })
    }
    if (url.pathname === '/assets/cozmc-wordmark.png' || url.pathname === '/assets/card-face.webp') {
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
      if (body?.action === 'contribute') contributions.add(address)
      if (body?.action === 'claim') {
        assert.ok(contributions.has(address))
        claims.add(address)
      }
      return route.fulfill({ json: {
        eventId: 'grove-review', title: 'Light the Grove', phase, total: contributions.size, goal: 1,
        opensAt: '2026-11-01T00:00:00Z', endsAt: '2026-11-08T00:00:00Z', claimUntil: '2026-11-22T00:00:00Z',
        authenticatedWallet: address, eligible: contributions.has(address), contributedToday: contributions.has(address),
        lanternEligible: contributions.has(address), receipt: claims.has(address) ? receipt : null,
      } })
    }
    if (url.pathname === '/api/cozmling-account') {
      if (!address) return route.fulfill({ status: 401, json: { error: 'wallet_required' } })
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

try {
  const a = await makeBrowser()
  await button(a, /connect.*wallet/i).first().waitFor()
  assert.equal(await a.locator('#sl-bday').count(), 0)
  assert.equal(await button(a, 'Light a lantern').count(), 0)
  await select(a, one, false)
  await a.getByText(/Pera.*Lute|Lute.*Pera/i).first().waitFor()
  assert.equal(await a.locator('#sl-bday').count(), 0)
  await select(a, one)
  await a.evaluate(() => window.__walletReview.reject(true))
  await verify(a).click()
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
  await button(a, 'Light a lantern').click()
  await button(a, 'Lantern lit today').waitFor()

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
  assert.deepEqual(errors, [])
  console.log('Wallet-backed Cozmling browser smoke passed.')
} finally {
  await browser.close()
}
