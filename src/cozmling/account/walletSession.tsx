import { useEffect, useRef, useState } from 'react'
import { ScopeType, useWallet } from '@txnlab/use-wallet-react'
import { useMe } from '../../components/Wallet'
import { verifyWalletChallenge, walletChallenge, walletLogout, walletSession } from './accountClient'

type SignData = ReturnType<typeof useWallet>['signData']

const logoutKey = (address: string) => `cozmc:cozmling-signout:${address}`

function pendingLogout(address: string | null) {
  try { return !!address && localStorage.getItem(logoutKey(address)) === 'pending' }
  catch { return false }
}

function rememberLogout(address: string, pending: boolean) {
  try {
    if (pending) localStorage.setItem(logoutKey(address), 'pending')
    else localStorage.removeItem(logoutKey(address))
  } catch { /* retry remains available during this visit */ }
}

function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

export function useWalletVerification(address: string | null, signData?: SignData) {
  const [verified, setVerified] = useState(false)
  const [busy, setBusy] = useState(!!address)
  const [problem, setProblem] = useState('')
  const [revocationPending, setRevocationPending] = useState(() => pendingLogout(address))
  const pending = useRef<AbortController | null>(null)
  const authority = useRef<AbortController | null>(null)
  const [sessionSignal, setSessionSignal] = useState<AbortSignal | null>(null)

  const setSession = (isVerified: boolean) => {
    authority.current?.abort()
    authority.current = isVerified ? new AbortController() : null
    setSessionSignal(authority.current?.signal ?? null)
    setVerified(isVerified)
  }

  useEffect(() => {
    if (!address) return
    if (pendingLogout(address)) {
      setBusy(false)
      return
    }
    const task = new AbortController()
    pending.current = task
    walletSession(address, task.signal).then(
      match => { if (!task.signal.aborted) setSession(match) },
      () => { if (!task.signal.aborted) setProblem('The wallet session could not be checked. Try verifying again.') },
    ).finally(() => {
      if (pending.current === task) { pending.current = null; setBusy(false) }
    })
    return () => {
      pending.current?.abort()
      pending.current = null
      authority.current?.abort()
    }
  }, [address])

  async function verify() {
    if (!address || !signData || pending.current || revocationPending) return
    const task = new AbortController()
    pending.current = task
    setBusy(true)
    setProblem('')
    try {
      const challenge = await walletChallenge(address, task.signal)
      task.signal.throwIfAborted()
      const response = await signData(challenge.data, { scope: ScopeType.AUTH, encoding: 'base64' })
      task.signal.throwIfAborted()
      const ok = await verifyWalletChallenge(address, challenge, {
        signature: base64(response.signature), authenticatorData: base64(response.authenticatorData),
      }, task.signal)
      task.signal.throwIfAborted()
      if (!ok) throw new Error('Wallet changed')
      setSession(true)
    } catch {
      if (!task.signal.aborted) {
        setSession(false)
        setProblem('The message was not verified. Check the account in your wallet and try again.')
      }
    } finally {
      if (pending.current === task) { pending.current = null; setBusy(false) }
    }
  }

  async function signOut() {
    if (!address || pending.current) return
    const task = new AbortController()
    pending.current = task
    setSession(false)
    setRevocationPending(true)
    rememberLogout(address, true)
    setBusy(true)
    setProblem('')
    try {
      await walletLogout(address, task.signal)
      task.signal.throwIfAborted()
      rememberLogout(address, false)
      setRevocationPending(false)
    } catch {
      if (!task.signal.aborted) setProblem('The account is closed here. Try signing out again to end the server session.')
    } finally {
      if (pending.current === task) { pending.current = null; setBusy(false) }
    }
  }

  return { verified, busy, problem, sessionSignal, revocationPending, verify, signOut, invalidate: () => setSession(false) }
}

export function WalletAccess({
  address, canSign, state,
}: { address: string | null; canSign: boolean; state: ReturnType<typeof useWalletVerification> }) {
  const { openConnect } = useMe()
  return (
    <section className="panel" aria-label="Cozmling wallet account">
      <header className="panel__head"><h2>Cozmling wallet account</h2></header>
      {state.revocationPending ? (
        <p><button className="btn btn--ghost btn--sm" disabled={state.busy} onClick={() => void state.signOut()}>{state.busy ? 'Signing out…' : 'Retry sign-out'}</button> to finish closing the account session.</p>
      ) : state.verified ? (
        <p>Wallet verified. <button className="btn btn--ghost btn--sm" disabled={state.busy} onClick={() => void state.signOut()}>Sign out of Cozmlings</button></p>
      ) : !address ? (
        <p><button className="btn btn--phos" onClick={openConnect}>Connect Algorand wallet</button> to adopt and open your account.</p>
      ) : !canSign ? (
        <p>Use Pera or Lute to sign in to Cozmlings. <button className="btn btn--ghost btn--sm" onClick={openConnect}>Choose another wallet</button></p>
      ) : (
        <p><button className="btn btn--phos" disabled={state.busy} onClick={() => void state.verify()}>{state.busy ? 'Checking wallet…' : 'Verify wallet'}</button> to adopt. Verification signs a message and costs nothing.</p>
      )}
      {state.problem && <p role="alert">{state.problem}</p>}
    </section>
  )
}
