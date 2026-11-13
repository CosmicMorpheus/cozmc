/* Where was your Cozmling born? Three ways, all optional to think about:
     Choose a place   a real city or town anywhere, found by typing (searched in this browser, never sent anywhere)
     Surprise me!     a place picked at random from a curated list, with another try until it feels right
     COZMC default    the Origin Observatory on Mauna Kea, already chosen: the simplest way to adopt
   The site never asks where the player is and never uses their location. The place only sets where the
   Cozmling's sky is read (its Moon, Rising sign and houses), and is kept with the Cozmling in this browser. */
import { useEffect, useState } from 'react'
import { clockText, ORIGIN_OBSERVATORY } from '../celestial/observatory'
import { coordsText, isDefaultPlace } from '../celestial/birthplace'
import { loadPlaces, toBirthplace, type PlaceBook } from '../celestial/places/places'
import type { Birthplace } from '../celestial/types'

type Mode = 'chosen' | 'surprise' | 'default'
const OPTIONS: { mode: Mode; name: string; note: string }[] = [
  { mode: 'chosen', name: 'Choose a Place', note: 'any city or town in the world' },
  { mode: 'surprise', name: 'Surprise Me!', note: 'a place picked at random' },
  { mode: 'default', name: 'Use COZMC Default', note: 'recommended · the Origin Observatory on Mauna Kea' },
]

export function BirthplacePicker({ value, onChange }: {
  value: Birthplace
  /** the birthplace, and whether it is settled (false while "Choose a place" has nothing picked yet) */
  onChange: (place: Birthplace, ready: boolean) => void
}) {
  const [mode, setMode] = useState<Mode>(value.choice === 'chosen' || value.choice === 'surprise' ? value.choice : 'default')
  const [book, setBook] = useState<PlaceBook | null>(null)
  const [failed, setFailed] = useState(false)
  const [tries, setTries] = useState(0)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<Birthplace | null>(value.choice === 'chosen' ? value : null)
  const [surprise, setSurprise] = useState<Birthplace | null>(value.choice === 'surprise' ? value : null)

  // the list of places, fetched the first time it is needed
  useEffect(() => {
    if (mode === 'default' || book) return
    let on = true
    setFailed(false)
    loadPlaces().then(b => { if (on) setBook(b) }, () => { if (on) setFailed(true) })
    return () => { on = false }
  }, [mode, book, tries])

  // The option chosen decides the birthplace, told to the adoption form in the same moment as the click (so "Next"
  // can never go ahead with the wrong place). Until a place is picked, the default stands, and isn't settled.
  const setSurprising = (b: PlaceBook, notId?: string) => { const x = toBirthplace(b.surprise(notId), 'surprise', b); setSurprise(x); onChange(x, true) }
  const choose = (m: Mode) => {
    setMode(m)
    if (m === 'default') onChange(ORIGIN_OBSERVATORY, true)
    else if (m === 'chosen') onChange(picked ?? ORIGIN_OBSERVATORY, !!picked)
    else if (surprise) onChange(surprise, true)
    else if (book) setSurprising(book)
    else onChange(ORIGIN_OBSERVATORY, false)
  }
  // the atlas arriving while "Surprise me" waits for it
  useEffect(() => { if (mode === 'surprise' && book && !surprise) setSurprising(book) }, [mode, book])

  const results = book && mode === 'chosen' ? book.search(query) : []
  const reroll = () => { if (book) setSurprising(book, surprise?.id.replace(/^place:/, '')) }
  const shown = mode === 'default' ? ORIGIN_OBSERVATORY : mode === 'chosen' ? picked : surprise

  return (
    <fieldset className="sl-bp">
      <legend>Where was your Cozmling born?</legend>
      <p className="sl-fine sl-fine--flush">Every Cozmling begins its journey beneath a unique sky. Choose where its story begins.</p>
      <div className="sl-bp__options">
        {OPTIONS.map(o => (
          <label key={o.mode} className={`sl-bp__option${mode === o.mode ? ' is-on' : ''}`}>
            <input type="radio" name="sl-birthplace" value={o.mode} checked={mode === o.mode} onChange={() => choose(o.mode)} />
            <span className="sl-bp__name">{o.name}</span>
            <span className="sl-bp__note">{o.note}</span>
          </label>
        ))}
      </div>

      {mode !== 'default' && !book && (
        failed
          ? <p className="sl-bp__problem" role="alert">The list of places couldn’t be loaded (are you offline?). <button type="button" className="link" onClick={() => setTries(t => t + 1)}>Try again</button>, or use the COZMC default.</p>
          : <p className="sl-fine" role="status">Opening the atlas…</p>
      )}

      {mode === 'chosen' && book && (
        <div className="sl-bp__search">
          <label htmlFor="sl-bp-q">Search for a city or town</label>
          <input id="sl-bp-q" type="search" value={query} autoComplete="off" spellCheck={false} placeholder="e.g. Lisbon, Nairobi, Kyoto" onChange={e => setQuery(e.target.value)} />
          <p className="sr-only" role="status">{query.trim().length >= 2 ? `${results.length} ${results.length === 1 ? 'place' : 'places'} found` : ''}</p>
          {results.length > 0 && (
            <ul className="sl-bp__results" aria-label="Places found">
              {results.map(p => (
                <li key={p.id}>
                  <button type="button" aria-pressed={picked?.id === `place:${p.id}`} onClick={() => { const b = toBirthplace(p, 'chosen', book); setPicked(b); onChange(b, true); setQuery('') }}>
                    <span>{p.label}</span><small>{coordsText(p)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {query.trim().length >= 2 && results.length === 0 && <p className="sl-fine">No place by that name in the atlas. Try another spelling, or a bigger town nearby.</p>}
        </div>
      )}

      {shown && (
        <div className="sl-bp__card" aria-live="polite">
          <p className="sl-bp__where">{isDefaultPlace(shown) ? <><b>The Origin Observatory</b> · Mauna Kea, Hawaii</> : <><b>{shown.name}</b>{shown.place.startsWith(`${shown.name}, `) ? ` · ${shown.place.slice(shown.name.length + 2)}` : ''}</>}</p>
          <p className="sl-bp__facts">
            {coordsText(shown)} · {isDefaultPlace(shown) ? 'a fictional observatory on a real mountain, Hawaii time all year' : <>{shown.timeZone.replace(/_/g, ' ')} · {clockText(Date.now(), shown.timeZone)} there now</>}
          </p>
          {mode === 'surprise' && <button type="button" className="btn btn--ghost btn--sm" onClick={reroll}>Another place</button>}
          {mode === 'chosen' && picked && <p className="sl-fine sl-fine--flush">Not quite? Search again to change it, any time before the egg is made.</p>}
        </div>
      )}
      {mode === 'chosen' && book && !picked && <p className="sl-fine">Pick a place from the list to carry on, or choose another option.</p>}

      <p className="sl-fine">A real place is completely optional. COZMC never asks where you are and never uses your location: this is only where your Cozmling’s sky is read. It’s saved with your Cozmling in this browser, and nowhere else.</p>
    </fieldset>
  )
}
