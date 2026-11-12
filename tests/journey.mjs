/* The guest Cozmling journey in a real browser, at a phone size and a desktop size.
   Nothing here touches Algorand: every outside request is answered by this script, and the
   "wallet" is a throwaway key made for the run.

   It needs Playwright, which is not one of the site's dependencies. With the dev server running:
     npm run dev -- --port 5199
     SITE=http://localhost:5199 node tests/journey.mjs [folder for screenshots]            */
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import assert from 'node:assert/strict'
import algosdk from 'algosdk'
const { chromium } = createRequire(import.meta.url)('playwright')

const SITE = process.env.SITE || 'http://localhost:5199'
const SHOTS = process.argv[2] || ''
if (SHOTS) mkdirSync(SHOTS, { recursive: true })
const GUEST_KEY = 'cozmc-cozmling-v1'
const SIZES = { phone: { width: 360, height: 740 }, desktop: { width: 1280, height: 860 } }
const b64 = u => Buffer.from(u).toString('base64')

const results = []
const browser = await chromium.launch()

/** A fresh visitor. `chainPet` is the Cozmling note the mocked indexer says the wallet already has. */
async function visitor(size, { reducedMotion = false, storageOff = false, chainPet = null } = {}) {
  const account = algosdk.generateAccount()   // throwaway, never funded
  const address = account.addr.toString()
  const ctx = await browser.newContext({ viewport: SIZES[size], hasTouch: size === 'phone', reducedMotion: reducedMotion ? 'reduce' : 'no-preference', deviceScaleFactor: 1 })
  const v = { ctx, address, sent: [], asked: 0, errors: [], outside: new Set(), chainPet }
  let lastSigned = null

  await ctx.exposeFunction('__signB64', list => { v.asked++; return list.map(t => b64(algosdk.decodeUnsignedTransaction(Buffer.from(t, 'base64')).signTxn(account.sk))) })
  await ctx.addInitScript(([addr, off]) => {
    const from = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)), to = u => btoa(String.fromCharCode(...u))
    const accounts = [{ name: 'Test wallet', address: addr }]
    window.__testWallet = {
      connect: async () => accounts, disconnect: async () => {}, resumeSession: async () => accounts,
      signTransactions: async group => (await window.__signB64(group.flat().map(t => to(t instanceof Uint8Array ? t : t.toByte())))).map(from),
    }
    if (off) for (const m of ['setItem', 'getItem', 'removeItem']) Storage.prototype[m] = () => { throw new DOMException('storage is off', 'SecurityError') }
  }, [address, storageOff])

  // the site's wallet list, swapped for the test wallet (dev server only; the built site is untouched)
  await ctx.route('**/src/lib/wallets.ts*', async route => {
    const res = await route.fetch()
    let js = await res.text()
    assert.match(js, /wallets: \[pera\(\)[^\]]*\]/)
    js = js.replace(/import \{ NetworkConfigBuilder,/, 'import { custom, NetworkConfigBuilder,').replace(/wallets: \[pera\(\)[^\]]*\]/, 'wallets: [custom({ provider: window.__testWallet, metadata: { name: "Test wallet", icon: "data:," } })]')
    await route.fulfill({ response: res, body: js })
  })
  // every outside host is answered here
  await ctx.route(u => !u.href.startsWith(SITE), async route => {
    const req = route.request(), u = new URL(req.url())
    v.outside.add(u.host)
    const json = o => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) })
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } })
    if (!/algonode\.cloud$/.test(u.host)) return route.abort()
    if (u.pathname === '/v2/transactions/params') return json({ 'consensus-version': 'test', fee: 0, 'genesis-hash': b64(new Uint8Array(32).fill(7)), 'genesis-id': 'mock-v1', 'last-round': 1000, 'min-fee': 1000 })
    if (u.pathname === '/v2/transactions' && req.method() === 'POST') {
      lastSigned = req.postDataBuffer()
      const stx = algosdk.decodeSignedTransaction(lastSigned)
      const note = new TextDecoder().decode(stx.txn.note)
      v.sent.push({ txid: stx.txn.txID(), sender: stx.txn.sender.toString(), note, data: JSON.parse(note.replace(/^cozmc:pet:v1:/, '')) })
      return json({ txId: stx.txn.txID() })
    }
    if (u.pathname.startsWith('/v2/transactions/pending/')) {
      const body = algosdk.msgpackRawEncode(new Map([['confirmed-round', 1001 + v.sent.length], ['pool-error', ''], ['txn', algosdk.msgpackRawDecode(lastSigned)]]))
      return route.fulfill({ status: 200, contentType: 'application/msgpack', headers: { 'access-control-allow-origin': '*' }, body: Buffer.from(body) })
    }
    if (u.pathname === `/v2/accounts/${address}/transactions` && v.chainPet) {
      return json({ transactions: [{ id: 'CHAINPETTXID', sender: address, 'confirmed-round': 900, 'round-time': 1, note: b64(new TextEncoder().encode('cozmc:pet:v1:' + JSON.stringify(v.chainPet))), 'payment-transaction': { receiver: address, amount: 0 } }] })
    }
    return json({})
  })
  v.open = async (hash = '#/cozmling') => {
    const page = await ctx.newPage()
    page.on('pageerror', e => v.errors.push(String(e)))
    await page.goto(`${SITE}/${hash}`)
    return page
  }
  return v
}

const guestOf = page => page.evaluate(k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return 'unreadable' } }, GUEST_KEY)
const walletCopy = (page, addr) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), `${GUEST_KEY}:${addr}`)
const noWalletPrompt = async page => assert.equal(await page.locator('#connect-title').count(), 0, 'no wallet prompt')
const fits = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll')
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }) }
const need = async (page, label) => Number(await page.locator(`.cz-need [role=meter][aria-label=${label}]`).getAttribute('aria-valuenow'))
const go = async (page, hash) => { await page.evaluate(h => { location.hash = h }, hash) }

/** Adopt by keyboard only: Tab to each control, Space/Enter to press. */
async function adoptByKeyboard(page, name) {
  await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor()
  await page.getByRole('button', { name: 'Girl' }).focus(); await page.keyboard.press('Enter')
  await page.keyboard.press('Tab'); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.type(name)
  await page.getByRole('button', { name: 'Body 4' }).focus(); await page.keyboard.press('Space')
  await page.getByRole('button', { name: 'Cosmic Grove' }).focus(); await page.keyboard.press('Space')
  await page.getByRole('button', { name: `Adopt ${name}` }).focus(); await page.keyboard.press('Enter')
  await page.getByRole('heading', { name, level: 1 }).waitFor()
}

async function hatchAndCare(page) {
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Tap the egg' }).click()
  await page.getByText('Welcome to the world, Nova!').waitFor()
  await page.getByRole('button', { name: 'Feed' }).click()
  await page.getByRole('menuitem', { name: /Moon cheese/ }).click()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Pat', exact: true }).click()
  await page.getByRole('button', { name: 'Lights out' }).click()
  await page.getByRole('button', { name: 'Wake up' }).waitFor()
}

/** A whole game of Brick by Brick: drop bricks until the well is full. */
async function playArcade(page) {
  await go(page, '#/arcade/brick-by-brick')
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  const again = page.getByRole('button', { name: 'Play again' })
  for (let i = 0; i < 150 && !(await again.isVisible()); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(650) }
  await again.waitFor()
}

async function scenario(name, fn) {
  const t = Date.now()
  try { await fn(); results.push(['pass', name]); console.log(`ok   ${name} (${((Date.now() - t) / 1000).toFixed(0)}s)`) }
  catch (e) { results.push(['FAIL', name]); console.log(`FAIL ${name}\n     ${String(e.stack || e).split('\n').slice(0, 6).join('\n     ')}`) }
}

for (const size of ['phone', 'desktop']) {
  // the phone run is also the reduced-motion run
  await scenario(`${size}: adopt, hatch, care, come back next day, play the arcade, all with no wallet`, async () => {
    const v = await visitor(size, { reducedMotion: size === 'phone' })
    let page = await v.open()
    await adoptByKeyboard(page, 'Nova')
    await noWalletPrompt(page)
    assert.equal(await page.getByText('Prototype controls').count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Save to a wallet' }).count(), 1)
    await page.getByText('Nova lives only in this browser for now').waitFor()
    assert.equal(await page.getByText('Daily check-in', { exact: true }).count(), 0, 'check-ins stay wallet-only')
    await fits(page); await shot(page, `${size}-1-egg`)
    await hatchAndCare(page)
    await page.waitForFunction(k => JSON.parse(localStorage.getItem(k) || '{}').asleep, GUEST_KEY)
    let g = await guestOf(page)
    assert.deepEqual([g.name, g.look.form, g.look.body, g.home, g.fed, g.played, g.pets], ['Nova', 'girl', 3, 'grove', 1, 1, 1])
    assert.ok(g.hatched && g.asleep && !g.owner && !g.txid)
    await fits(page); await shot(page, `${size}-2-asleep`)
    const before = { food: await need(page, 'Food'), fun: await need(page, 'Fun') }

    // close the tab; a day goes by (the stored times are moved back 24 hours); come back
    await page.close()
    page = await v.open('#/')
    await page.evaluate(k => { const p = JSON.parse(localStorage.getItem(k)); for (const f of ['born', 'hatched', 'at', 'asleep']) p[f] -= 86_400_000; localStorage.setItem(k, JSON.stringify(p)) }, GUEST_KEY)
    await page.close()
    page = await v.open('#/')
    await page.locator('.spot__title', { hasText: 'Nova' }).waitFor()          // the Home band shows the guest
    await page.getByRole('link', { name: 'Visit Nova' }).last().click()
    await page.getByText('1 day old').waitFor()
    await page.getByText('Nova is fully rested. Wake them up!').waitFor()
    const after = { food: await need(page, 'Food'), fun: await need(page, 'Fun'), energy: await need(page, 'Energy') }
    assert.ok(after.food < before.food - 30 && after.fun < before.fun - 20 && after.energy === 100, `needs moved on: ${JSON.stringify({ before, after })}`)
    await page.getByRole('button', { name: 'Wake up' }).click()
    await page.getByRole('button', { name: 'Feed' }).click(); await page.getByRole('menuitem', { name: /Moon cheese/ }).click()
    await page.waitForFunction(k => !JSON.parse(localStorage.getItem(k)).asleep && JSON.parse(localStorage.getItem(k)).fed === 2, GUEST_KEY)
    await shot(page, `${size}-3-next-day`)

    // an arcade run cheers the guest
    g = await guestOf(page)
    await playArcade(page)
    await page.locator('.buddy__delta').waitFor()
    assert.match(await page.locator('.buddy__delta').innerText(), /\+\d+ Fun\s*-6 Energy\s*-4 Food/i)
    await page.locator('.buddy h2', { hasText: 'Nova' }).waitFor()
    const g2 = await guestOf(page)
    assert.equal(g2.arcade, 1)
    assert.ok(g2.fun > g.fun && g2.energy < g.energy && g2.food < g.food, 'Fun up, Energy and Food down')
    await noWalletPrompt(page); await fits(page); await shot(page, `${size}-4-arcade`)
    assert.equal(v.asked, 0, 'the wallet was never asked for anything'); assert.equal(v.sent.length, 0)
    assert.deepEqual(v.errors, [])
    v.outsideHosts = [...v.outside]
    console.log(`     outside hosts asked for (all mocked): ${v.outsideHosts.join(', ') || 'none'}`)
    await v.ctx.close()
  })

  await scenario(`${size}: save the guest to a wallet that has no Cozmling`, async () => {
    const v = await visitor(size)
    const page = await v.open()
    await adoptByKeyboard(page, 'Nova'); await hatchAndCare(page)
    const g = await guestOf(page)
    await page.getByRole('button', { name: 'Save to a wallet' }).click()
    await page.getByRole('button', { name: 'Test wallet' }).click()
    await page.getByRole('heading', { name: 'Save Nova' }).waitFor()
    assert.equal(v.sent.length, 0, 'nothing is signed until the visitor says so')
    await fits(page); await shot(page, `${size}-5-save-offer`)
    await page.getByRole('button', { name: 'Save Nova' }).click()
    await page.getByText('Saved to your wallet, so Nova can always come back').waitFor()
    assert.equal(v.sent.length, 1)
    const { data, sender, note } = v.sent[0]
    assert.equal(sender, v.address); assert.ok(note.startsWith('cozmc:pet:v1:'))
    assert.deepEqual([data.n, data.f, data.b, data.h, data.s, data.m, data.p, data.t], ['Nova', 'g', 3, 'g', Math.floor(g.born / 1000), 1, 1, 1])
    assert.equal(await guestOf(page), null, 'the guest copy is removed')
    const w = await walletCopy(page, v.address)
    assert.deepEqual([w.name, w.look, w.home, w.born, w.hatched, w.fed, w.played, w.pets, w.owner], [g.name, g.look, g.home, g.born, g.hatched, 1, 1, 1, v.address])
    assert.equal(await page.getByRole('button', { name: 'Save to a wallet' }).count(), 0)
    await page.getByRole('heading', { name: 'Daily check-in' }).waitFor()            // wallet features are back
    // the quiet settings link: start over needs a held key, a tap does nothing
    assert.equal(await page.getByText('Hold to start over').count(), 0)
    await page.getByRole('button', { name: 'Settings' }).focus(); await page.keyboard.press('Enter')
    const hold = page.getByRole('button', { name: 'Hold to start over' })
    await hold.click(); await page.waitForTimeout(300)
    await page.getByRole('heading', { name: 'Nova', level: 1 }).waitFor()
    await fits(page); await shot(page, `${size}-6-saved`)
    assert.deepEqual(v.errors, [])
    await v.ctx.close()
  })

  await scenario(`${size}: the wallet already has a Cozmling, so the visitor is asked which to keep`, async () => {
    const chainPet = { n: 'Zib', f: 'b', b: 1, g: 1, e: 1, h: 'l', s: 1_760_000_000, m: 40, p: 30, t: 25, a: 10, x: 5, c: 3 }
    for (const pick of ['later', 'guest', 'wallet']) {
      const v = await visitor(size, { chainPet })
      let page = await v.open()
      await adoptByKeyboard(page, 'Nova'); await hatchAndCare(page)
      const g = await guestOf(page)
      await page.getByRole('button', { name: 'Save to a wallet' }).click()
      await page.getByRole('button', { name: 'Test wallet' }).click()
      await page.getByRole('heading', { name: 'Which one stays?' }).waitFor()
      assert.equal(v.sent.length, 0); assert.equal(v.asked, 0)
      assert.equal((await guestOf(page)).name, 'Nova'); assert.equal((await walletCopy(page, v.address)).name, 'Zib')
      await fits(page); if (pick === 'later') await shot(page, `${size}-7-which-one`)
      if (pick === 'later') {
        await page.getByRole('button', { name: 'Decide later' }).click()
        await page.getByRole('heading', { name: 'Zib', level: 1 }).waitFor()
        assert.equal((await guestOf(page)).name, 'Nova')
        await page.close(); page = await v.open()                                  // next visit: asked again
        await page.getByRole('heading', { name: 'Which one stays?' }).waitFor()
        assert.equal(v.sent.length, 0)
      } else if (pick === 'guest') {
        await page.getByRole('button', { name: 'Keep Nova' }).click()
        await page.getByRole('heading', { name: 'Nova', level: 1 }).waitFor()
        assert.equal(v.sent.length, 1); assert.equal(v.sent[0].data.n, 'Nova'); assert.equal(v.sent[0].data.s, Math.floor(g.born / 1000))
        assert.equal(await guestOf(page), null); assert.equal((await walletCopy(page, v.address)).name, 'Nova')
      } else {
        const keep = page.getByRole('button', { name: 'Hold to keep Zib' })
        await keep.click(); await page.waitForTimeout(300)                          // a tap is not enough
        assert.equal((await guestOf(page)).name, 'Nova')
        await keep.focus(); await page.keyboard.down('Enter'); await page.waitForTimeout(1300); await page.keyboard.up('Enter')
        await page.getByRole('heading', { name: 'Zib', level: 1 }).waitFor()
        assert.equal(v.sent.length, 0); assert.equal(v.asked, 0)
        assert.equal(await guestOf(page), null)
        const w = await walletCopy(page, v.address)
        assert.deepEqual([w.name, w.fed, w.played, w.pets], ['Zib', 40, 30, 25])
      }
      assert.deepEqual(v.errors, [])
      await v.ctx.close()
    }
  })

  await scenario(`${size}: start over as a guest, by keyboard`, async () => {
    const v = await visitor(size)
    const page = await v.open()
    await adoptByKeyboard(page, 'Nova')
    await page.getByRole('button', { name: 'Settings' }).focus(); await page.keyboard.press('Enter')
    await page.getByRole('button', { name: 'Hold to start over' }).focus()
    await shot(page, `${size}-8-settings`)
    await page.keyboard.down('Space'); await page.waitForTimeout(1300); await page.keyboard.up('Space')
    await page.getByRole('heading', { name: 'Adopt a Cozmling' }).waitFor()
    assert.equal(await guestOf(page), null)
    assert.deepEqual(v.errors, [])
    await v.ctx.close()
  })

  await scenario(`${size}: a browser that stores nothing keeps the guest for the visit, and says so`, async () => {
    const v = await visitor(size, { storageOff: true })
    const page = await v.open()
    await adoptByKeyboard(page, 'Nova'); await hatchAndCare(page)
    await page.getByText('so Nova will only last for this visit').waitFor()
    await fits(page); await shot(page, `${size}-9-storage-off`)
    await go(page, '#/'); await page.locator('.spot__title', { hasText: 'Nova' }).waitFor()
    await go(page, '#/cozmling'); await page.getByRole('heading', { name: 'Nova', level: 1 }).waitFor()
    assert.equal(await page.locator('.cz__stats dd').first().innerText(), '1')        // still fed once
    assert.equal(await guestOf(page), 'unreadable')
    assert.deepEqual(v.errors, [])
    await v.ctx.close()
  })
}

await browser.close()
const failed = results.filter(r => r[0] !== 'pass').length
console.log(`\n${results.length - failed} of ${results.length} browser scenarios passed`)
process.exit(failed ? 1 : 0)
