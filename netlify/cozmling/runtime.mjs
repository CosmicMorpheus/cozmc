import pg from 'pg'
import { bindPreviewOrigin } from './http.mjs'

const PREVIEW_CONTEXTS = new Set(['deploy-preview', 'branch-deploy', 'dev'])
export const MAINNET_ALGOD = 'https://mainnet-api.algonode.cloud'

export function readConfig(context, env = process.env) {
  if (!PREVIEW_CONTEXTS.has(context) || env.COZMC_ACCOUNT_ENABLED !== '1') return null

  const url = new URL(env.COZMC_ACCOUNT_ORIGIN)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.origin !== env.COZMC_ACCOUNT_ORIGIN ||
      (url.protocol !== 'https:' && !(context === 'dev' && loopback && url.protocol === 'http:'))) {
    throw new Error('Set the exact preview origin, using HTTPS outside loopback development.')
  }
  const encoded = env.COZMC_ACCOUNT_SESSION_SECRET ?? ''
  const walletSecret = Buffer.from(encoded, 'base64url')
  if (walletSecret.length !== 32 || walletSecret.toString('base64url') !== encoded) {
    throw new Error('Set the 32-byte Cozmling wallet session secret.')
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

function pool() {
  if (!process.env.DATABASE_URL) throw new Error('Set a private preview PostgreSQL connection string.')
  accountPool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 4000, idleTimeoutMillis: 15000, max: 3, allowExitOnIdle: true })
  return accountPool
}

export async function previewPool(config) {
  const db = pool()
  await bindPreviewOrigin(db, config.origin)
  return db
}
