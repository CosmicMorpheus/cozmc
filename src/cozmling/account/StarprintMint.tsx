/* "Mint on TestNet": a verified owner turns a hatched Starprint into a one-of-one Algorand TestNet asset,
   a rehearsal for the MainNet launch. The player pays the mint fee from their wallet: 0.01 TestNet ALGO
   here (no value). On MainNet the fee will be 0.01 ALGO, used to buy COZMC and burn it, like posting a
   score; that isn't switched on here. The asset is held by the COZMC TestNet issuer for now; delivery to
   the player's wallet comes in a later step. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import type { AdventurerCompanion } from '../types'
import { AccountRequestError, mintStarprint, starprintMints, type StarprintFee, type StarprintMint } from './accountClient'

const TESTNET_ALGOD = 'https://testnet-api.algonode.cloud'
const TESTNET_FAUCET = 'https://bank.testnet.algorand.network/'
const paidKey = (id: string) => `cozmc-starprint-fee:${id}`
const remember = (id: string, txid: string | null) => {
  try { if (txid) localStorage.setItem(paidKey(id), txid); else localStorage.removeItem(paidKey(id)) } catch { /* private window */ }
}
const remembered = (id: string) => { try { return localStorage.getItem(paidKey(id)) } catch { return null } }

const REASONS: Record<string, string> = {
  daily_cap_reached: 'Today’s TestNet mints are used up. Try again tomorrow (UTC).',
  issuer_unfunded: 'The COZMC TestNet issuer is out of TestNet ALGO. It will be topped up soon.',
  not_hatched: 'Only a hatched Starprint can be minted.',
  companion_missing: 'This Starprint isn’t saved to the verified wallet.',
  disabled: 'TestNet minting is switched off right now.',
  fee_invalid: 'That payment doesn’t match this Starprint’s mint fee, so nothing was minted.',
}
const reason = (error: unknown) => {
  if (error instanceof AccountRequestError) {
    const code = (error.payload as { error?: string } | null)?.error
    if (code && REASONS[code]) return REASONS[code]
    if (error.status === 401) return 'Verify this wallet to mint.'
  }
  const text = error instanceof Error ? error.message : ''
  if (/overspend|below min/i.test(text)) return 'Your wallet needs a little TestNet ALGO for the fee. It’s free from the TestNet faucet.'
  if (/reject|cancel/i.test(text)) return 'The payment wasn’t signed, so nothing was minted.'
  return 'The mint couldn’t be finished just now. Try again: you won’t be charged twice.'
}
const pendingFee = (error: unknown) => error instanceof AccountRequestError && (error.payload as { error?: string } | null)?.error === 'fee_pending'
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function StarprintMintPanel({ companion, wallet }: { companion: AdventurerCompanion; wallet: string }) {
  const { activeAddress, signTransactions } = useWallet()
  const [mint, setMint] = useState<StarprintMint | null | undefined>(undefined)
  const [feeMicro, setFeeMicro] = useState(10_000)
  const [includeName, setIncludeName] = useState(false)
  const [step, setStep] = useState<'' | 'start' | 'sign' | 'send' | 'check'>('')
  const [note, setNote] = useState('')
  const live = useRef<AbortController | null>(null)
  const id = companion.companionId

  const refresh = useCallback(async () => {
    live.current?.abort()
    const task = new AbortController(); live.current = task
    try {
      const info = await starprintMints(wallet, task.signal)
      if (Number.isInteger(info.feeMicro)) setFeeMicro(info.feeMicro!)
      setMint(info.mints.find(m => m.companionId === id) ?? null)
    } catch (error) { if (!task.signal.aborted) { setMint(null); setNote(reason(error)) } }
  }, [wallet, id])

  useEffect(() => { void refresh(); return () => live.current?.abort() }, [refresh])
  // a mint on its way: ask again every few seconds until the chain confirms it
  useEffect(() => {
    if (mint?.status !== 'submitted' && mint?.status !== 'queued') return
    const timer = setTimeout(() => { void refresh() }, 4000)
    return () => clearTimeout(timer)
  }, [mint, refresh])

  /** Hand the server a confirmed fee payment; it may take the network a few seconds to show it. */
  async function claim(feeTxid: string) {
    setStep('check')
    for (let tries = 0; ; tries++) {
      try {
        const done = await mintStarprint(wallet, id, { feeTxid }, new AbortController().signal)
        remember(id, null); setMint(done); return
      } catch (error) {
        if (!pendingFee(error) || tries >= 10) throw error
        await sleep(3000)
      }
    }
  }

  async function payFee(fee: StarprintFee) {
    if (activeAddress !== wallet) throw new Error('Connect the verified wallet to pay the fee.')
    const algosdk = (await import('algosdk')).default
    const algod = new algosdk.Algodv2('', TESTNET_ALGOD, '')
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: wallet, receiver: fee.receiver, amount: fee.amountMicro,
      note: new TextEncoder().encode(fee.note), suggestedParams: await algod.getTransactionParams().do(),
    })
    setStep('sign')
    const [signed] = await signTransactions([txn])
    if (!signed) throw new Error('The payment wasn’t signed.')
    setStep('send')
    const { txid } = await algod.sendRawTransaction(signed).do()
    remember(id, txid)
    await algosdk.waitForConfirmation(algod, txid, 8)
    return txid
  }

  async function start() {
    setNote(''); setStep('start')
    try {
      let current = mint ?? await mintStarprint(wallet, id, { publicName: includeName ? companion.name : null }, new AbortController().signal)
      setMint(current)
      if (current.status === 'awaiting_fee' && current.fee) {
        const earlier = remembered(id)
        await claim(earlier ?? await payFee(current.fee))
      }
    } catch (error) {
      if (error instanceof AccountRequestError && (error.payload as { error?: string } | null)?.error === 'fee_invalid') remember(id, null)
      setNote(error instanceof Error && error.message === 'Connect the verified wallet to pay the fee.' ? error.message : reason(error))
    } finally { setStep('') }
  }

  const busy = step !== ''
  const fee = (feeMicro / 1e6).toLocaleString('en-US', { maximumFractionDigits: 6 })
  const label = { '': mint?.status === 'awaiting_fee' ? `Pay ${fee} TestNet ALGO and mint` : 'Mint on TestNet', start: 'Starting…',
    sign: 'Approve the fee in your wallet…', send: 'Sending the fee…', check: 'Minting…' }[step]

  return (
    <details className="panel sl-share sl-mint">
      <summary>Starprint NFT (TestNet)</summary>
      {mint === undefined && <p className="sl-fine" role="status">Checking…</p>}
      {mint?.status === 'confirmed' && (
        <p className="sl-fine" role="status">
          {companion.name} is Starprint #{mint.serial} on Algorand TestNet, asset{' '}
          {mint.explorer ? <a className="link" href={mint.explorer} target="_blank" rel="noreferrer">{mint.assetId}</a> : mint.assetId}.
          {' '}It’s held by the COZMC TestNet issuer for now; sending it to your wallet comes later.
        </p>
      )}
      {(mint?.status === 'submitted' || mint?.status === 'queued') && (
        <p className="sl-fine" role="status">Starprint #{mint.serial} is being minted on TestNet. This takes a few seconds…</p>
      )}
      {(mint === null || mint?.status === 'awaiting_fee') && (
        <>
          <p className="sl-fine">A rehearsal for the MainNet launch: mint {companion.name} as a one-of-one Algorand <strong>TestNet</strong> asset. TestNet assets have no value.</p>
          <p className="sl-fine">Mint fee: <strong>{fee} TestNet ALGO</strong> plus a 0.001 network fee, paid from your wallet. Set your wallet to TestNet first; TestNet ALGO is free from the <a className="link" href={TESTNET_FAUCET} target="_blank" rel="noreferrer">TestNet faucet</a>. At the MainNet launch the fee will be {fee} ALGO, used to buy COZMC and burn it.</p>
          <p className="sl-fine">Public on the asset: a serial number and its Star Chart’s Sun sign, element and archetype. Never its birthplace, birthday, story or anything else about you.</p>
          {mint === null && (
            <div className="sl-share__opts">
              <label><input type="checkbox" checked={includeName} onChange={event => setIncludeName(event.target.checked)} /> Include the name “{companion.name}”</label>
            </div>
          )}
          <p><button type="button" className="btn btn--phos" disabled={busy} onClick={() => void start()}>{label}</button></p>
        </>
      )}
      {note && <p className="sl-fine" role="alert">{note}</p>}
    </details>
  )
}
