import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNfd } from '../lib/nfd'
import { short } from '../lib/format'
import { EXPLORER_ACCOUNT } from '../config'

/* ---------------- toasts ---------------- */
const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const t = useRef<ReturnType<typeof setTimeout>>(undefined)
  const show = useCallback((m: string) => { setMsg(m); clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2600) }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={`toast${msg ? ' show' : ''}`} role="status" aria-live="polite">{msg}</div>
    </ToastCtx.Provider>
  )
}

/* ---------------- modal dialog ---------------- */
export function Modal({ open, onClose, labelledBy, children, className = '' }: {
  open: boolean; onClose: () => void; labelledBy: string; children: ReactNode; className?: string
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    document.documentElement.style.overflow = 'hidden'
    const first = box.current?.querySelector<HTMLElement>('[data-autofocus]') ?? box.current?.querySelector<HTMLElement>('.modal__box > :not(.modal__x) button, input, textarea, a[href]')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
      if (e.key === 'Tab' && box.current) {
        const f = [...box.current.querySelectorAll<HTMLElement>('button:not([disabled]), input, textarea, a[href]')].filter(x => x.getClientRects().length)
        if (!f.length) return
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
      }
    }
    addEventListener('keydown', onKey, true)
    return () => { removeEventListener('keydown', onKey, true); document.documentElement.style.overflow = ''; prev?.focus?.() }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <div className="modal__veil" onClick={onClose} />
      <div className={`modal__box ${className}`} ref={box}>
        <button className="modal__x" onClick={onClose} aria-label="Close">✕</button>
        {children}
      </div>
    </div>, document.body)
}

/* ---------------- address with NFD name ---------------- */
export function Addr({ address, you, link = true }: { address: string; you?: boolean; link?: boolean }) {
  const nfd = useNfd(address)
  const label = nfd ?? short(address, 5)
  const inner = <><span className={nfd ? 'addr-nfd' : 'addr-raw'}>{label}</span>{you && <span className="you">YOU</span>}</>
  return link
    ? <a className="addr-link" href={EXPLORER_ACCOUNT(address)} target="_blank" rel="noopener" title={address}>{inner}</a>
    : <span className="addr-link" title={address}>{inner}</span>
}

/* ---------------- copy button ---------------- */
export function CopyBtn({ text, label = 'Copy', what }: { text: string; label?: string; what: string }) {
  const toast = useToast()
  const [done, setDone] = useState(false)
  return (
    <button className={`btn btn--sm btn--ghost${done ? ' is-done' : ''}`} onClick={async () => {
      try { await navigator.clipboard.writeText(text); toast(`${what} copied`); setDone(true); setTimeout(() => setDone(false), 1500) }
      catch { toast('Copy failed. Select the text and copy it manually.') }
    }}>{done ? 'Copied' : label}</button>
  )
}

/* ---------------- hold-to-confirm button ---------------- */
export function HoldButton({ onDone, children, disabled, ms = 1000 }: { onDone: () => void; children: ReactNode; disabled?: boolean; ms?: number }) {
  const [p, setP] = useState(0)
  const raf = useRef(0), start = useRef(0), fired = useRef(false)
  const stop = () => { cancelAnimationFrame(raf.current); setP(0); start.current = 0 }
  const go = () => {
    if (disabled || start.current) return
    fired.current = false; start.current = performance.now()
    const tick = (now: number) => {
      const v = Math.min(1, (now - start.current) / ms)
      setP(v)
      if (v >= 1) { if (!fired.current) { fired.current = true; start.current = 0; setP(0); onDone() } return }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  return (
    <button className="btn btn--fire btn--hold" disabled={disabled} style={{ ['--hold' as string]: p }}
      onPointerDown={go} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); go() } }}
      onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') stop() }}
      onClick={e => e.preventDefault()}>
      <span className="btn--hold__fill" aria-hidden="true" />
      <span className="btn--hold__label">{children}</span>
    </button>
  )
}

/* ---------------- loading / error / empty states ---------------- */
export function Loading({ what }: { what: string }) {
  return <p className="state state--load"><span className="blink">▮</span> Loading {what} from Algorand…</p>
}
export function Failed({ what, retry }: { what: string; retry: () => void }) {
  return <p className="state state--err">Couldn't reach the Algorand indexer for {what}. <button className="link" onClick={retry}>Try again</button></p>
}
