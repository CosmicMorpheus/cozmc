/* The Netlify Database migrations (netlify/database/migrations/), which Netlify applies on deploy before publishing.
   - The newest one records the code's schema version, so raising SCHEMA_VERSION without a migration fails here.
   - On real PostgreSQL: applied in order to an empty database, they give exactly the code's tables and version; and
     they are safe on a database that already has them (the preview's, which made its own tables at runtime).
   The database part runs when COZMLING_TEST_DATABASE_URL names a disposable database. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { SCHEMA, SCHEMA_VERSION } from '../netlify/cozmling/schema.mjs'

const dir = new URL('../netlify/database/migrations/', import.meta.url)
const files = readdirSync(dir).filter(f => /^\d+_[a-z0-9_-]+\.sql$/.test(f)).sort()
const sql = (f: string) => readFileSync(new URL(f, dir), 'utf8')

test('the newest migration records the schema version the code needs', () => {
  assert.ok(files.length > 0)
  const newest = sql(files[files.length - 1])
  assert.match(newest, new RegExp(`INSERT INTO cozmc_schema_version \\(singleton, version\\) VALUES \\(TRUE, ${SCHEMA_VERSION}\\)`),
    `raise SCHEMA_VERSION only together with a new migration in netlify/database/migrations (newest: ${files.at(-1)})`)
})

test('production accepts the live site’s Netlify Database', async () => {
  const { readConfig } = await import('../netlify/cozmling/runtime.mjs')
  const env = { COZMC_ACCOUNT_ENABLED: '1', COZMC_PRODUCTION: '1', COZMC_PRODUCTION_SITE_ID: 'live', COZMC_ACCOUNT_ORIGIN: 'https://cozmc.us',
    COZMC_ACCOUNT_SESSION_SECRET: Buffer.alloc(32, 1).toString('base64url') }
  assert.equal(readConfig('production', { ...env, NETLIFY_DB_URL: 'postgres://netlify.example/db' }, 'live').production, true)
  assert.throws(() => readConfig('production', env, 'live'), /its own database/)
})

const testDb = process.env.COZMLING_TEST_DATABASE_URL
test('real PostgreSQL: the migrations build the code’s tables, and are safe on a database that already has them', { skip: !testDb }, async () => {
  const { default: pg } = await import('pg')
  const { schemaVersion } = await import('../netlify/cozmling/runtime.mjs')
  const admin = new pg.Pool({ connectionString: testDb })
  const fresh = async () => {
    const ns = `mig_${randomUUID().replaceAll('-', '')}`
    await admin.query(`CREATE SCHEMA ${ns}`)
    const url = new URL(testDb!); url.searchParams.set('options', `-c search_path=${ns}`)
    return { ns, db: new pg.Pool({ connectionString: url.toString() }) }
  }
  const tables = async (db: any, ns: string) => (await db.query(`SELECT table_name, column_name, data_type FROM information_schema.columns
    WHERE table_schema = $1 ORDER BY table_name, column_name`, [ns])).rows.map((r: any) => `${r.table_name}.${r.column_name}:${r.data_type}`)
  const a = await fresh(), b = await fresh()
  try {
    for (const f of files) await a.db.query(sql(f))             // a new site: Netlify applies each migration once
    assert.equal(await schemaVersion(a.db), SCHEMA_VERSION)
    await b.db.query(SCHEMA)                                    // the code's own tables, as the preview made them at runtime
    assert.deepEqual(await tables(a.db, a.ns), await tables(b.db, b.ns), 'the migrations give exactly the code’s tables')
    for (const f of files) await b.db.query(sql(f))             // and on a database that already has them, nothing breaks
    assert.equal(await schemaVersion(b.db), SCHEMA_VERSION)
  } finally {
    for (const { ns, db } of [a, b]) { await db.end(); await admin.query(`DROP SCHEMA ${ns} CASCADE`) }
    await admin.end()
  }
})
