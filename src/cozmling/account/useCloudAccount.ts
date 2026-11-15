import { useEffect, useRef, useState } from 'react'
import { cozmlingStore } from '../index'
import type { AdventurerCompanion } from '../types'
import { AccountRequestError } from './accountClient'
import { adoptWithWallet, resolveWithAccount, syncWalletAccount } from './localAccount'

type CloudState = 'loading' | 'synced' | 'saving' | 'offline' | 'conflict' | 'too-large'

export function useCloudAccount(wallet: string | null, signal: AbortSignal | null, ready: boolean, onUnauthorized: () => void) {
  const [state, setState] = useState<CloudState>('loading')
  // companions this device couldn't sync on its own: the player chooses (see resolveWithAccount)
  const [conflicts, setConflicts] = useState<string[]>([])
  const wake = useRef<() => void>(() => {})
  const invalid = useRef(onUnauthorized)
  invalid.current = onUnauthorized
  const loaded = useRef(false)
  const whileVerified = wallet !== null && signal !== null && !signal.aborted

  useEffect(() => {
    if (!wallet || !signal || signal.aborted || !ready) return
    const store = cozmlingStore()
    if (!store) return
    let working = false
    let ended = false
    let timer: number | undefined
    let queued = false
    loaded.current = false
    setState('loading')
    const stopped = () => ended || signal.aborted

    const schedule = () => {
      if (stopped()) return
      if (working) { queued = true; return }
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void run(), 300)
    }

    async function run() {
      if (!store || !wallet || !signal || stopped() || working) return
      working = true
      try {
        if (loaded.current) setState('saving')
        const next = await syncWalletAccount(store.repo, wallet, signal)
        if (stopped()) return
        if (next.changed) await store.reload()
        if (stopped()) return
        loaded.current = true
        setConflicts(next.conflicts)
        setState(next.hasConflict ? 'conflict' : next.retry ? 'saving' : 'synced')
        if (next.retry) queued = true
      } catch (error) {
        if (stopped()) return
        if (error instanceof AccountRequestError && error.status === 401) invalid.current()
        else if (error instanceof AccountRequestError && error.status === 413) setState('too-large')
        else setState('offline')
      } finally {
        working = false
        if (queued && !stopped()) { queued = false; schedule() }
      }
    }

    wake.current = schedule
    const stopStore = store.subscribe(schedule)
    const interval = window.setInterval(schedule, 20_000)
    window.addEventListener('online', schedule)
    window.addEventListener('focus', schedule)
    void run()
    return () => {
      ended = true
      wake.current = () => {}
      stopStore()
      window.clearTimeout(timer)
      window.clearInterval(interval)
      window.removeEventListener('online', schedule)
      window.removeEventListener('focus', schedule)
    }
  }, [ready, signal, wallet])

  async function adopt(record: AdventurerCompanion) {
    const store = cozmlingStore()
    if (!whileVerified || !store || !wallet || !signal) throw new Error('Verify your Algorand wallet to adopt.')
    try {
      const adopted = await adoptWithWallet(store.repo, wallet, record, signal)
      signal.throwIfAborted()
      await store.reload()
      signal.throwIfAborted()
      wake.current()
      return adopted
    } catch (error) {
      if (!signal.aborted && error instanceof AccountRequestError && error.status === 401) invalid.current()
      throw error
    }
  }

  async function resolve(companionId: string) {
    const store = cozmlingStore()
    if (!whileVerified || !store || !wallet || !signal) throw new Error('Verify your Algorand wallet first.')
    try {
      await resolveWithAccount(store.repo, wallet, companionId, signal)
      signal.throwIfAborted()
      await store.reload()
      signal.throwIfAborted()
      wake.current()
    } catch (error) {
      if (!signal.aborted && error instanceof AccountRequestError && error.status === 401) invalid.current()
      throw error
    }
  }

  return {
    state: whileVerified ? state : 'loading', loaded: whileVerified && loaded.current,
    conflicts: whileVerified ? conflicts : [], adopt, resolve, retry: () => wake.current(),
  }
}
