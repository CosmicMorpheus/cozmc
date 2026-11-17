/* The Starprint NFT panel in real Chrome, with a stand-in wallet (tests/starprint-browser/fake-wallet.tsx) and
   a simulated mint service. Run from the COZMC checkout with Playwright installed:
     node tests/starprint.browser.mjs            (PW_CHROMIUM may point at an installed Chrome/Chromium)
   Covers: the fee and privacy wording on TestNet and MainNet, each state (new, paying, minting, ready to
   receive, delivered), and that Mint asks the wallet to sign exactly the 0.01 fee with this mint's note.
   Nothing reaches Algorand: every outside request is answered or blocked here. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const { chromium } = require('playwright')
const algosdk = require('algosdk')
const root = fileURLToPath(new URL('..', import.meta.url))
const origin = 'https://starprint.test'
const wallet = algosdk.generateAccount().addr.toString()
const issuer = algosdk.generateAccount().addr.toString()

const bundle = await build({
  stdin: {
    contents: `import { createRoot } from 'react-dom/client'; import { StarprintMintPanel } from './src/cozmling/account/StarprintMint'
      createRoot(document.getElementById('root')).render(<StarprintMintPanel wallet={window.__wallet} companion={{ companionId: 'c-1', name: 'Orbi', kind: 'adventurer', hatch: { status: 'hatched' } }} />)`,
    resolveDir: root, loader: 'tsx', sourcefile: 'starprint-entry.tsx',
  },
  bundle: true, write: false, format: 'esm', target: 'es2022', jsx: 'automatic', outdir: 'out', splitting: true,
  alias: { '@txnlab/use-wallet-react': './tests/starprint-browser/fake-wallet.tsx' },
  define: { 'import.meta.env.DEV': 'false' },
})
const files = new Map(bundle.outputFiles.map(f => ['/' + f.path.split('/out/').pop(), f.contents]))
const html = `<!doctype html><html><body><div id="root"></div><script>window.__wallet=${JSON.stringify(wallet)};window.__signRequests=[]</script><script type="module" src="/stdin.js"></script></body></html>`

const fee = { network: 'testnet', receiver: issuer, amountMicro: 10000, note: 'cozmc:starprint:v1:fee:' + 'a'.repeat(24), burnsCozmc: false }
const row = (over = {}) => ({ companionId: 'c-1', serial: 7, status: 'awaiting_fee', assetId: null, txid: null, explorer: null, publicName: null, feeTxid: null, delivery: null, fee, ...over })

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
async function open({ network = 'testnet', mints = [], onPost } = {}) {
  const context = await browser.newContext()
  const posts = []
  await context.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === origin && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (url.origin === origin && files.has(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: Buffer.from(files.get(url.pathname)) })
    if (url.pathname === '/api/starprint-mint') {
      if (route.request().method() === 'GET') return route.fulfill({ json: { network, issuer, balanceAlgo: 5, dailyCap: 20, feeMicro: 10000, mints } })
      const body = route.request().postDataJSON(); posts.push(body)
      return route.fulfill({ json: { mint: onPost ? onPost(body) : row() } })
    }
    if (url.hostname === 'testnet-api.algonode.cloud' && url.pathname === '/v2/transactions/params') {
      return route.fulfill({ json: { 'consensus-version': 'v40', fee: 0, 'genesis-hash': 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=', 'genesis-id': 'testnet-v1.0', 'last-round': 1000, 'min-fee': 1000 } })
    }
    return route.abort()
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  if (process.env.DEBUG) page.on('console', m => console.log('console:', m.text())), page.on('requestfailed', r => console.log('failed:', r.url()))
  await page.goto(origin + '/')
  await page.locator('summary').click()
  return { page, posts, errors, close: () => context.close() }
}
const text = page => page.locator('.sl-mint').innerText()

try {
  // 1. TestNet, nothing minted yet: the fee (same 0.01 as MainNet), what goes public, the name opt-in
  {
    const { page, posts, errors, close } = await open({ onPost: () => row() })
    await page.getByRole('button', { name: 'Mint for 0.01 TestNet ALGO' }).waitFor()
    const t = await text(page)
    assert.match(t, /Starprint NFT \(TestNet\)/)
    assert.match(t, /Mint fee: 0\.01 TestNet ALGO plus a 0\.001 network fee, the same 0\.01 as on MainNet/)
    assert.match(t, /Never its birthplace, birthday, story or anything else about you/)
    await page.getByLabel('Include the name “Orbi”').check()
    await page.getByRole('button', { name: 'Mint for 0.01 TestNet ALGO' }).click()
    await page.getByRole('alert').waitFor()
    assert.deepEqual(posts[0], { companionId: 'c-1', publicName: 'Orbi' })
    // the wallet was asked to sign exactly one payment: 0.01 to the issuer, with this mint's note
    const asked = await page.evaluate(() => window.__signRequests.map(g => g.map(t => ({ type: t.type, to: t.payment?.receiver?.toString(), amount: Number(t.payment?.amount), note: new TextDecoder().decode(t.note) }))))
    assert.deepEqual(asked, [[{ type: 'pay', to: issuer, amount: 10000, note: fee.note }]])
    assert.equal(await page.getByRole('alert').innerText(), 'Nothing was signed, so nothing happened.')
    assert.equal(await page.getByRole('button', { name: 'Pay 0.01 TestNet ALGO and mint' }).count(), 1, 'can try again')
    assert.deepEqual(errors, [])
    await close()
  }

  // 2. MainNet wording: no rehearsal, the fee buys and burns COZMC, no faucet
  {
    const { page, errors, close } = await open({ network: 'mainnet' })
    await page.getByRole('button', { name: 'Mint for 0.01 ALGO' }).waitFor()
    const t = await text(page)
    assert.doesNotMatch(t, /TestNet|rehearsal|faucet/)
    assert.match(t, /Mint fee: 0\.01 ALGO, which buys COZMC and burns it, plus about 0\.006 ALGO in network fees/)
    assert.deepEqual(errors, [])
    await close()
  }

  // 3. minted, not yet received: the asset link, what accepting it holds back, and the Receive button
  {
    const { page, errors, close } = await open({ mints: [row({ status: 'confirmed', assetId: 7123, explorer: 'https://lora.algokit.io/testnet/asset/7123', delivery: { status: 'awaiting_optin', txid: null }, fee: undefined })] })
    await page.getByRole('button', { name: 'Receive in my wallet' }).waitFor()
    const t = await text(page)
    assert.match(t, /Orbi is Starprint #7 on Algorand TestNet, asset 7123\. It’s ready to send to your wallet\./)
    assert.match(t, /holds back 0\.1 TestNet ALGO of your balance while you keep it/)
    assert.equal(await page.getByRole('link', { name: '7123' }).getAttribute('href'), 'https://lora.algokit.io/testnet/asset/7123')
    assert.deepEqual(errors, [])
    await close()
  }

  // 4. delivered
  {
    const { page, errors, close } = await open({ mints: [row({ status: 'confirmed', assetId: 7123, delivery: { status: 'delivered', txid: 'X' }, fee: undefined })] })
    await page.getByText('It’s in your wallet.').waitFor()
    assert.equal(await page.getByRole('button').count(), 0)
    assert.deepEqual(errors, [])
    await close()
  }
  console.log('Starprint panel browser test passed.')
} finally {
  await browser.close()
}
