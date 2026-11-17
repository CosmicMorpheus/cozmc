/* Production on cozmc.us: it turns on only when every production setting is there, never from a preview's
   settings, with its own database and secret, never migrating itself, and each launch switch off unless set.
   The database part runs when COZMLING_TEST_DATABASE_URL names a disposable database. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { readConfig } from '../netlify/cozmling/runtime.mjs'

const LIVE_SITE = 'e7ab8d5b-45c4-4182-8bcf-efc3ed4e3609'
const secret = Buffer.alloc(32, 7).toString('base64url')
const prod = {
  COZMC_ACCOUNT_ENABLED: '1', COZMC_PRODUCTION: '1', COZMC_PRODUCTION_SITE_ID: LIVE_SITE,
  COZMC_ACCOUNT_ORIGIN: 'https://cozmc.us', DATABASE_URL: 'postgres://prod.example/cozmc', COZMC_ACCOUNT_SESSION_SECRET: secret,
}

test('production runs on cozmc.us only with every production setting, and its switches start off', () => {
  const config = readConfig('production', prod, LIVE_SITE)
  assert.equal(config.origin, 'https://cozmc.us')
  assert.equal(config.production, true)
  assert.equal(config.walletSecret.length, 32)
  assert.deepEqual(config.switches, { game: false, mint: false, mintPaused: false }, 'game and minting off until switched on')
  assert.deepEqual(readConfig('production', { ...prod, COZMC_GAME_ENABLED: '1', COZMC_STARPRINT_MINT: '1', COZMC_STARPRINT_PAUSED: '1' }, LIVE_SITE).switches,
    { game: true, mint: true, mintPaused: true })
})

test('production stays off, or refuses to start, when anything is missing or wrong', () => {
  assert.equal(readConfig('production', { ...prod, COZMC_ACCOUNT_ENABLED: undefined }, LIVE_SITE), null, 'the wallet switch off: everything off, as today')
  assert.equal(readConfig('production', { ...prod, COZMC_PRODUCTION: undefined }, LIVE_SITE), null, 'without COZMC_PRODUCTION the live site stays off')
  assert.equal(readConfig('production', prod, 'some-other-site'), null, 'settings copied to another site do nothing')
  assert.throws(() => readConfig('production', { ...prod, COZMC_ACCOUNT_ORIGIN: 'https://www.cozmc.us' }, LIVE_SITE), /only at https:\/\/cozmc\.us/)
  assert.throws(() => readConfig('production', { ...prod, COZMC_ACCOUNT_ORIGIN: 'https://cozmc-preview.netlify.app' }, LIVE_SITE), /only at https:\/\/cozmc\.us/)
  assert.throws(() => readConfig('production', { ...prod, DATABASE_URL: '' }, LIVE_SITE), /its own database/)
  assert.throws(() => readConfig('production', { ...prod, COZMC_ACCOUNT_SESSION_SECRET: '' }, LIVE_SITE), /32-byte/)
  assert.throws(() => readConfig('production', { ...prod, COZMC_ACCOUNT_SESSION_SECRET: 'short' }, LIVE_SITE), /32-byte/)
})

test('a deploy preview never runs as production, even with production settings', () => {
  assert.throws(() => readConfig('deploy-preview', prod, LIVE_SITE), /never runs on the live site/)
  const preview = readConfig('deploy-preview', { ...prod, COZMC_ACCOUNT_ORIGIN: 'https://cozmc-preview.netlify.app' }, LIVE_SITE)
  assert.equal(preview.production, false)
  assert.equal(preview.switches.game, true, 'previews keep the game on, as before')
})

const testDb = process.env.COZMLING_TEST_DATABASE_URL
test('real PostgreSQL: production never migrates itself; the migration script brings it up to date', { skip: !testDb }, async () => {
  const { default: pg } = await import('pg')
  const { SCHEMA_VERSION } = await import('../netlify/cozmling/schema.mjs')
  const { migrate, schemaVersion } = await import('../netlify/cozmling/runtime.mjs')
  const { transaction } = await import('../netlify/cozmling/http.mjs')
  const namespace = `prod_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Pool({ connectionString: testDb })
  await admin.query(`CREATE SCHEMA ${namespace}`)
  const url = new URL(testDb!); url.searchParams.set('options', `-c search_path=${namespace}`)
  const db = new pg.Pool({ connectionString: url.toString() })
  try {
    assert.equal(await schemaVersion(db), 0, 'an empty database')
    // what a production function does on an unmigrated database: refuse, and create nothing
    const runtime = await import('../netlify/cozmling/runtime.mjs')
    process.env.DATABASE_URL = url.toString()
    const config = readConfig('production', { ...prod, DATABASE_URL: url.toString() }, LIVE_SITE)
    await assert.rejects(runtime.previewPool(config), /database_not_migrated/)
    const { rows } = await db.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = $1", [namespace])
    assert.equal(rows[0].n, 0, 'production created no tables by itself')
    // the migration script's step, twice: the version is recorded, and running it again changes nothing
    await transaction(db, migrate)
    await transaction(db, migrate)
    assert.equal(await schemaVersion(db), SCHEMA_VERSION)
    const ready = await runtime.previewPool(config)
    assert.ok(ready)
    const { rows: [scope] } = await db.query('SELECT origin FROM cozmling_preview_scope')
    assert.equal(scope.origin, 'https://cozmc.us', 'the database is bound to cozmc.us, so a preview can never use it')
  } finally {
    delete process.env.DATABASE_URL
    await db.end()
    await admin.query(`DROP SCHEMA ${namespace} CASCADE`)
    await admin.end()
  }
})

test('real PostgreSQL: the instant pause takes effect on the next request, and resumes', { skip: !testDb }, async () => {
  const { default: pg } = await import('pg')
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const { migrate, mintPausedNow } = await import('../netlify/cozmling/runtime.mjs')
  const { transaction } = await import('../netlify/cozmling/http.mjs')
  const namespace = `pause_${randomUUID().replaceAll('-', '')}`
  const admin = new pg.Pool({ connectionString: testDb })
  await admin.query(`CREATE SCHEMA ${namespace}`)
  const url = new URL(testDb!); url.searchParams.set('options', `-c search_path=${namespace}`)
  const db = new pg.Pool({ connectionString: url.toString() })
  const run = (arg: string) => promisify(execFile)('node', ['scripts/starprint-pause.mjs', arg], { env: { ...process.env, DATABASE_URL: url.toString() } })
  try {
    await transaction(db, migrate)
    assert.equal(await mintPausedNow(db), false)
    assert.match((await run('on')).stdout, /PAUSED/)
    assert.equal(await mintPausedNow(db), true)
    assert.match((await run('off')).stdout, /running/)
    assert.equal(await mintPausedNow(db), false)
  } finally {
    await db.end()
    await admin.query(`DROP SCHEMA ${namespace} CASCADE`)
    await admin.end()
  }
})

test('a preview function start leaves an up-to-date database alone (no table locks to deadlock with a hatch)', async () => {
  const { ensureSchema } = await import('../netlify/cozmling/runtime.mjs')
  const { SCHEMA_VERSION } = await import('../netlify/cozmling/schema.mjs')
  const queries: string[] = []
  const db = {
    async query(sql: string) { queries.push(sql); return { rows: sql.includes('cozmc_schema_version') ? [{ version: SCHEMA_VERSION }] : [] } },
    async connect() { throw new Error('no transaction should be opened') },
  }
  await ensureSchema(db)
  assert.deepEqual(queries.map(q => q.replace(/\s+/g, ' ').trim()), ['SELECT version FROM cozmc_schema_version WHERE singleton = TRUE'], 'only the version is read')
})
