import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { Modal, useToast } from './ui'
import { renderCard, xIntent, type SharePayload } from '../lib/share'

/* One share dialog for the whole app: preview the graphic, then post. */
const Ctx = createContext<(p: SharePayload) => void>(() => {})
export const useShare = () => useContext(Ctx)

export function ShareProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<SharePayload | null>(null)
  return (
    <Ctx.Provider value={setPayload}>
      {children}
      <ShareModal payload={payload} onClose={() => setPayload(null)} />
    </Ctx.Provider>
  )
}

export function XGlyph({ size = 13 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2Zm-1.2 18h1.9L7.4 3.9H5.4L17.7 20Z" /></svg>
}

/** A compact "Share" button that opens the dialog with a payload. */
export function ShareBtn({ make, label = 'Share', className = 'btn btn--ghost btn--sm' }: { make: () => SharePayload; label?: string; className?: string }) {
  const share = useShare()
  return <button className={className} onClick={() => share(make())} aria-label={label === '' ? 'Share on X' : undefined}><XGlyph />{label && <span>{label}</span>}</button>
}

function ShareModal({ payload, onClose }: { payload: SharePayload | null; onClose: () => void }) {
  const toast = useToast()
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const canNative = typeof navigator !== 'undefined' && !!navigator.canShare && !!blob &&
    navigator.canShare({ files: [new File([blob], 'cozmc.png', { type: 'image/png' })] })

  useEffect(() => {
    if (!payload) { setBlob(null); setUrl(''); return }
    let alive = true
    setBlob(null); setUrl(''); setErr(''); setText(payload.text)   // never show the previous card while drawing
    renderCard(payload.card).then(b => { if (alive) { setBlob(b); setUrl(URL.createObjectURL(b)) } }, () => alive && setErr('Couldn’t draw the graphic. You can still post the text.'))
    return () => { alive = false }
  }, [payload])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  const download = useCallback(() => {
    if (!url || !payload) return
    const a = document.createElement('a'); a.href = url; a.download = payload.file; a.click()
  }, [url, payload])

  async function postToX() {
    let copied = false
    if (blob && 'ClipboardItem' in window) {
      try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); copied = true } catch { /* fall through to download */ }
    }
    if (!copied && blob) download()
    window.open(xIntent(text), '_blank', 'noopener')
    toast(copied ? 'Graphic copied. Paste it into your post' : 'Graphic downloaded. Attach it to your post')
  }

  async function nativeShare() {
    if (!blob) return
    try { await navigator.share({ files: [new File([blob], payload!.file, { type: 'image/png' })], text }) }
    catch (e: any) { if (e?.name !== 'AbortError') toast('Sharing didn’t work here. Try Post on X') }
  }

  return (
    <Modal open={!!payload} onClose={onClose} labelledBy="share-title" className="modal__box--share">
      <h2 id="share-title" className="modal__title">Share it</h2>
      <div className="share__preview">
        {url ? <img src={url} alt="Your COZMC share graphic" width={1200} height={675} /> : <p className="state state--load"><span className="blink">▮</span> Drawing your graphic…</p>}
      </div>
      {err && <p className="state state--err">{err}</p>}
      <label className="field">
        <span className="field__label">Post text <span className="muted">{text.length}</span></span>
        <textarea rows={3} value={text} onChange={e => setText(e.target.value)} />
      </label>
      <div className="share__actions">
        {canNative && <button className="btn btn--phos" onClick={nativeShare}>Share…</button>}
        <button data-autofocus className={`btn ${canNative ? 'btn--ghost' : 'btn--phos'}`} onClick={postToX} disabled={!blob && !err}><XGlyph /> Post on X</button>
        <button className="btn btn--ghost" onClick={download} disabled={!blob}>Download</button>
      </div>
      <p className="share__hint">{canNative ? 'Share… attaches the graphic directly. ' : ''}Post on X copies the graphic and opens X with your text. Paste the image into the post (Ctrl+V or ⌘V).</p>
    </Modal>
  )
}
