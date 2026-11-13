/* The Star Loft: where a Cozmling lives, whichever kind it is.

   A first-version Cozmling keeps its own look, home, stage and rules and is drawn by its own
   renderer; a Starprint adventurer is drawn from its art. Around either one this screen is the
   same: who it is, the scene, Food / Fun / Energy, the care buttons, where it is saved, its
   wardrobe and its memories. Every action is a real button. Nothing here needs a wallet. */
import { useEffect, useRef, useState } from 'react'
import { ageText, FOODS, GROWTH, utcDay, type Pet } from '../../companion/care'
import { STAGE_NAME } from '../../companion/look'
import { ART } from '../../companion/room'
import { Icon, PixelArt } from '../../components/Pixel'
import { COZMLING_DEV, cozmlingStore } from '../index'
import { CareMeters } from '../components/CareMeters'
import { Glyph, Orb } from '../components/Glyph'
import { SaveStatus } from '../components/SaveStatus'
import { careFor, hatch, look, nameOf, type CareAction } from '../domain/care'
import { birthdayText, ELEMENTS, signInfo } from '../domain/starprint'
import { legacyGrowth, legacyStage } from '../integrations/legacyAdapter'
import { CompanionRenderer, type RendererHandle } from '../render/CompanionRenderer'
import type { AdventurerCompanion, Companion, LegacyCompanion } from '../types'
import { CustomizePanel } from './CustomizePanel'
import { MemoriesPanel } from './MemoriesPanel'

type AdvStage = NonNullable<AdventurerCompanion['progress']['visualStage']>
const ADV_STAGE: Record<AdvStage, string> = { hatchling: 'Hatchling', adolescent: 'Adolescent', ascended: 'Ascended' }
const NOT_SAVED = 'That didn’t save. Try again in a moment.'

export function StarLoftScreen({ companion: c }: { companion: Companion }) {
  const scene = useRef<RendererHandle>(null)
  const [say, setSay] = useState('')
  const [crack, setCrack] = useState(0)
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [wardrobe, setWardrobe] = useState(false)
  const [preview, setPreview] = useState<AdvStage | null>(null)
  const [, setTick] = useState(0)

  // needs run down in real time: look again every so often (looking saves nothing)
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 20_000); return () => clearInterval(t) }, [])
  useEffect(() => { if (!say) return; const t = setTimeout(() => setSay(''), 4200); return () => clearTimeout(t) }, [say])
  // the food menu closes on Escape or a tap anywhere else
  useEffect(() => {
    if (!menu) return
    const down = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest?.('.sl-feed')) setMenu(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenu(false); document.getElementById('sl-feed-btn')?.focus() } }
    addEventListener('pointerdown', down); addEventListener('keydown', key)
    return () => { removeEventListener('pointerdown', down); removeEventListener('keydown', key) }
  }, [menu])

  const id = c.companionId, name = nameOf(c)
  const { pet, mood, hatched, asleep } = look(c)

  /** One care action: say what happened, act it out, and save it (once). */
  const care = async (a: CareAction, show: Parameters<RendererHandle['react']>[0], food?: string) => {
    const store = cozmlingStore()
    if (!store || busy) return
    const first = careFor(c, a, Date.now())
    if (first.say) setSay(first.say)
    if (!first.ok) { scene.current?.react('refuse'); return }
    scene.current?.react(show, food)
    const res = await store.update(id, (cur, now) => careFor(cur, a, now).companion, { note: { eventId: `care:${id}:${utcDay()}`, type: 'care' } })
    if (!res.ok) setSay(NOT_SAVED)
  }
  const doHatch = async () => {
    const store = cozmlingStore()
    if (!store || busy) return
    setBusy(true)
    const res = await store.update(id, hatch, { event: { eventId: `hatched:${id}`, type: 'hatched' } })
    setBusy(false)
    setCrack(0)
    if (!res.ok) { if (res.reason !== 'duplicate') setSay(NOT_SAVED); return }      // 'duplicate' = it already hatched in another tab
    scene.current?.react('hatch')
    setSay(`Welcome to the world, ${name}!`)
  }
  const warm = () => {
    if (busy) return
    if (crack < 3) { setCrack(crack + 1); scene.current?.react('crack'); return }
    void doHatch()
  }

  return (
    <>
      <header className="page-head sl-head">
        <p className="kicker">Star Loft</p>
        <h1>{name}</h1>
        <Identity c={c} pet={pet} hatched={hatched} />
      </header>

      <section className="sl">
        <div className="sl__scene">
          <div className={`sl__screen${asleep ? ' is-night' : ''}`}>
            <CompanionRenderer ref={scene} companion={c} mode="loft" crack={crack} previewStage={preview} onTap={!hatched ? warm : asleep ? undefined : () => void care({ do: 'pat' }, 'pat')} />
            <p className="sl__say" aria-live="polite">{say}</p>
          </div>
        </div>

        <div className="sl__care">
          <div className="panel sl-care">
            <p className={`sl-mood sl-mood--${mood.mood}`}>{hatched ? mood.line : 'Something is moving inside the egg. Keep it warm.'}</p>
            <CareMeters pet={pet} dim={!hatched} />

            {!hatched ? (
              <div className="sl-actions sl-actions--egg">
                <button className="btn btn--phos" onClick={warm} disabled={busy}>Warm the egg</button>
                <span className="sl-pips" role="img" aria-label={`Warmed ${crack} of 4 times`}>{[0, 1, 2, 3].map(i => <i key={i} className={i < crack ? 'on' : ''} />)}</span>
                <button className="btn btn--ghost" onClick={() => void doHatch()} disabled={busy}>Hatch now</button>
              </div>
            ) : (
              <div className="sl-actions">
                <div className="sl-feed">
                  <button id="sl-feed-btn" className="btn btn--phos" aria-haspopup="menu" aria-expanded={menu} aria-controls="sl-feed-menu" onClick={() => setMenu(v => !v)} disabled={asleep}>
                    <PixelArt rows={ART.cheese.rows} palette={ART.cheese.pal} size={16} /> Feed
                  </button>
                  {menu && (
                    <div className="sl-menu" id="sl-feed-menu" role="menu" aria-label="Food">
                      {FOODS.map((f, i) => (
                        <button key={f.id} role="menuitem" autoFocus={i === 0} onClick={() => { setMenu(false); void care({ do: 'feed', food: f.id }, 'feed', f.id) }}>
                          <PixelArt rows={ART[f.id].rows} palette={ART[f.id].pal} size={20} />
                          <span>{f.name}</span><small>{f.fun > 10 ? 'treat' : `+${f.food} food`}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn btn--phos" onClick={() => void care({ do: 'play' }, 'play')} disabled={asleep}><PixelArt rows={ART.ball.rows} palette={ART.ball.pal} size={16} /> Play</button>
                <button className="btn btn--ghost" onClick={() => void care({ do: 'pat' }, 'pat')} disabled={asleep}><PixelArt rows={ART.heart.rows} palette={ART.heart.pal} size={16} /> Pat</button>
                <button className="btn btn--phos" onClick={() => void care({ do: 'rest' }, asleep ? 'wake' : 'sleep')}><PixelArt rows={ART.z.rows} palette={ART.z.pal} size={14} /> {asleep ? 'Wake up' : 'Rest'}</button>
              </div>
            )}
            <p className="sl-fine">Needs run down over about a day, even while you’re away. {name} never dies; a neglected Cozmling just gets hungry, bored or sleepy.</p>
          </div>

          <div className="panel sl-savepanel">
            <SaveStatus name={name} />
          </div>
        </div>

        <div className="sl__more">
          <div className="panel sl-wardrobepanel">
            <header className="panel__head">
              <h2>Wardrobe</h2>
              <button className="btn btn--ghost btn--sm" aria-expanded={wardrobe} aria-controls="sl-wardrobe" onClick={() => setWardrobe(v => !v)}>{wardrobe ? 'Close' : 'Customize'}</button>
            </header>
            {wardrobe
              ? <div id="sl-wardrobe"><CustomizePanel companion={c} onSaved={text => { setSay(text); setWardrobe(false) }} /></div>
              : <p className="sl-fine sl-fine--flush">{c.kind === 'adventurer' ? <>Look {c.appearance.appearanceOption.toUpperCase()}, starter outfit. Change {name}’s look, colour or name.</> : <>Choose which home {name} lives in.</>}</p>}
          </div>

          {hatched && <GrowingUp c={c} pet={pet} name={name} />}

          <div className="panel sl-mempanel">
            <header className="panel__head"><h2>Memories</h2></header>
            <MemoriesPanel companionId={id} name={name} revision={c.revision} />
          </div>

          <div className="panel sl-arcade">
            <div>
              <h2>Arcade</h2>
              <p>Moon Bounce, Brick by Brick and Moonshot are a short walk from the loft.</p>
            </div>
            <a className="btn btn--phos" href="#/arcade"><Icon name="arcade" size={14} /> To the arcade</a>
          </div>

          {COZMLING_DEV && c.kind === 'adventurer' && hatched && (
            <div className="panel sl-devpanel">
              <header className="panel__head"><h2>Preview tools</h2></header>
              <p className="sl-fine sl-fine--flush">Stage preview. Nothing here is saved, and players never see this box. The placeholder art has one drawing per look, so a stage only changes its size for now.</p>
              <div className="chips">
                {(Object.keys(ADV_STAGE) as AdvStage[]).map(s => <button key={s} className={`chip${(preview ?? c.progress.visualStage) === s ? ' on' : ''}`} aria-pressed={(preview ?? c.progress.visualStage) === s} onClick={() => setPreview(s === c.progress.visualStage ? null : s)}>{ADV_STAGE[s]}</button>)}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

/** Who this is, in one line under its name. */
function Identity({ c, pet, hatched }: { c: Companion; pet: Pet; hatched: boolean }) {
  if (c.kind === 'legacy') return (
    <p className="sl-id">
      {hatched ? <>{pet.look.form === 'girl' ? 'Girl' : 'Boy'}, {STAGE_NAME[legacyStage(c)]}. {c.hatch.provenance === 'legacy-unknown' ? 'Restored from a wallet.' : `${ageText(pet)}.`}</> : <>A Star Egg, waiting to hatch.</>}
    </p>
  )
  const sign = signInfo(c.starprint.coreSign), el = ELEMENTS[c.starprint.element]
  return (
    <p className="sl-id sl-id--print">
      <span className="sl-id__sign"><Glyph sign={sign.sign} size={22} /> {sign.name}</span>
      <span><Orb element={c.starprint.element} size={16} /> {el.name}</span>
      <span>The {c.starprint.archetype}</span>
      <span>{hatched ? ADV_STAGE[c.progress.visualStage ?? 'hatchling'] : 'Star Egg'}</span>
      <span className="sl-id__born">Birthday {birthdayText(c.starprint.chosenBirthday)}</span>
    </p>
  )
}

/** Growing up. A first-version Cozmling keeps its own stages and thresholds exactly. An adventurer's
    later stages have no approved thresholds yet, so no bar is shown for one: only what has been counted. */
function GrowingUp({ c, pet, name }: { c: Companion; pet: Pet; name: string }) {
  const counts = (
    <dl className="sl-stats">
      <div><dt>Meals</dt><dd>{pet.fed}</dd></div>
      <div><dt>Playtime</dt><dd>{pet.played}</dd></div>
      <div><dt>Arcade runs</dt><dd>{pet.arcade ?? 0}</dd></div>
      <div><dt>Pats</dt><dd>{pet.pets}</dd></div>
    </dl>
  )
  if (c.kind === 'legacy') {
    const g = legacyProgress(c)
    return (
      <div className="panel sl-grow">
        <header className="panel__head"><h2>Growing up</h2></header>
        <p className="sl-grow__row"><b>{STAGE_NAME[g.stage]}</b><span>{g.next ? <>{g.points} / {g.next.at} to {STAGE_NAME[g.next.stage]}</> : <>Fully grown · {g.points} points</>}</span></p>
        <div className="sl-bar" role="progressbar" aria-label="Growth" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.pct}><i style={{ width: `${g.pct}%` }} /></div>
        {counts}
        <p className="sl-fine">Arcade runs count the most toward growing up, and runs played while {name} is happy count double. Daily check-ins and care help too.</p>
      </div>
    )
  }
  return (
    <div className="panel sl-grow">
      <header className="panel__head"><h2>Growing up</h2></header>
      <p className="sl-grow__row"><b>{ADV_STAGE[c.progress.visualStage ?? 'hatchling']}</b><span>Everything you do together is counted</span></p>
      {counts}
      <p className="sl-fine">How a Hatchling grows up is still being decided, so there’s no bar to fill yet. Nothing {name} has done will be lost when it is.</p>
    </div>
  )
}

/** Where a first-version Cozmling is on its own ladder. Its stage is never shown lower than the one it arrived with. */
function legacyProgress(c: LegacyCompanion) {
  const stage = legacyStage(c), points = legacyGrowth(c)
  const i = GROWTH.findIndex(s => s.stage === stage), from = GROWTH[i]?.at ?? 0, next = GROWTH[i + 1] ?? null
  const pct = next ? Math.max(0, Math.min(100, Math.round(((points - from) / (next.at - from)) * 100))) : 100
  return { stage, points, next, pct }
}
