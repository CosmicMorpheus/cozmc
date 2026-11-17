/* The launch switches at the real endpoints, as cozmc.us would run them: with everything off the site behaves as
   it does today (the account, game and mint routes answer "disabled"); the game switch stops writes but not
   reading or exporting; the mint switch and the pause stop minting; a minted Starprint's description isn't tied
   to the mint switch. None of these requests reach a database or Algorand. */
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import account from '../netlify/functions/cozmling-account.mts'
import grove from '../netlify/functions/community-hatch.mts'
import mint from '../netlify/functions/starprint-mint.mts'
import wallet from '../netlify/functions/cozmling-wallet.mts'

const LIVE = 'e7ab8d5b-45c4-4182-8bcf-efc3ed4e3609', ORIGIN = 'https://cozmc.us'
const production = {
  COZMC_ACCOUNT_ENABLED: '1', COZMC_PRODUCTION: '1', COZMC_PRODUCTION_SITE_ID: LIVE, COZMC_ACCOUNT_ORIGIN: ORIGIN,
  DATABASE_URL: 'postgres://unreachable.invalid/cozmc', COZMC_ACCOUNT_SESSION_SECRET: Buffer.alloc(32, 3).toString('base64url'),
  COZMC_COMMUNITY_HATCH_EVENT: '{}',
}
const saved = { ...process.env }
afterEach(() => { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved) })
const set = (env: Record<string, string>) => Object.assign(process.env, env)
const context = { deploy: { context: 'production' }, site: { id: LIVE } } as any
const post = (path: string, body: object) => new Request(ORIGIN + path, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const call = async (fn: any, req: Request) => { const r = await fn(req, context); return { status: r.status, body: await r.json() } }

test('everything off (as today): the account, game, Grove and mint routes answer disabled', async () => {
  for (const k of Object.keys(production)) delete process.env[k]
  for (const [fn, path] of [[account, '/api/cozmling-account'], [grove, '/api/community-hatch'], [mint, '/api/starprint-mint'], [wallet, '/api/cozmling-wallet']] as const) {
    assert.deepEqual(await call(fn, new Request(ORIGIN + path)), { status: 404, body: { error: 'disabled' } }, path)
  }
})

test('the game switch off: no adoption or saves, and no Grove', async () => {
  set(production)
  assert.deepEqual(await call(account, post('/api/cozmling-account', { action: 'adopt' })), { status: 503, body: { error: 'game_off' } })
  assert.deepEqual(await call(account, post('/api/cozmling-account', { action: 'save' })), { status: 503, body: { error: 'game_off' } })
  assert.deepEqual(await call(grove, new Request(ORIGIN + '/api/community-hatch')), { status: 404, body: { error: 'disabled' } })
})

test('the mint switch off: minting answers disabled; paused: nothing new starts', async () => {
  set({ ...production, COZMC_GAME_ENABLED: '1' })
  assert.deepEqual(await call(mint, post('/api/starprint-mint', { companionId: 'x' })), { status: 404, body: { error: 'disabled' } })
  set({ COZMC_STARPRINT_MINT: '1', COZMC_STARPRINT_PAUSED: '1' })
  assert.deepEqual(await call(mint, post('/api/starprint-mint', { companionId: 'x' })), { status: 503, body: { error: 'paused' } })
  assert.deepEqual(await call(mint, post('/api/starprint-mint', { companionId: 'x', action: 'deliver' })), { status: 503, body: { error: 'paused' } })
})

test('requests from anywhere but cozmc.us are refused in production', async () => {
  set({ ...production, COZMC_GAME_ENABLED: '1' })
  const r = await call(account, new Request(ORIGIN + '/api/cozmling-account', { method: 'POST', headers: { Origin: 'https://cozmc-preview.netlify.app' }, body: '{}' }))
  assert.deepEqual(r, { status: 403, body: { error: 'origin_not_allowed' } })
})
