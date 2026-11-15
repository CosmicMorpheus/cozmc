import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { CozmlingRequestError, bindPreviewOrigin, transaction } from './http.mjs'
import { SCHEMA } from './schema.mjs'

const PREVIEW_CONTEXTS = new Set(['deploy-preview', 'branch-deploy', 'dev'])
// The live site's own addresses. The wallet account preview never runs there, whatever is configured.
const LIVE_HOSTS = new Set(['cozmc.us', 'www.cozmc.us'])
export const MAINNET_ALGOD = 'https://mainnet-api.algonode.cloud'

/* The preview's settings, or null where the wallet account is off.
   It runs only in deploy previews, branch deploys and local Netlify dev, or on a separate preview
   site named by its id in COZMC_ACCOUNT_SITE_ID: every deploy of a separate site counts as that
   site's production, so the id is what keeps the live site out even if its settings were copied. */
export function readConfig(context, env = process.env, siteId = undefined) {
  if (env.COZMC_ACCOUNT_ENABLED !== '1') return null
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
  const encoded = env.COZMC_ACCOUNT_SESSION_SECRET ?? ''
  let walletSecret = null
  if (encoded) {
    walletSecret = Buffer.from(encoded, 'base64url')
    if (walletSecret.length !== 32 || walletSecret.toString('base64url') !== encoded) {
      throw new Error('Set the 32-byte Cozmling wallet session secret, or leave it unset.')
    }
  }
  return {
    origin: url.origin,
    secure: url.protocol === 'https:',
    walletSecret,
    algodUrl: MAINNET_ALGOD,
    event: env.COZMC_COMMUNITY_HATCH_EVENT,
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

/** The tables, once per function start. The advisory lock keeps two cold starts from racing. */
export function ensureSchema(db) {
  schemaReady ??= transaction(db, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('cozmling-account-schema'))")
    await client.query(SCHEMA)
  }).catch((error) => {
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

/** The preview database, ready to use and bound to this origin. */
export async function previewPool(config) {
  const db = await pool()
  await ensureSchema(db)
  await bindPreviewOrigin(db, config.origin)
  return db
}

/** The database and the settings with the session key filled in, for the wallet sign-in route. */
export async function previewAccount(config) {
  const db = await previewPool(config)
  return { db, config: config.walletSecret ? config : { ...config, walletSecret: await sessionKey(db) } }
}
