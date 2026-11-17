import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { CozmlingRequestError, bindPreviewOrigin, transaction } from './http.mjs'
import { SCHEMA, SCHEMA_VERSION } from './schema.mjs'

const PREVIEW_CONTEXTS = new Set(['deploy-preview', 'branch-deploy', 'dev'])
// The live site's own addresses. The wallet account preview never runs there, whatever is configured.
const LIVE_HOSTS = new Set(['cozmc.us', 'www.cozmc.us'])
/** The one address production runs at. */
export const PRODUCTION_ORIGIN = 'https://cozmc.us'
export const MAINNET_ALGOD = 'https://mainnet-api.algonode.cloud'

/** The independent launch switches. Production keeps each one off unless it is set to 1; previews keep the
    game on unless COZMC_GAME_ENABLED=0, as they always ran. Wallet sign-in is COZMC_ACCOUNT_ENABLED itself. */
function switchesFrom(env, production) {
  return {
    game: production ? env.COZMC_GAME_ENABLED === '1' : env.COZMC_GAME_ENABLED !== '0',
    mint: env.COZMC_STARPRINT_MINT === '1',
    mintPaused: env.COZMC_STARPRINT_PAUSED === '1',
  }
}

function sessionSecret(env) {
  const encoded = env.COZMC_ACCOUNT_SESSION_SECRET ?? ''
  if (!encoded) return null
  const secret = Buffer.from(encoded, 'base64url')
  if (secret.length !== 32 || secret.toString('base64url') !== encoded) {
    throw new Error('Set the 32-byte Cozmling wallet session secret, or leave it unset.')
  }
  return secret
}

/* The account's settings, or null where the wallet account is off.

   Previews: deploy previews, branch deploys and local Netlify dev, or a separate preview site named by its id in
   COZMC_ACCOUNT_SITE_ID (every deploy of a separate site counts as that site's production, so the id is what
   keeps the live site out even if its settings were copied). Never at a live address.

   Production (cozmc.us): only when every one of these is set on the live site, so nothing turns it on by accident:
   COZMC_ACCOUNT_ENABLED=1 and COZMC_PRODUCTION=1, COZMC_PRODUCTION_SITE_ID naming this site, COZMC_ACCOUNT_ORIGIN
   exactly https://cozmc.us, its own database (the live site's Netlify Database, or a DATABASE_URL, never the preview's)
   and a 32-byte COZMC_ACCOUNT_SESSION_SECRET.
   The game and minting then have their own switches, off unless set (see switchesFrom). */
export function readConfig(context, env = process.env, siteId = undefined) {
  if (env.COZMC_ACCOUNT_ENABLED !== '1') return null

  if (context === 'production' && env.COZMC_PRODUCTION === '1') {
    if (!env.COZMC_PRODUCTION_SITE_ID || env.COZMC_PRODUCTION_SITE_ID !== siteId) return null   // settings copied to another site
    if (env.COZMC_ACCOUNT_ORIGIN !== PRODUCTION_ORIGIN) throw new Error('Production runs only at https://cozmc.us.')
    // its own database: the live site's Netlify Database (NETLIFY_DB_URL, set by Netlify), or an explicit DATABASE_URL
    if (!env.DATABASE_URL && !env.NETLIFY_DB_URL) throw new Error('Production needs its own database (Netlify Database or DATABASE_URL).')
    const walletSecret = sessionSecret(env)
    if (!walletSecret) throw new Error('Production needs a 32-byte COZMC_ACCOUNT_SESSION_SECRET.')
    return {
      origin: PRODUCTION_ORIGIN, secure: true, walletSecret, algodUrl: MAINNET_ALGOD,
      event: env.COZMC_COMMUNITY_HATCH_EVENT, production: true, switches: switchesFrom(env, true),
    }
  }

  const previewSite = context === 'production' && !!env.COZMC_ACCOUNT_SITE_ID && env.COZMC_ACCOUNT_SITE_ID === siteId
  if (!PREVIEW_CONTEXTS.has(context) && !previewSite) return null

  const url = new URL(env.COZMC_ACCOUNT_ORIGIN)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.origin !== env.COZMC_ACCOUNT_ORIGIN ||
      (url.protocol !== 'https:' && !(context === 'dev' && loopback && url.protocol === 'http:'))) {
    throw new Error('Set the exact preview origin, using HTTPS outside loopback development.')
  }
  if (LIVE_HOSTS.has(url.hostname)) throw new Error('The wallet account preview never runs on the live site.')

  // An explicit secret is optional: without one, the preview database keeps its own (see sessionKey).
  return {
    origin: url.origin,
    secure: url.protocol === 'https:',
    walletSecret: sessionSecret(env),
    algodUrl: MAINNET_ALGOD,
    event: env.COZMC_COMMUNITY_HATCH_EVENT,
    production: false,
    switches: switchesFrom(env, false),
  }
}

let accountPool

/** An explicitly configured database (DATABASE_URL) first; otherwise the site's own Netlify Database. */
async function pool() {
  if (accountPool) return accountPool
  if (process.env.DATABASE_URL) {
    accountPool = new pg.Pool({ connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 4000, idleTimeoutMillis: 15000, max: 3, allowExitOnIdle: true })
    return accountPool
  }
  const { getDatabase } = await import('@netlify/database')
  try {
    accountPool = getDatabase().pool
  } catch (error) {
    if (error?.name === 'MissingDatabaseConnectionError') throw new CozmlingRequestError('preview_database_missing', 503)
    throw error
  }
  return accountPool
}

let schemaReady

/** Bring the tables up to date (a preview at each function start; production only through scripts/db-migrate.mjs).
    The advisory lock keeps two starts from racing; the version is recorded so production can check it. */
export async function migrate(client) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('cozmling-account-schema'))")
  await client.query(SCHEMA)
  await client.query(`INSERT INTO cozmc_schema_version (singleton, version) VALUES (TRUE, $1)
    ON CONFLICT (singleton) DO UPDATE SET version = GREATEST(cozmc_schema_version.version, EXCLUDED.version), applied_at = now()`, [SCHEMA_VERSION])
}

/** The database's recorded schema version, or 0 before the first migration. */
export async function schemaVersion(db) {
  try {
    const { rows: [row] } = await db.query('SELECT version FROM cozmc_schema_version WHERE singleton = TRUE')
    return row?.version ?? 0
  } catch (error) {
    if (error?.code === '42P01') return 0              // no such table yet
    throw error
  }
}

export function ensureSchema(db) {
  // Already up to date: change nothing. Even an "IF NOT EXISTS" table change takes a lock on the whole table, and a
  // function starting while another one is mid-hatch could deadlock with it (seen on the preview: Postgres 40P01).
  schemaReady ??= schemaVersion(db).then((version) => version >= SCHEMA_VERSION ? undefined : transaction(db, migrate)).catch((error) => {
    schemaReady = undefined
    throw error
  })
  return schemaReady
}

let storedKey

/** The key that signs sign-in challenges when no secret is configured: made once, kept in the database. */
export function sessionKey(db) {
  storedKey ??= (async () => {
    await db.query(`INSERT INTO cozmc_wallet_secret (singleton, secret) VALUES (TRUE, $1)
      ON CONFLICT (singleton) DO NOTHING`, [randomBytes(32)])
    const { rows: [row] } = await db.query('SELECT secret FROM cozmc_wallet_secret WHERE singleton = TRUE')
    const key = row?.secret ? Buffer.from(row.secret) : null
    if (key?.length !== 32) throw new Error('The preview session key could not be read.')
    return key
  })().catch((error) => {
    storedKey = undefined
    throw error
  })
  return storedKey
}

let productionChecked

/** The account database, ready to use and bound to this origin. A preview migrates itself; production never
    does: it only checks that scripts/db-migrate.mjs has brought it to this code's version, and stops if not. */
export async function previewPool(config) {
  const db = await pool()
  if (config.production) {
    productionChecked ??= schemaVersion(db).then((version) => {
      if (version < SCHEMA_VERSION) throw new CozmlingRequestError('database_not_migrated', 503)
    }).catch((error) => { productionChecked = undefined; throw error })
    await productionChecked
  } else {
    await ensureSchema(db)
  }
  await bindPreviewOrigin(db, config.origin)
  return db
}

/** The database and the settings with the session key filled in, for the wallet sign-in route.
    (Production always has its secret from the environment, so it never reads or makes a stored key.) */
export async function previewAccount(config) {
  const db = await previewPool(config)
  return { db, config: config.walletSecret ? config : { ...config, walletSecret: await sessionKey(db) } }
}

/** The instant pause (scripts/starprint-pause.mjs): read on every request, so it needs no redeploy. */
export async function mintPausedNow(db) {
  const { rows: [row] } = await db.query("SELECT value FROM cozmc_runtime_flags WHERE name = 'starprint_paused'")
  return row?.value === true
}
