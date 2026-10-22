import { useEffect, useState } from 'react'

/* Reverse-lookup NFD names (name.algo) for addresses, batched and cached. */
const cache = new Map<string, string | null>()
const listeners = new Set<() => void>()
let queue = new Set<string>()
let timer: ReturnType<typeof setTimeout> | null = null

async function flush() {
  timer = null
  const batch = [...queue].slice(0, 20)
  batch.forEach(a => queue.delete(a))
  if (queue.size) timer = setTimeout(flush, 50)
  try {
    const qs = batch.map(a => `address=${a}`).join('&')
    const r = await fetch(`https://api.nf.domains/nfd/lookup?${qs}&view=tiny`)
    const d = r.ok ? await r.json() : {}
    batch.forEach(a => cache.set(a, d?.[a]?.name ?? null))
  } catch {
    batch.forEach(a => cache.set(a, null))
  }
  listeners.forEach(l => l())
}

/** Synchronous read of an already-resolved name (used when composing share posts). */
export const nfdName = (a: string) => cache.get(a) ?? null

export function useNfd(address?: string | null): string | null {
  const [, force] = useState(0)
  useEffect(() => {
    const l = () => force(x => x + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])
  if (!address) return null
  if (!cache.has(address) && !queue.has(address)) {
    queue.add(address)
    if (!timer) timer = setTimeout(flush, 30)
  }
  return cache.get(address) ?? null
}
