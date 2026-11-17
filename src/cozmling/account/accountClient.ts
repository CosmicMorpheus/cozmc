import type { AdventurerCompanion, JourneyEvent } from '../types'
import { companionProblem } from '../store/validators'

const WALLET_ENDPOINT = '/api/cozmling-wallet'
const ACCOUNT_ENDPOINT = '/api/cozmling-account'

export type AccountSnapshot = { record: AdventurerCompanion; events: JourneyEvent[] }
export type AccountCompanion = { revision: number; snapshot: AccountSnapshot }
export type AccountOperation = { action: 'save'; expectedRevision: number; opId: string; snapshot: AccountSnapshot }
export type AccountAdoption = { action: 'adopt'; snapshot: AccountSnapshot }

export class AccountRequestError extends Error {
  status: number
  payload: unknown
  constructor(status: number, payload: unknown) {
    super(status === 401 ? 'Verify this wallet to continue.' : 'The Cozmling account could not be reached. Try again.')
    this.status = status
    this.payload = payload
  }
}

async function request(path: string, signal: AbortSignal, body?: object, wallet?: string): Promise<unknown> {
  signal.throwIfAborted()
  const headers: Record<string, string> = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (wallet) headers['X-COZMC-Wallet'] = wallet
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET', signal, credentials: 'same-origin', cache: 'no-store', headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new AccountRequestError(response.status, payload)
  return payload
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

export async function walletSession(address: string, signal: AbortSignal) {
  const result = object(await request(`${WALLET_ENDPOINT}?wallet=${encodeURIComponent(address)}`, signal))
  return result?.address === address
}

export async function walletChallenge(address: string, signal: AbortSignal) {
  const result = object(await request(WALLET_ENDPOINT, signal, { action: 'challenge', address }))
  if (typeof result?.data !== 'string' || typeof result.token !== 'string') throw new Error('The wallet verification request was incomplete.')
  return { data: result.data, token: result.token }
}

export async function verifyWalletChallenge(
  address: string, challenge: { data: string; token: string },
  proof: { signature: string; authenticatorData: string }, signal: AbortSignal,
) {
  const result = object(await request(WALLET_ENDPOINT, signal, { action: 'verify', ...challenge, ...proof }))
  return result?.address === address
}

export async function walletLogout(address: string, signal: AbortSignal) {
  await request(WALLET_ENDPOINT, signal, { action: 'logout', address }, address)
}

function readCompanion(value: unknown): AccountCompanion {
  const found = object(value)
  const snapshot = object(found?.snapshot)
  const record = object(snapshot?.record)
  if (!found || !Number.isSafeInteger(found.revision) || Number(found.revision) < 0
    || record?.kind !== 'adventurer' || companionProblem(record) || !Array.isArray(snapshot?.events)
    || snapshot.events.some(event => !object(event) || typeof event.eventId !== 'string'
      || event.companionId !== record.companionId || typeof event.type !== 'string' || !Number.isFinite(event.at))) {
    throw new Error('An account save could not be read. Existing saves are still on this device.')
  }
  return value as AccountCompanion
}

export async function accountCompanions(address: string, signal: AbortSignal) {
  const reply = object(await request(ACCOUNT_ENDPOINT, signal, undefined, address))
  if (!Array.isArray(reply?.companions)) throw new Error('The account did not return its companions.')
  return reply.companions.map(readCompanion)
}

export async function accountWrite(address: string, operation: AccountAdoption | AccountOperation, signal: AbortSignal) {
  const reply = object(await request(ACCOUNT_ENDPOINT, signal, operation, address))
  return readCompanion(reply?.companion)
}

/* Starprint NFTs on TestNet (preview builds with VITE_COZMC_STARPRINT_MINT=1). */
const MINT_ENDPOINT = '/api/starprint-mint'
export type StarprintFee = { network: 'testnet' | 'mainnet'; receiver: string; amountMicro: number; note: string; burnsCozmc?: boolean }
export type StarprintMint = {
  companionId: string; serial: number; status: 'awaiting_fee' | 'queued' | 'submitted' | 'confirmed'
  assetId: number | null; txid: string | null; explorer: string | null; publicName: string | null
  fee?: StarprintFee; feeTxid: string | null
  delivery: { status: 'awaiting_optin' | 'sending' | 'delivered'; txid: string | null } | null
}
export type StarprintMintInfo = { network: 'testnet' | 'mainnet'; issuer: string; balanceAlgo: number | null; dailyCap: number; feeMicro?: number; mints: StarprintMint[] }

export async function starprintMints(address: string, signal: AbortSignal): Promise<StarprintMintInfo> {
  const reply = object(await request(MINT_ENDPOINT, signal, undefined, address))
  if (!reply || !Array.isArray(reply.mints)) throw new Error('The Starprint mint service did not answer.')
  return reply as StarprintMintInfo
}

export async function mintStarprint(address: string, companionId: string, extra: { publicName?: string | null; feeTxid?: string }, signal: AbortSignal): Promise<StarprintMint> {
  const reply = object(await request(MINT_ENDPOINT, signal, {
    companionId, ...(extra.publicName ? { publicName: extra.publicName } : {}), ...(extra.feeTxid ? { feeTxid: extra.feeTxid } : {}),
  }, address))
  if (!object(reply?.mint)) throw new Error('The Starprint mint service did not answer.')
  return reply!.mint as StarprintMint
}

export async function deliverStarprint(address: string, companionId: string, signal: AbortSignal): Promise<StarprintMint> {
  const reply = object(await request(MINT_ENDPOINT, signal, { companionId, action: 'deliver' }, address))
  if (!object(reply?.mint)) throw new Error('The Starprint mint service did not answer.')
  return reply!.mint as StarprintMint
}
