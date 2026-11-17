import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { createAccountService } from '../netlify/cozmling/account.mjs'
import { createCommunityHatchService, readEventConfig } from '../netlify/cozmling/event.mjs'
import { bindPreviewOrigin, readBody, validateRequest } from '../netlify/cozmling/http.mjs'
import { readConfig } from '../netlify/cozmling/runtime.mjs'
import { SCHEMA } from '../netlify/cozmling/schema.mjs'

const wallet = 'A'.repeat(58)
const otherWallet = 'B'.repeat(58)
const origin = 'https://cozmling-hatch-preview.example'
const exampleTime = Date.parse('2026-12-01T00:00:00Z')
const startRecord = (id = randomUUID()) => ({
  companionId: id, kind: 'adventurer', schemaVersion: 2, revision: 0, createdAt: exampleTime, updatedAt: exampleTime,
  name: 'Vega', walletLinks: [], hatch: { status: 'egg', hatchedAt: null, provenance: 'known' },
  starprint: { chosenBirthday: '2026-12-01', element: 'fire', coreSign: 'sagittarius', archetype: 'Explorer', status: 'partial', engineVersion: 'calendar-1' },
  appearance: { appearanceOption: 'a', rendererVersion: 'original-1', home: 'grove', skin: 'moss', outfit: 'starter', decor: [] },
  care: { food: 80, fun: 80, energy: 90, asleepAt: null, settledAt: exampleTime, ruleVersion: 'v1-care' },
  progress: { experience: 0, visualStageVersion: 'fixture-1', visualStage: null, counters: {} },
})
const starter = (id) => ({ record: startRecord(id), events: [] })
const validatesRecord = () => null // Deployed function supplies the original store's companionProblem validator.
const hasError = (code, status) => (error) => error.message === code && error.status === status

function scriptedStore(steps) {
  let releaseCount = 0
  const queue = [...steps]
  const client = {
    async query(sql, params) {
      assert.ok(queue.length, `Unexpected SQL ${sql}`)
      const [pattern, respond] = queue.shift()
      assert.match(sql, pattern)
      return { rows: respond?.(params) ?? [] }
    },
    release() { releaseCount += 1 },
  }
  return { db: { connect: async () => client }, check: () => { assert.deepEqual(queue, []); assert.equal(releaseCount, 1) } }
}

test('only starter eggs with matching owner session can enter the account', async () => {
  const db = { connect() { assert.fail('Rejected writes should leave the database untouched.') } }
  const account = createAccountService({ db, validateRecord: validatesRecord })
  const egg = starter()
  await assert.rejects(account.adopt(null, egg), hasError('wallet_required', 401))
  const nonStarter = { ...egg, record: { ...egg.record, hatch: { ...egg.record.hatch, status: 'hatched', hatchedAt: exampleTime } } }
  await assert.rejects(account.adopt(wallet, nonStarter), hasError('invalid_starter', 400))
  await assert.rejects(account.adopt(wallet, { ...egg, events: [{ eventId: 'care', companionId: egg.record.companionId,
    type: 'care', at: exampleTime }] }), hasError('invalid_starter', 400))
  await assert.rejects(account.adopt(wallet, { ...egg, events: [{ eventId: 'care', companionId: randomUUID(),
    type: 'care', at: exampleTime }] }), hasError('invalid_snapshot', 400))
  await assert.rejects(account.adopt(wallet, { ...egg, record: { ...egg.record, walletLinks: [{ address: otherWallet }] } }),
    hasError('invalid_snapshot', 400))
})

test('adoption races return the authenticated wallet’s existing row and never look up a foreign owner', async () => {
  const existing = starter()
  const proposed = starter()
  const flow = scriptedStore([
    [/^BEGIN$/],
    [/pg_advisory_xact_lock/, (params) => { assert.deepEqual(params, [`cozmling-ordinary:${wallet}`]) }],
    [/WHERE wallet_address = \$1 AND source = 'ordinary'/, (params) => {
      assert.deepEqual(params, [wallet]); return [{ companion_id: existing.record.companionId, revision: 2, snapshot: existing }]
    }],
    [/^COMMIT$/],
  ])
  const account = createAccountService({ db: flow.db, validateRecord: validatesRecord, ordinaryLimit: 1 })
  assert.deepEqual(await account.adopt(wallet, proposed), { companion: { revision: 2, snapshot: existing } }, 'at the limit: the latest existing one')
  flow.check()
})

test('under the per-wallet limit a new Starprint is adopted alongside the first', async () => {
  const existing = starter()
  const proposed = starter()
  const flow = scriptedStore([
    [/^BEGIN$/],
    [/pg_advisory_xact_lock/],
    [/WHERE wallet_address = \$1 AND source = 'ordinary'/, () => [{ companion_id: existing.record.companionId, revision: 2, snapshot: existing }]],
    [/^INSERT INTO cozmling_account_companions/, (params) => {
      assert.deepEqual(params.slice(0, 4), [wallet, proposed.record.companionId, 'ordinary', null])
      return [{ revision: 0, snapshot: JSON.parse(params[4]) }]
    }],
    [/^COMMIT$/],
  ])
  const account = createAccountService({ db: flow.db, validateRecord: validatesRecord })   // the default cap of 10
  const made = await account.adopt(wallet, proposed)
  assert.equal(made.companion.snapshot.record.companionId, proposed.record.companionId)
  flow.check()
})

test('the per-wallet cap: 10 unless set to a whole number from 1 to 100', async () => {
  const { ordinaryLimitFrom } = await import('../netlify/cozmling/account.mjs')
  assert.deepEqual([undefined, '5', '0', '2.5', 'many', '101'].map(v => ordinaryLimitFrom({ COZMC_STARPRINTS_PER_WALLET: v })), [10, 5, 10, 10, 10, 10])
})

test('a wallet cannot use another wallet’s event receipt, or submit a different look', async () => {
  for (const rows of [[], [{ event_id: 'grove', look_id: 'grove-violet' }]]) {
    const egg = starter(`hatch-${randomUUID()}`)
    const flow = scriptedStore([[/^BEGIN$/], [/FROM cozmling_hatch_claims\s+WHERE wallet_address = \$1 AND companion_id = \$2/, (params) => {
      assert.deepEqual(params, [wallet, egg.record.companionId]); return rows
    }], [/^ROLLBACK$/]])
    const account = createAccountService({ db: flow.db, validateRecord: validatesRecord })
    await assert.rejects(account.adopt(wallet, egg), hasError('invalid_hatch_claim', 403))
    flow.check()
  }
})

test('a stale save reports only its own canonical snapshot and commits nothing', async () => {
  const canonical = starter()
  const current = { revision: 2, snapshot: canonical }
  const opId = randomUUID()
  const flow = scriptedStore([[/^BEGIN$/], [/FOR UPDATE$/, (params) => {
    assert.deepEqual(params, [wallet, canonical.record.companionId]); return [current]
  }], [/FROM cozmling_account_save_operations/, (params) => {
    assert.deepEqual(params, [wallet, canonical.record.companionId, opId]); return []
  }], [/^ROLLBACK$/]])
  const account = createAccountService({ db: flow.db, validateRecord: validatesRecord })
  await assert.rejects(account.save(wallet, { expectedRevision: 0, opId, snapshot: canonical }), (error) => {
    assert.ok(hasError('stale_save', 409)(error)); assert.deepEqual(error.fields, { companion: current }); return true
  })
  flow.check()
})

test('HTTP helpers reject cross-origin or malformed writes', async () => {
  const url = `${origin}/api/cozmling-account`
  const bad = new Request(url, { method: 'POST', headers: { origin: 'https://other.example' } })
  assert.equal(validateRequest(bad, origin).status, 403)
  const correct = new Request(url, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '[]' })
  assert.equal(validateRequest(correct, origin), null)
  await assert.rejects(readBody(correct), hasError('invalid_request', 400))
})

const testDb = process.env.COZMLING_TEST_DATABASE_URL
test('an already-bound review database refuses a second preview origin', async () => {
  let current = null
  const db = { async query(sql, params) {
    if (sql.startsWith('INSERT')) {
      current ??= params[0]
      return { rows: [] }
    }
    return { rows: [{ origin: current }] }
  } }
  await bindPreviewOrigin(db, origin)
  await assert.rejects(bindPreviewOrigin(db, 'https://different.example'), hasError('preview_database_mismatch', 503))
  await bindPreviewOrigin(db, origin)
})

test('a confirmed contribution remains eligible for a wallet’s single draw even if the goal is missed', async () => {
  const config = readEventConfig(JSON.stringify({ eventId: 'light-the-grove', title: 'Light the Grove',
    opensAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-08T00:00:00Z', claimUntil: '2026-12-15T00:00:00Z', goal: 15 }))
  const id = randomUUID()
  const contributed = { fingerprint: config.fingerprint, total: '1', eligible: true, contributed_today: false, receipt: null }
  const receipt = { companionId: `hatch-${id}`, lookId: 'grove-cyan' }
  const flow = scriptedStore([
    [/^BEGIN$/],
    [/^SELECT/, (params) => {
      assert.deepEqual(params, ['light-the-grove', wallet, '2026-12-08']); return [contributed]
    }],
    [/^INSERT INTO cozmling_hatch_events/],
    [/^INSERT INTO cozmling_hatch_claims/, (params) => {
      assert.deepEqual(params, ['light-the-grove', wallet, receipt.companionId, receipt.lookId])
    }],
    [/^SELECT/, () => [{ ...contributed, receipt }]],
    [/^COMMIT$/],
  ])
  const hatch = createCommunityHatchService({ db: flow.db, config, clock: () => config.endMs, receiptId: () => id, drawIndex: () => 2 })
  await assert.rejects(hatch.act(null, 'claim'), hasError('wallet_required', 401))
  const status = await hatch.act(wallet, 'claim')
  assert.equal(status.authenticatedWallet, wallet)
  assert.equal(status.phase, 'claim')
  assert.equal(status.lanternEligible, false)
  assert.deepEqual(status.receipt, receipt)
  flow.check()
})

test('PostgreSQL integration verifies account isolation, contention, history, and one wallet hatch', { skip: !testDb }, async () => {
  const { default: pg } = await import('pg')
  const namespace = `cozmling_test_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Pool({ connectionString: testDb })
  const db = new pg.Pool({ connectionString: testDb, options: `-c search_path=${namespace}` })
  try {
    await admin.query(`CREATE SCHEMA ${namespace}`)
    await db.query(SCHEMA)
    await db.query(SCHEMA)          // applying it again changes nothing
    await bindPreviewOrigin(db, origin)
    await assert.rejects(bindPreviewOrigin(db, 'https://different.example'), hasError('preview_database_mismatch', 503))
    const account = createAccountService({ db, validateRecord: validatesRecord, ordinaryLimit: 1 })
    const [a, b] = await Promise.all([account.adopt(wallet, starter()), account.adopt(wallet, starter())])
    assert.deepEqual(a, b, 'at a cap of 1, two adoptions at once give the same Starprint')
    assert.deepEqual(await account.list(otherWallet), { companions: [] })
    const duplicate = starter(a.companion.snapshot.record.companionId)
    await assert.rejects(account.adopt(otherWallet, duplicate), hasError('adoption_conflict', 409))
    await assert.rejects(account.save(otherWallet, { opId: randomUUID(), expectedRevision: 0, snapshot: duplicate }),
      hasError('companion_missing', 404))

    const edited = structuredClone(a.companion.snapshot)
    edited.record.name = 'Nova'
    edited.record.revision += 1
    const opId = randomUUID()
    const operation = { opId, expectedRevision: 0, snapshot: edited }
    const [saved, again] = await Promise.all([account.save(wallet, operation), account.save(wallet, operation)])
    assert.equal(saved.companion.revision, 1)
    assert.deepEqual(again, saved)
    await assert.rejects(account.save(wallet, { ...operation, opId: randomUUID() }), hasError('stale_save', 409))
    await assert.rejects(account.save(wallet, { ...operation, opId: randomUUID(), expectedRevision: 1,
      snapshot: { ...edited, events: [] } }), hasError('history_changed', 409))

    const config = readEventConfig(JSON.stringify({ eventId: 'light-the-grove', title: 'Light the Grove',
      opensAt: '2026-12-01T00:00:00Z', endsAt: '2026-12-08T00:00:00Z', claimUntil: '2026-12-15T00:00:00Z', goal: 15 }))
    let now = config.openMs
    const hatch = createCommunityHatchService({ db, config, clock: () => now, drawIndex: () => 0 })
    await Promise.all([hatch.act(wallet, 'contribute'), hatch.act(wallet, 'contribute')])
    assert.equal((await hatch.get(null)).total, 1)
    now = config.endMs
    await assert.rejects(hatch.act(otherWallet, 'claim'), hasError('not_eligible', 403))
    const [first, againClaim] = await Promise.all([hatch.act(wallet, 'claim'), hatch.act(wallet, 'claim')])
    assert.deepEqual(first.receipt, againClaim.receipt)
    assert.equal(first.lanternEligible, false)
    assert.equal(first.receipt.lookId, 'grove-green')
    assert.equal((await account.adopt(wallet, starter(first.receipt.companionId))).companion.snapshot.record.companionId,
      first.receipt.companionId)
    assert.equal((await account.list(wallet)).companions.length, 2)
  } finally {
    await db.end()
    try { await admin.query(`DROP SCHEMA IF EXISTS ${namespace} CASCADE`) } finally { await admin.end() }
  }
})

test('the account runs only in previews: deploy previews and branch deploys, or the separate preview site by its id, never the live site', () => {
  const env = { COZMC_ACCOUNT_ENABLED: '1', COZMC_ACCOUNT_ORIGIN: 'https://cozmc-preview.netlify.app' }
  const site = 'f4ead5e2-a563-4527-b2e9-08a4d41c2874'
  assert.equal(readConfig('production', env, site), null, 'production is off without a named preview site')
  assert.equal(readConfig('production', { ...env, COZMC_ACCOUNT_SITE_ID: site }, 'e7ab8d5b-45c4-4182-8bcf-efc3ed4e3609'), null, 'another site’s production (the live site) stays off')
  const preview = readConfig('production', { ...env, COZMC_ACCOUNT_SITE_ID: site }, site)
  assert.deepEqual([preview.origin, preview.secure, preview.walletSecret], ['https://cozmc-preview.netlify.app', true, null], 'no secret: the preview database keeps its own')
  assert.ok(readConfig('deploy-preview', env, 'any'))
  assert.equal(readConfig('deploy-preview', { ...env, COZMC_ACCOUNT_ENABLED: '0' }, 'any'), null)
  assert.throws(() => readConfig('deploy-preview', { ...env, COZMC_ACCOUNT_ORIGIN: 'https://cozmc.us' }), /never runs on the live site/)
  assert.throws(() => readConfig('deploy-preview', { ...env, COZMC_ACCOUNT_ORIGIN: 'https://cozmc-preview.netlify.app/' }), /exact preview origin/)
  assert.throws(() => readConfig('deploy-preview', { ...env, COZMC_ACCOUNT_SESSION_SECRET: 'short' }), /32-byte/)
  assert.equal(readConfig('deploy-preview', { ...env, COZMC_ACCOUNT_SESSION_SECRET: Buffer.alloc(32, 9).toString('base64url') }).walletSecret.length, 32)
})
