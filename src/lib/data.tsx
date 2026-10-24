import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { fetchAsset, fetchBonfireTotal, fetchBurns, fetchFreeTickets, fetchHolders, fetchPactFarms, fetchPetNotes, fetchPrizePayments, fetchRound, fetchScores, type Burn, type FreeTicket, type Holder, type PactFarm, type PetNote, type PrizePayment, type ScoreTx } from './chain'

/* One shared cache of on-chain data for every tab. */

interface Slot<T> { data: T | null; error: string | null; loading: boolean }
const empty = <T,>(): Slot<T> => ({ data: null, error: null, loading: true })

interface ChainData {
  asset: Slot<Awaited<ReturnType<typeof fetchAsset>>>
  holders: Slot<Holder[]>
  burns: Slot<Burn[]>
  burned: Slot<number>
  scores: Slot<ScoreTx[]>
  farms: Slot<PactFarm[]>
  tickets: Slot<FreeTicket[]>
  prizes: Slot<PrizePayment[]>
  pets: Slot<PetNote[]>
  round: number | null
  reload: (what: 'holders' | 'burns' | 'scores' | 'giveaway' | 'all') => void
}

const Ctx = createContext<ChainData | null>(null)

function useSlot<T>(fn: () => Promise<T>) {
  const [slot, set] = useState<Slot<T>>(empty)
  /** quiet = background refresh: keep showing the old data, no spinner */
  const load = useCallback((quiet = false) => {
    if (!quiet) set(s => ({ ...s, loading: true }))
    fn().then(data => set({ data, error: null, loading: false }),
      e => set(s => ({ data: s.data, error: e?.message ?? 'Failed to load', loading: false })))
  }, [fn])
  return [slot, load] as const
}

export function ChainDataProvider({ children }: { children: ReactNode }) {
  const [asset, loadAsset] = useSlot(fetchAsset)
  const [holders, loadHolders] = useSlot(fetchHolders)
  const [rawBurns, loadBurns] = useSlot(fetchBurns)
  const [burned, loadBurned] = useSlot(fetchBonfireTotal)
  const [rawScores, loadScores] = useSlot(fetchScores)
  const [farms, loadFarms] = useSlot(fetchPactFarms)
  const [tickets, loadTickets] = useSlot(fetchFreeTickets)
  const [prizes, loadPrizes] = useSlot(fetchPrizePayments)
  const [pets, loadPets] = useSlot(fetchPetNotes)
  const [round, setRound] = useState<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => { loadAsset(); loadHolders(); loadBurns(); loadBurned(); loadScores(); loadFarms(); loadTickets(); loadPrizes(); loadPets() }, [loadAsset, loadHolders, loadBurns, loadBurned, loadScores, loadFarms, loadTickets, loadPrizes, loadPets])

  useEffect(() => {          // live block round, paused while the tab is hidden
    let alive = true
    const tick = async () => {
      if (!document.hidden) { try { const r = await fetchRound(); if (alive) setRound(r) } catch { /* retry next tick */ } }
      if (alive) timer.current = setTimeout(tick, 4000)
    }
    tick()
    return () => { alive = false; clearTimeout(timer.current) }
  }, [])

  useEffect(() => {          // keep boards and the activity ticker fresh while someone's looking
    const fast = setInterval(() => { if (!document.hidden) { loadBurns(true); loadBurned(true); loadScores(true); loadTickets(true); loadPrizes(true); loadPets(true) } }, 45_000)
    const slow = setInterval(() => { if (!document.hidden) { loadHolders(true); loadFarms(true) } }, 120_000)
    return () => { clearInterval(fast); clearInterval(slow) }
  }, [loadBurns, loadBurned, loadScores, loadHolders, loadFarms, loadTickets, loadPrizes, loadPets])

  const reload = useCallback((what: 'holders' | 'burns' | 'scores' | 'giveaway' | 'all') => {
    if (what === 'holders' || what === 'all') loadHolders()
    if (what === 'burns' || what === 'all') { loadBurns(); loadBurned(); loadHolders() }
    if (what === 'scores' || what === 'all') loadScores()
    if (what === 'giveaway' || what === 'all') { loadTickets(); loadPrizes(); loadPets() }
  }, [loadHolders, loadBurns, loadBurned, loadScores, loadTickets, loadPrizes, loadPets])

  // A paid score only counts once the burn in its transaction group is found; that burn
  // gets tagged with the run it paid for. Early free scores (legacy) count as they are.
  const [scores, burns] = useMemo((): [Slot<ScoreTx[]>, Slot<Burn[]>] => {
    if (!rawScores.data || !rawBurns.data) return [{ ...rawScores, data: rawBurns.data || rawBurns.loading ? null : rawScores.data?.filter(x => x.legacy) ?? null }, rawBurns]
    const burnt = new Map(rawBurns.data.filter(b => b.group).map(b => [b.group!, b.amount]))
    const sc = rawScores.data.filter(x => x.legacy || (x.group && burnt.has(x.group))).map(x => (x.group && burnt.has(x.group) ? { ...x, burned: burnt.get(x.group) } : x))
    const byGroup = new Map(sc.filter(x => x.group).map(x => [x.group!, x]))
    const bn = rawBurns.data.map(b => { const x = b.group ? byGroup.get(b.group) : undefined; return x ? { ...b, arcade: { game: x.game, score: x.score } } : b })
    return [{ ...rawScores, data: sc }, { ...rawBurns, data: bn }]
  }, [rawScores, rawBurns])

  const value = useMemo(() => ({ asset, holders, burns, burned, scores, farms, tickets, prizes, pets, round, reload }), [asset, holders, burns, burned, scores, farms, tickets, prizes, pets, round, reload])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useChain() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useChain outside ChainDataProvider')
  return c
}
