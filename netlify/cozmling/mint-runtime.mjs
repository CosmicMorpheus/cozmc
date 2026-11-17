/* The Starprint mint service as the site's settings describe it, for the mint endpoint and the hourly watch. */
import algosdk from 'algosdk'
import { createMintService, MAINNET, TESTNET } from './mint.mjs'

const num = (value, fallback, ok) => { const n = Number(value ?? ''); return value != null && value !== '' && ok(n) ? n : fallback }

export function mintServiceFor(accountConfig, db, env = process.env) {
  const mainnet = env.COZMC_STARPRINT_NETWORK === 'mainnet' && env.COZMC_STARPRINT_MAINNET === '1'
  const net = mainnet ? MAINNET : TESTNET
  return createMintService({
    db, origin: accountConfig.origin,
    dailyCap: num(env.COZMC_STARPRINT_DAILY_CAP, 20, n => Number.isInteger(n) && n >= 0),
    monthlyBudgetAlgo: num(env.COZMC_STARPRINT_MONTHLY_BUDGET_ALGO, null, n => Number.isFinite(n) && n > 0),
    lowBalanceAlgo: num(env.COZMC_STARPRINT_LOW_BALANCE_ALGO, 2, n => Number.isFinite(n) && n >= 0),
    algod: new algosdk.Algodv2('', net.algod, ''), indexer: new algosdk.Indexer('', net.indexer, ''),
    mainnet, issuerMnemonic: env.COZMC_STARPRINT_ISSUER_MNEMONIC, managerAddress: env.COZMC_STARPRINT_MANAGER,
  })
}
