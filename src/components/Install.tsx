import { useSyncExternalStore } from 'react'
import { useToast } from './ui'

/* "Install app" for the PWA. Chrome/Edge/Android hand us an install prompt;
   iPhone Safari doesn't, so there we explain Add to Home Screen instead. */
type Prompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
let deferred: Prompt | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach(f => f())
if (typeof window !== 'undefined') {
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as Prompt; emit() })
  addEventListener('appinstalled', () => { deferred = null; emit() })
}
const standalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export function InstallButton() {
  const prompt = useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, () => deferred, () => null)
  const toast = useToast()
  if (standalone()) return null
  if (prompt) return (
    <button className="btn btn--sm btn--ghost foot__install" onClick={async () => { await prompt.prompt(); await prompt.userChoice.catch(() => null); deferred = null; emit() }}>
      Install the arcade
    </button>
  )
  if (ios()) return (
    <button className="btn btn--sm btn--ghost foot__install" onClick={() => toast('Tap the Share button in Safari, then “Add to Home Screen”.')}>
      Add to Home Screen
    </button>
  )
  return null
}
