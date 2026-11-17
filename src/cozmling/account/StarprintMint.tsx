/* The Starprint NFT panel: a verified owner mints a hatched Starprint as a one-of-one Algorand asset and
   receives it in their wallet. The player pays the mint fee from their wallet: 0.01 ALGO on both networks.
   - TestNet (the rehearsal): 0.01 TestNet ALGO, paid to the COZMC issuer. No value.
   - MainNet (when Mark switches it on): 0.01 ALGO that buys COZMC and burns it, like posting a score.
   Then the player opts in to the new asset and the issuer sends it to them. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import type algosdkType from 'algosdk'
import type { AdventurerCompanion } from '../types'
import { AccountRequestError, deliverStarprint, mintStarprint, starprintMints, type StarprintFee, type StarprintMint } from './accountClient'

const TESTNET_ALGOD = 'https://testnet-api.algonode.cloud'
const TESTNET_FAUCET = 'https://bank.testnet.algorand.network/'
type Net = 'testnet' | 'mainnet'
const paidKey = (id: string) => `cozmc-starprint-fee:${id}`
const remember = (id: string, txid: string | null) => {
  try { if (txid) localStorage.setItem(paidKey(id), txid); else localStorage.removeItem(paidKey(id)) } catch { /* private window */ }
}
const remembered = (id: string) => { try { return localStorage.getItem(paidKey(id)) } catch { return null } }

const REASONS: Record<string, string> = {
  daily_cap_reached: 'Today’s Starprint mints are used up. Try again tomorrow (UTC).',
  issuer_unfunded: 'The COZMC issuer needs topping up before it can mint or send. Nothing was charged twice; try again later.',
  not_hatched: 'Only a hatched Starprint can be minted.',
  companion_missing: 'This Starprint isn’t saved to the verified wallet.',
  disabled: 'Starprint minting is switched off right now.',
  fee_invalid: 'That payment doesn’t match this Starprint’s mint fee, so nothing was minted.',
  not_opted_in: 'Your wallet hasn’t accepted the Starprint yet. Press the button again to approve it.',
  paused: 'Starprint minting is paused for a moment. Anything already paid for is kept and finishes when it resumes.',
  issuer_low: 'Starprint minting is waiting for a top-up. Nothing was charged; try again later.',
  monthly_budget_reached: 'This month’s Starprint mints are used up. Nothing was charged; try again next month.',
}
const code = (error: unknown) => error instanceof AccountRequestError ? (error.payload as { error?: string } | null)?.error : undefined
const reason = (error: unknown, net: Net) => {
  const c = code(error)
  if (c && REASONS[c]) return REASONS[c]
  if (error instanceof AccountRequestError && error.status === 401) return 'Verify this wallet to continue.'
  const text = error instanceof Error ? error.message : ''
  if (text.startsWith('Connect the verified wallet')) return text
  if (/overspend|below min|needs about|Not enough ALGO/i.test(text)) return net === 'testnet'
    ? 'Your wallet needs a little TestNet ALGO. It’s free from the TestNet faucet.' : text
  if (/reject|cancel/i.test(text)) return 'Nothing was signed, so nothing happened.'
  return 'That couldn’t be finished just now. Try again: you won’t be charged twice.'
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function StarprintMintPanel({ companion, wallet }: { companion: AdventurerCompanion; wallet: string }) {
  const { activeAddress, signTransactions, algodClient } = useWallet()
  const [mint, setMint] = useState<StarprintMint | null | undefined>(undefined)
  const [net, setNet] = useState<Net>('testnet')
  const [feeMicro, setFeeMicro] = useState(10_000)
  const [paused, setPaused] = useState(false)
  const [includeName, setIncludeName] = useState(false)
  const [step, setStep] = useState<'' | 'start' | 'sign' | 'send' | 'check' | 'optin' | 'deliver'>('')
  const [note, setNote] = useState('')
  const live = useRef<AbortController | null>(null)
  const id = companion.companionId
  const T = net === 'testnet' ? 'TestNet ' : ''

  const refresh = useCallback(async () => {
    live.current?.abort()
    const task = new AbortController(); live.current = task
    try {
      const info = await starprintMints(wallet, task.signal)
      setNet(info.network === 'mainnet' ? 'mainnet' : 'testnet')
      if (Number.isInteger(info.feeMicro)) setFeeMicro(info.feeMicro!)
      setPaused(info.paused === true)
      setMint(info.mints.find(m => m.companionId === id) ?? null)
    } catch (error) { if (!task.signal.aborted) { setMint(null); setNote(reason(error, net)) } }
  }, [wallet, id, net])

  useEffect(() => { void refresh(); return () => live.current?.abort() }, [refresh])
  // something on its way (a mint or a delivery): ask again every few seconds until the chain confirms it
  useEffect(() => {
    if (mint?.status !== 'submitted' && mint?.status !== 'queued' && mint?.delivery?.status !== 'sending') return
    const timer = setTimeout(() => { void refresh() }, 4000)
    return () => clearTimeout(timer)
  }, [mint, refresh])

  async function chain() {
    const algosdk = (await import('algosdk')).default
    return { algosdk, algod: net === 'mainnet' ? algodClient : new algosdk.Algodv2('', TESTNET_ALGOD, '') }
  }
  function mustBeVerifiedWallet() { if (activeAddress !== wallet) throw new Error('Connect the verified wallet to continue.') }

  /** Sign and send transactions on this panel's network; resolves with the first one's id once confirmed. */
  async function signAndSend(algosdk: typeof algosdkType, algod: algosdkType.Algodv2, txns: algosdkType.Transaction[], onSent?: (txid: string) => void) {
    setStep('sign')
    const signed = (await signTransactions(txns)).filter((x): x is Uint8Array => !!x)
    if (signed.length !== txns.length) throw new Error('The wallet didn’t sign everything (rejected).')
    setStep('send')
    await algod.sendRawTransaction(signed).do()
    const first = txns[0].txID()
    onSent?.(first)
    await algosdk.waitForConfirmation(algod, txns[txns.length - 1].txID(), 8)
    return first
  }

  async function payFee(fee: StarprintFee) {
    mustBeVerifiedWallet()
    const { algosdk, algod } = await chain()
    if (fee.network === 'mainnet') {
      // the same buy-and-burn group as posting a score, with this mint's note on the 0.01 ALGO payment
      const { buildStarprintFeeGroup } = await import('../../lib/chain')
      const g = await buildStarprintFeeGroup(algod, wallet, fee.note)
      await signAndSend(algosdk, algod, g.txns, () => remember(id, g.payTxId))
      return g.payTxId
    }
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: wallet, receiver: fee.receiver, amount: fee.amountMicro,
      note: new TextEncoder().encode(fee.note), suggestedParams: await algod.getTransactionParams().do(),
    })
    return signAndSend(algosdk, algod, [txn], txid => remember(id, txid))
  }

  /** Hand the server a confirmed fee payment; it may take the network a few seconds to show it. */
  async function claim(feeTxid: string) {
    setStep('check')
    for (let tries = 0; ; tries++) {
      try {
        const done = await mintStarprint(wallet, id, { feeTxid }, new AbortController().signal)
        remember(id, null); setMint(done); return done
      } catch (error) {
        if (code(error) !== 'fee_pending' || tries >= 10) throw error
        await sleep(3000)
      }
    }
  }

  async function receive(assetId: number) {
    mustBeVerifiedWallet()
    const { algosdk, algod } = await chain()
    let optedIn = false
    try { await algod.accountAssetInformation(wallet, assetId).do(); optedIn = true } catch { /* not yet */ }
    if (!optedIn) {
      setStep('optin')
      const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({ sender: wallet, receiver: wallet, assetIndex: assetId, amount: 0, suggestedParams: await algod.getTransactionParams().do() })
      await signAndSend(algosdk, algod, [txn])
    }
    setStep('deliver')
    setMint(await deliverStarprint(wallet, id, new AbortController().signal))
  }

  async function run(task: () => Promise<unknown>) {
    setNote('')
    try { await task() }
    catch (error) {
      if (code(error) === 'fee_invalid') remember(id, null)
      setNote(reason(error, net))
    } finally { setStep('') }
  }

  const startMint = () => run(async () => {
    setStep('start')
    let current = mint ?? await mintStarprint(wallet, id, { publicName: includeName ? companion.name : null }, new AbortController().signal)
    setMint(current)
    if (current.status === 'awaiting_fee' && current.fee) current = await claim(remembered(id) ?? await payFee(current.fee))
    if (current.status === 'confirmed' && current.assetId) await receive(current.assetId)
  })

  const busy = step !== '' || paused
  const fee = (feeMicro / 1e6).toLocaleString('en-US', { maximumFractionDigits: 6 })
  const labels = { start: 'Starting…', sign: 'Approve in your wallet…', send: 'Sending…', check: 'Minting…', optin: 'Approve receiving it in your wallet…', deliver: 'Sending it to your wallet…' }
  const delivered = mint?.delivery?.status === 'delivered'
  const assetLink = mint?.assetId ? (mint.explorer ? <a className="link" href={mint.explorer} target="_blank" rel="noreferrer">{mint.assetId}</a> : mint.assetId) : null

  return (
    <details className="panel sl-share sl-mint">
      <summary>Starprint NFT{net === 'testnet' ? ' (TestNet)' : ''}</summary>
      {mint === undefined && <p className="sl-fine" role="status">Checking…</p>}

      {mint?.status === 'confirmed' && (
        <>
          <p className="sl-fine" role="status">
            {companion.name} is Starprint #{mint.serial} on Algorand {net === 'testnet' ? 'TestNet' : 'MainNet'}, asset {assetLink}.{' '}
            {delivered ? 'It’s in your wallet.' : mint.delivery?.status === 'sending' ? 'It’s on its way to your wallet…' : 'It’s ready to send to your wallet.'}
          </p>
          {!delivered && mint.delivery?.status !== 'sending' && (
            <>
              <p className="sl-fine">Your wallet will ask you to accept the asset first. That holds back 0.1 {T}ALGO of your balance while you keep it, plus a 0.001 network fee.</p>
              <p><button type="button" className="btn btn--phos" disabled={busy} onClick={() => void run(() => receive(mint.assetId!))}>{step ? labels[step as keyof typeof labels] : 'Receive in my wallet'}</button></p>
            </>
          )}
        </>
      )}
      {(mint?.status === 'submitted' || mint?.status === 'queued') && (
        <p className="sl-fine" role="status">Starprint #{mint.serial} is being minted. This takes a few seconds…</p>
      )}

      {(mint === null || mint?.status === 'awaiting_fee') && (
        <>
          {net === 'testnet'
            ? <p className="sl-fine">A rehearsal for the MainNet launch: mint {companion.name} as a one-of-one Algorand <strong>TestNet</strong> asset. TestNet assets have no value.</p>
            : <p className="sl-fine">Mint {companion.name} as a one-of-one Algorand asset that you hold in your wallet.</p>}
          {net === 'testnet'
            ? <p className="sl-fine">Mint fee: <strong>{fee} TestNet ALGO</strong> plus a 0.001 network fee, the same {fee} as on MainNet. Set your wallet to TestNet first; TestNet ALGO is free from the <a className="link" href={TESTNET_FAUCET} target="_blank" rel="noreferrer">TestNet faucet</a>.</p>
            : <p className="sl-fine">Mint fee: <strong>{fee} ALGO</strong>, which buys COZMC and burns it, plus about 0.006 ALGO in network fees.</p>}
          <p className="sl-fine">Public on the asset: a serial number and its Star Chart’s Sun sign, element and archetype. Never its birthplace, birthday, story or anything else about you.</p>
          {mint === null && (
            <div className="sl-share__opts">
              <label><input type="checkbox" checked={includeName} onChange={event => setIncludeName(event.target.checked)} /> Include the name “{companion.name}”</label>
            </div>
          )}
          <p><button type="button" className="btn btn--phos" disabled={busy} onClick={() => void startMint()}>
            {step ? labels[step as keyof typeof labels] : mint?.status === 'awaiting_fee' ? `Pay ${fee} ${T}ALGO and mint` : `Mint for ${fee} ${T}ALGO`}
          </button></p>
        </>
      )}
      {paused && <p className="sl-fine" role="status">{REASONS.paused}</p>}
      {note && <p className="sl-fine" role="alert">{note}</p>}
    </details>
  )
}
