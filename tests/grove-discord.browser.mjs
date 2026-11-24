/* The Light the Grove showcase link in real Chrome: for a verified, eligible wallet once lighting has closed,
   the Grove offers the COZMC Discord, using the shared invite in src/config.ts. Run from the COZMC checkout:
     node tests/grove-discord.browser.mjs        (PW_CHROMIUM may point at an installed Chrome/Chromium)
   The event service is simulated; nothing leaves the test. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const { chromium } = require('playwright')
const root = fileURLToPath(new URL('..', import.meta.url))
const invite = (await readFile(new URL('../src/config.ts', import.meta.url), 'utf8')).match(/discord: '([^']+)'/)[1]
const origin = 'https://grove.test', wallet = 'A'.repeat(58)
const bundle = await build({
  stdin: {
    contents: `import { createRoot } from 'react-dom/client'; import { CommunityHatchPanel } from './src/cozmling/community/CommunityHatchPanel'
      createRoot(document.getElementById('root')).render(<CommunityHatchPanel walletAddress=${JSON.stringify(wallet)} canOpenEgg={() => false} onOpenEgg={() => {}} />)`,
    resolveDir: root, loader: 'tsx', sourcefile: 'grove-entry.tsx',
  },
  bundle: true, write: false, format: 'esm', target: 'es2022', jsx: 'automatic', outdir: 'out', splitting: true,
  loader: { '.webp': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl' }, define: { 'import.meta.env.DEV': 'false' },
})
const files = new Map(bundle.outputFiles.filter(f => f.path.endsWith('.js')).map(f => ['/' + f.path.split('/out/').pop(), f.contents]))

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
try {
  const context = await browser.newContext()
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === origin && url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><div id="root"></div><script type="module" src="/stdin.js"></script>' })
    if (url.origin === origin && files.has(url.pathname)) return route.fulfill({ contentType: 'text/javascript', body: Buffer.from(files.get(url.pathname)) })
    if (url.pathname === '/api/community-hatch') return route.fulfill({ json: {
      eventId: 'site-test', title: 'Light the Grove', phase: 'claim', total: 3, goal: 3,
      opensAt: '2026-11-15T08:00:00Z', endsAt: '2026-11-17T00:00:00Z', claimUntil: '2026-11-24T00:00:00Z',
      eligible: true, contributedToday: false, lanternEligible: false, receipt: null, authenticatedWallet: wallet } })
    return route.abort()
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(origin + '/')
  const link = page.getByRole('link', { name: 'Join the hatchling showcase in Discord' })
  await link.waitFor({ timeout: 10000 })
  assert.equal(await link.getAttribute('href'), invite)
  assert.equal(invite, 'https://discord.gg/VBeBE7MSSq')
  assert.deepEqual(errors, [])
  console.log('Grove Discord showcase browser test passed.')
} finally {
  await browser.close()
}
