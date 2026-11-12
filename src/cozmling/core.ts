/* Opens the shared Cozmling store in the browser: IndexedDB if the browser allows it (otherwise
   this visit only), the v1 saves in localStorage brought in, other tabs kept in step. */
import { COZMLING_DEV } from './flags'
import { isV1Key } from './integrations/legacyAdapter'
import { createStore, type Channel, type CozStore } from './store/companionStore'
import { indexedDbRepository } from './store/indexedDbRepository'
import { memoryRepository } from './store/memoryRepository'
import { checksum, newId } from './store/util'

export async function open(): Promise<CozStore> {
  let storage: Storage | null = null
  try { storage = window.localStorage; void storage.length } catch { storage = null }       // storage switched off
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cozmc-cozmling-v2') : null
  const channel: Channel | undefined = bc ? { post: m => bc.postMessage(m), listen: cb => { bc.onmessage = e => cb(e.data) } } : undefined
  const env = { storage, now: () => Date.now(), newId, hash: checksum }

  let store = createStore((await indexedDbRepository()) ?? memoryRepository(), env, channel)
  try { await store.hydrate() }
  catch {
    // IndexedDB opened but can't be read (a damaged profile, say): keep going for this visit, and say it isn't saved
    store = createStore(memoryRepository(), env)
    await store.hydrate()
  }
  // a tab still running the old page changed a v1 save: take it in
  addEventListener('storage', e => { if (e.key && isV1Key(e.key)) void store.sync() })
  if (COZMLING_DEV) (window as unknown as { __cozmling: CozStore }).__cozmling = store
  return store
}
