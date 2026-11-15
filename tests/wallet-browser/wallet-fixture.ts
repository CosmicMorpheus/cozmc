import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const details = { connections: 0, signatures: [] as { address: string | null; data: string; encoding: string }[] }
type Wallet = { id: string; walletKey: string; canSignData: boolean; metadata: { name: string } }
let snapshot = { activeAddress: null as string | null, activeWallet: null as Wallet | null }
let rejected = false
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

async function signData(data: string, { encoding }: { encoding: string }) {
  details.signatures.push({ address: snapshot.activeAddress, data, encoding })
  if (rejected) throw new Error('Wallet signature declined')
  return { data, signature: new Uint8Array(64).fill(7), authenticatorData: new Uint8Array(32).fill(2) }
}

Object.assign(window, {
  __walletReview: {
    details,
    select(address: string | null, canSignData = true) {
      const id = canSignData ? 'pera' : 'defly'
      snapshot = {
        activeAddress: address,
        activeWallet: address ? { id, walletKey: id, canSignData, metadata: { name: canSignData ? 'Pera' : 'Defly' } } : null,
      }
      listeners.forEach(listener => listener())
    },
    reject(value: boolean) { rejected = value },
  },
})

export const ScopeType = { AUTH: 1 }
export const useWallet = () => ({ ...useSyncExternalStore(subscribe, () => snapshot), isReady: true, signData })
export const useMe = () => ({ openConnect: () => { details.connections++ } })
