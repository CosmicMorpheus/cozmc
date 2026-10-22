import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { Modal, HoldButton, Addr } from './ui'
import { Flame } from './Pixel'
import { useMe } from './Wallet'
import { useChain } from '../lib/data'
import { bonfireState, buildBurnGroup, signAndSend } from '../lib/chain'
import { compact, fmt, parseAmount, short, toWhole } from '../lib/format'
import { sfx } from '../arcade/sfx'
import { ShareBtn } from './Share'
import { burnShare } from '../lib/sharePayloads'
import { GAMES } from '../arcade/games'
import { BONFIRE_ADDRESS, BONFIRE_APP_ID, BURN_GOAL, EXPLORER_ACCOUNT, EXPLORER_TX, HAYSTACK_INVITE } from '../config'
import { unlock } from '../lib/profile'

const WISH_MAX = 280

/* ---------- the community burn goal: a segmented meter ---------- */
export function GoalMeter({ burned, add = 0, full = false }: { burned: number; add?: number; full?: boolean }) {
  const g = BURN_GOAL.amount, SEG = full ? 30 : 14
  // each segment fills by its exact share (any burn at all shows a sliver), the pending burn previews in brighter fire
  const now = Math.min(1, burned / g) * SEG, next = Math.min(1, (burned + add) / g) * SEG
  const lit = (x: number, i: number) => Math.max(0, Math.min(1, x - i))
  const fill = (i: number) => (i === 0 && burned > 0 ? Math.max(0.12, lit(now, 0)) : lit(now, i))
  const done = burned >= g, pctNow = Math.min(100, (burned / g) * 100)
  const segs = (
    <span className="goal__segs" aria-hidden="true">
      {Array.from({ length: SEG }, (_, i) => <i key={i} className={fill(i) >= 1 ? 'on' : ''} style={{ ['--f' as string]: fill(i), ['--a' as string]: Math.max(fill(i), lit(next, i)) }} />)}
    </span>
  )
  if (!full) return (
    <div className="goal" title={done ? `Goal reached: ${compact(g)} burned` : `Community goal: ${compact(g)} burned ${BURN_GOAL.reward}`}
      role="meter" aria-valuemin={0} aria-valuemax={g} aria-valuenow={Math.min(burned, g)} aria-label="Community burn goal">
      {segs}<span className="goal__txt"><b>{compact(burned)}</b><span className="hide-sm"> / {compact(g)}</span><span className="show-sm"> burned</span></span>
    </div>
  )
  const after = Math.min(100, ((burned + add) / g) * 100)
  return (
    <div className={`goal goal--full${done ? ' is-done' : ''}`} role="meter" aria-valuemin={0} aria-valuemax={g} aria-valuenow={Math.min(burned, g)} aria-label="Community burn goal">
      <p className="goal__head"><span>{done ? 'Goal reached' : 'Community goal'}</span><span>{pctNow.toFixed(pctNow < 10 ? 1 : 0)}%</span></p>
      {segs}
      <p className="goal__txt">{done
        ? <>{compact(g)} burned together. The community {BURN_GOAL.reward.replace(/^unlocks/, 'unlocked')}.</>
        : <>{compact(burned)} of {compact(g)} burned. At {compact(g)}, the community {BURN_GOAL.reward}.{add > 0 && <b> Your burn adds {(after - pctNow).toFixed(after - pctNow < 1 ? 2 : 1)}%.</b>}</>}</p>
    </div>
  )
}

/* ---------- the strip across the top of every page ---------- */
export function BurnBar({ onBurn }: { onBurn: () => void }) {
  const { burned, burns } = useChain()
  const count = burns.data?.length ?? 0
  return (
    <div className="burnbar">
      <div className="wrap burnbar__in">
        <Flame size={16} className="burnbar__flame" />
        <p className="burnbar__msg"><b>Support COZMC: burn some.</b> <span className="hide-sm">Every burn shrinks the supply forever and carries a wish on-chain.</span></p>
        {burned.data != null
          ? <GoalMeter burned={burned.data} />
          : <p className="burnbar__total"><span className="burnbar__num">…</span> burned</p>}
        {count > 0 && <p className="burnbar__total hide-sm">{count} {count === 1 ? 'wish' : 'wishes'}</p>}
        <button className="btn btn--sm btn--fire" onClick={onBurn}>Burn</button>
      </div>
    </div>
  )
}

type Step = 'form' | 'sign' | 'send' | 'done' | 'error'

/* ---------- the burn dialog ---------- */
export function BurnModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeAddress, algodClient, signTransactions } = useWallet()
  const { balance, refresh, openConnect } = useMe()
  const { reload, burned } = useChain()
  const [amount, setAmount] = useState('')
  const [wish, setWish] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [err, setErr] = useState('')
  const [txid, setTxid] = useState('')
  const [optInNote, setOptInNote] = useState(false)

  useEffect(() => {
    if (!open) return
    setStep('form'); setErr(''); setTxid('')
    bonfireState().then(b => setOptInNote(!b.optedIn), () => {})   // first-ever COZMC burn also opens the Bonfire to COZMC
  }, [open])

  useEffect(() => {          // dev-only: preview the reward screen with ?legend
    if (import.meta.env.DEV && open && location.search.includes('legend')) { setAmount('250000'); setWish('For the first game night. May the arcade never go dark.'); setTxid('DEVPREVIEW'); setStep('done') }
  }, [open])

  const base = useMemo(() => parseAmount(amount), [amount])
  const whole = base != null ? toWhole(base) : 0
  const problem =
    !activeAddress ? null :
    balance == null ? 'This wallet doesn’t hold COZMC yet.' :
    amount && base == null ? 'Enter a number, up to 6 decimal places.' :
    base != null && base <= 0n ? 'Enter more than zero.' :
    whole > balance ? `You only hold ${fmt(balance, 2)} COZMC.` : null
  const ready = !!activeAddress && base != null && base > 0n && !problem
  const wishBytes = new TextEncoder().encode(wish).length

  async function burn() {
    if (!ready || !base) return
    setErr(''); setStep('sign')
    try {
      const g = await buildBurnGroup(algodClient, activeAddress!, base, wish)
      setOptInNote(g.needsOptIn)
      const id = await signAndSend(algodClient, async t => { const r = await signTransactions(t); setStep('send'); return r }, g.txns)
      setTxid(g.txns.length > 1 ? g.burnTxId : id)
      setStep('done'); unlock('burner')
      ;[392, 523, 659, 784, 1046].forEach((f, i) => setTimeout(() => sfx.tone(f, 0.14, 'square', 0.05), i * 90))
      refresh(); setTimeout(() => reload('burns'), 2500)
    } catch (e: any) {
      const m = String(e?.message ?? e)
      setErr(/reject|cancel|closed|denied/i.test(m) ? 'You cancelled the signature. Nothing was burned.' :
        /overspend|below min/i.test(m) ? 'Not enough ALGO to cover the network fee.' :
        `The burn didn’t go through: ${m.slice(0, 160)}`)
      setStep('error')
    }
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="burn-title" className={`modal__box--burn${step === 'done' ? ' is-legend' : ''}`}>
      {step === 'done' ? (
        <Legendary amount={whole} wish={wish} txid={txid} onClose={() => { setAmount(''); setWish(''); onClose() }} />
      ) : (
        <>
          <div className="burn__head"><Flame size={28} /><h2 id="burn-title" className="modal__title">The Bonfire</h2></div>
          <p className="modal__lede">Burned COZMC can never come back. It leaves circulation for good, and your wish is written into the transaction on Algorand.</p>
          {burned.data != null && <GoalMeter burned={burned.data} add={ready ? whole : 0} full />}

          <label className="field">
            <span className="field__label">Amount
              {activeAddress && balance != null && <button type="button" className="link" onClick={() => setAmount(String(balance))}>Max {fmt(balance, 2)}</button>}
            </span>
            <span className="field__input"><input data-autofocus inputMode="decimal" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} disabled={step !== 'form' && step !== 'error'} /><em>COZMC</em></span>
          </label>
          <div className="chips">{[1_000, 10_000, 100_000, 1_000_000].map(v => <button key={v} type="button" className="chip" onClick={() => setAmount(String(v))}>{compact(v)}</button>)}</div>

          <label className="field">
            <span className="field__label">Your burn wish <span className="muted">{wish.length}/{WISH_MAX}</span></span>
            <textarea rows={3} maxLength={WISH_MAX} placeholder="What are you burning it for?" value={wish} onChange={e => setWish(e.target.value)} disabled={step !== 'form' && step !== 'error'} />
          </label>

          <dl className="receipt">
            <div><dt>Sends to</dt><dd><a href={EXPLORER_ACCOUNT(BONFIRE_ADDRESS)} target="_blank" rel="noopener">Bonfire (ARC-54 app {BONFIRE_APP_ID}) · {short(BONFIRE_ADDRESS, 6)} ↗</a></dd></div>
            <div><dt>Network fee</dt><dd>{optInNote ? '0.003 ALGO (first COZMC burn also opens the Bonfire)' : '0.001 ALGO'}</dd></div>
            {wishBytes > 0 && <div><dt>On-chain note</dt><dd>{wishBytes + 14} bytes</dd></div>}
          </dl>

          {problem && <p className="state state--err">{problem}{balance == null && activeAddress && <> <a href={HAYSTACK_INVITE} target="_blank" rel="noopener">Get COZMC on Haystack ↗</a></>}</p>}
          {step === 'error' && <p className="state state--err">{err}</p>}

          {!activeAddress ? (
            <button className="btn btn--phos btn--block" onClick={openConnect}>Connect a wallet to burn</button>
          ) : step === 'sign' ? (
            <p className="state state--load"><span className="blink">▮</span> Approve the burn in your wallet…</p>
          ) : step === 'send' ? (
            <p className="state state--load"><span className="blink">▮</span> Feeding the fire… waiting for the block.</p>
          ) : (
            <HoldButton disabled={!ready} onDone={burn}>{ready ? `Hold to burn ${compact(whole)} COZMC` : 'Hold to burn'}</HoldButton>
          )}
        </>
      )}
    </Modal>
  )
}

/* ---------- the reward ---------- */
function Legendary({ amount, wish, txid, onClose }: { amount: number; wish: string; txid: string; onClose: () => void }) {
  return (
    <div className="legend">
      <div className="legend__embers" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</div>
      <Flame size={64} className="legend__flame" />
      <p className="legend__kicker">Thank you</p>
      <h2 id="burn-title" className="legend__title">You’re legendary</h2>
      <p className="legend__amt"><b>{fmt(amount, 2)}</b> COZMC went into the fire. Gone for good.</p>
      {wish && <blockquote className="legend__wish">“{wish}”</blockquote>}
      <div className="legend__actions">
        <a className="btn btn--ghost" href={EXPLORER_TX(txid)} target="_blank" rel="noopener">View transaction ↗</a>
        <ShareBtn label="Share on X" className="btn btn--ghost" make={() => burnShare({ amount, wish, mine: true })} />
        <button data-autofocus className="btn btn--fire" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

/* ---------- wishes feed (used on Home) ---------- */
export function WishFeed({ limit = 6, onBurn }: { limit?: number; onBurn: () => void }) {
  const { burns } = useChain()
  const { activeAddress } = useWallet()
  const list = (burns.data ?? []).slice(0, limit)
  if (burns.loading && !burns.data) return <p className="state state--load"><span className="blink">▮</span> Reading the Bonfire…</p>
  if (!list.length) return (
    <div className="empty">
      <p>The Bonfire is waiting. Burn some COZMC and leave the first wish on-chain.</p>
      <button className="btn btn--fire btn--sm" onClick={onBurn}>Light it</button>
    </div>
  )
  return (
    <ul className="wishes">
      {list.map(b => (
        <li key={b.txid}>
          <p className="wishes__who"><Addr address={b.sender} you={b.sender === activeAddress} /> burned <b>{compact(b.amount)}</b></p>
          {b.wish ? <p className="wishes__wish">“{b.wish}”</p>
            : b.arcade ? <p className="wishes__wish muted">Posted {fmt(b.arcade.score)} in {GAMES.find(x => x.id === b.arcade!.game)?.title ?? 'the arcade'}</p>
            : <p className="wishes__wish muted">No wish, just fire.</p>}
          <a className="wishes__time" href={EXPLORER_TX(b.txid)} target="_blank" rel="noopener">{new Date(b.time * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ↗</a>
        </li>
      ))}
    </ul>
  )
}
