/* The Star Loft: where a Cozmling lives, whichever kind it is.

   A first-version Cozmling keeps its own look, home, stage and rules and is drawn by its own
   renderer; a Starprint adventurer is drawn from its art. Around either one this screen is the
   same: who it is, under its own sky; the scene; Food / Fun / Energy; the care buttons; its
   Starprint, wardrobe, growth and memories; where it is saved; and the way to the arcade.
   Every action is a real button. Nothing here needs a wallet. */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ageText, FOODS, GROWTH, HOMES, utcDay, type Pet } from '../../companion/care'
import { GLOWS, STAGE_NAME, STAGES } from '../../companion/look'
import { ART } from '../../companion/room'
import { Icon, PixelArt } from '../../components/Pixel'
import { COZMLING_DEV, cozmlingStore } from '../index'
import { CareMeters } from '../components/CareMeters'
import { Glyph, Orb } from '../components/Glyph'
import { SaveChip, SaveStatus } from '../components/SaveStatus'
import { StarSky } from '../components/StarSky'
import { careFor, hatch, look, nameOf, type CareAction, type CareResult } from '../domain/care'
import { birthdayText, ELEMENTS, signInfo } from '../domain/starprint'
import { legacyGrowth, legacyStage } from '../integrations/legacyAdapter'
import { CompanionRenderer, type RendererHandle } from '../render/CompanionRenderer'
import type { AdventurerCompanion, Companion, LegacyCompanion } from '../types'
import { CustomizePanel } from './CustomizePanel'
import { MemoriesPanel } from './MemoriesPanel'

type AdvStage = NonNullable<AdventurerCompanion['progress']['visualStage']>
const ADV_STAGE: Record<AdvStage, string> = { hatchling: 'Hatchling', adolescent: 'Adolescent', ascended: 'Ascended' }
const ADV_STAGES = Object.keys(ADV_STAGE) as AdvStage[]
const ARCADE: [string, string][] = [['moon-bounce', 'Moon Bounce'], ['brick-by-brick', 'Brick by Brick'], ['moonshot', 'Moonshot']]
const NOT_SAVED = 'That didn’t save. Try again in a moment.'
/** A darker shade of a colour, for the deep end of a sky. */
const deepen = (hex: string) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.28).toString(16).padStart(2, '0')).join('')
/** The two colours a Cozmling's sky is painted in: its element's, or a first-version Cozmling's own glow. */
function skyOf(c: Companion): [string, string] {
  if (c.kind === 'adventurer') return ELEMENTS[c.starprint.element].orb
  const glow = GLOWS[c.legacy.pet.look.glow] ?? GLOWS[0]
  return [glow, deepen(glow)]
}

export function StarLoftScreen({ companion: c, arrived }: { companion: Companion; /** just adopted, or just switched to: start at the top of its page, keyboard included */ arrived?: boolean }) {
  const scene = useRef<RendererHandle>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const hatchedHere = useRef(false)
  useEffect(() => { if (arrived) { title.current?.focus({ preventScroll: true }); scrollTo(0, 0) } }, [arrived])
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

  /** Up and down arrows (and Home and End) move through the food menu, as they do in any menu. */
  const menuKeys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')], at = items.indexOf(document.activeElement as HTMLElement)
    const to = e.key === 'ArrowDown' ? (at + 1) % items.length : e.key === 'ArrowUp' ? (at - 1 + items.length) % items.length : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1
    if (to < 0) return
    e.preventDefault(); items[to]?.focus()
  }

  const id = c.companionId, name = nameOf(c)
  const { pet, mood, hatched, asleep } = look(c)
  const [o1, o2] = skyOf(c)

  /** One care action. It is made in its turn (after any change still being saved), then the page says and shows what really happened. */
  const care = async (a: CareAction, food?: string) => {
    const store = cozmlingStore()
    if (!store || busy) return
    const got: { out?: CareResult } = {}
    const res = await store.update(id, (cur, now) => (got.out = careFor(cur, a, now)).companion, { note: { eventId: `care:${id}:${utcDay()}`, type: 'care' } })
    if (!res.ok) { setSay(NOT_SAVED); scene.current?.react('refuse'); return }
    const out = got.out
    if (!out) return
    if (out.say) setSay(out.say)
    if (!out.ok || !out.companion) scene.current?.react('refuse')
    else scene.current?.react(a.do === 'rest' ? (look(out.companion).asleep ? 'sleep' : 'wake') : a.do, food)
  }
  const doHatch = async () => {
    const store = cozmlingStore()
    if (!store || busy) return
    setBusy(true)
    hatchedHere.current = true                 // set before the save: the page can show the hatchling before the save call returns
    const res = await store.update(id, hatch, { event: { eventId: `hatched:${id}`, type: 'hatched' } })
    setBusy(false)
    setCrack(0)
    if (!res.ok) { hatchedHere.current = false; if (res.reason !== 'duplicate') setSay(NOT_SAVED); return }      // 'duplicate' = it already hatched in another tab
    scene.current?.react('hatch')
    setSay(`Welcome to the world, ${name}!`)
  }
  // the egg's buttons are gone once it hatches: hand the keyboard to the first care button
  useEffect(() => { if (hatched && hatchedHere.current) { hatchedHere.current = false; document.getElementById('sl-feed-btn')?.focus({ preventScroll: true }) } }, [hatched])
  const warm = () => {
    if (busy) return
    if (crack < 3) { setCrack(crack + 1); scene.current?.react('crack'); return }
    void doHatch()
  }

  return (
    <div className="sl-page" style={{ '--o1': o1, '--o2': o2 } as CSSProperties}>
      <header className="sl-hero">
        <StarSky seed={id} a={o1} b={o2} />
        <div className="sl-hero__text">
          <p className="kicker">Star Loft</p>
          <h1 ref={title} tabIndex={-1}>{name}</h1>
          <div className="sl-hero__tags">
            <Identity c={c} pet={pet} hatched={hatched} />
            <SaveChip />
          </div>
        </div>
      </header>

      <section className="sl">
        <div className="sl__main">
          <div className={`sl__screen${asleep ? ' is-night' : ''}`}>
            <CompanionRenderer ref={scene} companion={c} mode="loft" crack={crack} previewStage={preview} onTap={!hatched ? warm : asleep ? undefined : () => void care({ do: 'pat' })} />
            <p className="sl__say" aria-live="polite">{say}</p>
          </div>

          <div className="sl-status">
            <p className={`sl-mood sl-mood--${mood.mood}`}>{hatched ? mood.line : 'Something is moving inside the egg. Keep it warm.'}</p>
            <CareMeters pet={pet} dim={!hatched} />
          </div>

          {!hatched ? (
            <div className="sl-eggacts">
              <button className="btn btn--phos" onClick={warm} disabled={busy}>Warm the egg</button>
              <span className="sl-pips" role="img" aria-label={`Warmed ${crack} of 4 times`}>{[0, 1, 2, 3].map(i => <i key={i} className={i < crack ? 'on' : ''} />)}</span>
              <button className="btn btn--ghost" onClick={() => void doHatch()} disabled={busy}>Hatch now</button>
            </div>
          ) : (
            <div className="sl-actions">
              <div className="sl-feed">
                <button id="sl-feed-btn" className="sl-act" aria-haspopup="menu" aria-expanded={menu} aria-controls="sl-feed-menu" onClick={() => setMenu(v => !v)} disabled={asleep}>
                  <PixelArt rows={ART.cheese.rows} palette={ART.cheese.pal} size={26} /><span>Feed</span>
                </button>
                {menu && (
                  <div className="sl-menu" id="sl-feed-menu" role="menu" aria-label="Food" onKeyDown={menuKeys}>
                    {FOODS.map((f, i) => (
                      <button key={f.id} role="menuitem" autoFocus={i === 0} onClick={() => { setMenu(false); document.getElementById('sl-feed-btn')?.focus(); void care({ do: 'feed', food: f.id }, f.id) }}>
                        <PixelArt rows={ART[f.id].rows} palette={ART[f.id].pal} size={20} />
                        <span>{f.name}</span><small>{f.fun > 10 ? 'treat' : `+${f.food} food`}</small>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="sl-act" onClick={() => void care({ do: 'play' })} disabled={asleep}><PixelArt rows={ART.ball.rows} palette={ART.ball.pal} size={26} /><span>Play</span></button>
              <button className="sl-act" onClick={() => void care({ do: 'pat' })} disabled={asleep}><PixelArt rows={ART.heart.rows} palette={ART.heart.pal} size={26} /><span>Pat</span></button>
              <button className="sl-act" onClick={() => void care({ do: 'rest' })}><PixelArt rows={ART.z.rows} palette={ART.z.pal} size={24} /><span>{asleep ? 'Wake up' : 'Rest'}</span></button>
            </div>
          )}
          <p className="sl-fine">Needs run down over about a day, even while you’re away. {name} never dies; a neglected Cozmling just gets hungry, bored or sleepy.</p>
        </div>

        <aside className="sl__side" aria-label={`About ${name}`}>
          {c.kind === 'adventurer' ? <StarprintPanel c={c} /> : <FirstVersionPanel c={c} pet={pet} hatched={hatched} />}

          <div className="panel sl-wardrobepanel">
            <header className="panel__head">
              <h2>Wardrobe</h2>
              <button className="btn btn--ghost btn--sm" aria-expanded={wardrobe} aria-controls="sl-wardrobe" onClick={() => setWardrobe(v => !v)}>{wardrobe ? 'Close' : 'Customize'}</button>
            </header>
            {wardrobe
              ? <div id="sl-wardrobe"><CustomizePanel companion={c} onSaved={text => { setSay(text); setWardrobe(false) }} /></div>
              : <p className="sl-fine sl-fine--flush">{c.kind === 'adventurer' ? <>Look {c.appearance.appearanceOption.toUpperCase()}, starter outfit. Change {name}’s look, colour or name.</> : <>{name} lives in the {HOMES[pet.home].name}. Choose another home.</>}</p>}
          </div>

          <GrowingUp c={c} pet={pet} name={name} hatched={hatched} />

          <div className="panel sl-savepanel">
            <SaveStatus name={name} />
          </div>

        </aside>

        <div className="sl__more">
          <div className="panel sl-mempanel">
            <header className="panel__head"><h2>Memories</h2></header>
            <MemoriesPanel companionId={id} name={name} revision={c.revision} />
          </div>

          {COZMLING_DEV && c.kind === 'adventurer' && hatched && (
            <div className="panel sl-devpanel">
              <header className="panel__head"><h2>Preview tools</h2></header>
              <p className="sl-fine sl-fine--flush">Stage preview. Nothing here is saved, and players never see this box. The placeholder art has one drawing per look, so a stage only changes its size for now.</p>
              <div className="chips">
                {ADV_STAGES.map(s => <button key={s} className={`chip${(preview ?? c.progress.visualStage) === s ? ' on' : ''}`} aria-pressed={(preview ?? c.progress.visualStage) === s} onClick={() => setPreview(s === c.progress.visualStage ? null : s)}>{ADV_STAGE[s]}</button>)}
              </div>
            </div>
          )}
        </div>

        <nav className="sl-arcadebar" aria-label="Arcade">
          <div className="sl-arcadebar__head">
            <Icon name="arcade" size={26} color="var(--sl-coral)" />
            <div>
              <h2>COZMC Arcade</h2>
              <p>{c.kind === 'legacy' ? <>Every game you play while {name} is awake cheers them up and helps them grow.</> : <>Three games, a short walk from the loft.</>}</p>
            </div>
          </div>
          <ul className="sl-games">
            {ARCADE.map(([slug, title]) => <li key={slug}><a className={`sl-game sl-game--${slug}`} href={`#/arcade/${slug}`}>{title}</a></li>)}
          </ul>
          <a className="btn btn--phos" href="#/arcade"><Icon name="arcade" size={14} /> Go to the arcade</a>
        </nav>
      </section>
    </div>
  )
}

/** Who this is, in one line under its name. */
function Identity({ c, pet, hatched }: { c: Companion; pet: Pet; hatched: boolean }) {
  if (c.kind === 'legacy') return (
    <p className="sl-id">
      <span className="sl-id__sign">{hatched ? STAGE_NAME[legacyStage(c)] : 'Star Egg'}</span>
      {hatched && <span>{pet.look.form === 'girl' ? 'Girl' : 'Boy'}</span>}
      <span className="sl-id__born">{!hatched ? 'Waiting to hatch' : c.hatch.provenance === 'legacy-unknown' ? 'Restored from a wallet' : ageText(pet)}</span>
    </p>
  )
  const sign = signInfo(c.starprint.coreSign), el = ELEMENTS[c.starprint.element]
  return (
    <p className="sl-id">
      <span className="sl-id__sign"><Glyph sign={sign.sign} size={20} /> {sign.name}</span>
      <span><Orb element={c.starprint.element} size={14} /> {el.name}</span>
      <span>The {c.starprint.archetype}</span>
      <span className="sl-id__born">{hatched ? ADV_STAGE[c.progress.visualStage ?? 'hatchling'] : 'Star Egg'}</span>
    </p>
  )
}

/** The Starprint: where this Cozmling's character begins. Only what is really known is shown. */
function StarprintPanel({ c }: { c: AdventurerCompanion }) {
  const sign = signInfo(c.starprint.coreSign), el = ELEMENTS[c.starprint.element]
  return (
    <div className="panel sl-print">
      <header className="panel__head"><h2>Starprint</h2></header>
      <div className="sl-print__row">
        <span className="sl-medal" aria-hidden="true"><Glyph sign={sign.sign} size={34} /></span>
        <dl className="sl-facts">
          <div><dt>Sign</dt><dd>{sign.name}</dd></div>
          <div><dt>Element</dt><dd><Orb element={c.starprint.element} size={13} /> {el.name}</dd></div>
          <div><dt>Archetype</dt><dd>The {c.starprint.archetype}</dd></div>
          <div><dt>Birthday</dt><dd>{birthdayText(c.starprint.chosenBirthday)}</dd></div>
        </dl>
      </div>
      <p className="sl-fine">The Starprint is where {c.name}’s character begins. What the two of you do together decides the rest.</p>
    </div>
  )
}

/** A first-version Cozmling says what it is, and that it stays that way. */
function FirstVersionPanel({ c, pet, hatched }: { c: LegacyCompanion; pet: Pet; hatched: boolean }) {
  return (
    <div className="panel sl-print">
      <header className="panel__head"><h2>About {pet.name}</h2></header>
      <dl className="sl-facts sl-facts--wide">
        <div><dt>Kind</dt><dd>First-version Cozmling</dd></div>
        <div><dt>Stage</dt><dd>{STAGE_NAME[legacyStage(c)]}</dd></div>
        <div><dt>Home</dt><dd>{HOMES[pet.home].name}</dd></div>
        <div><dt>Age</dt><dd>{!hatched ? 'Not hatched yet' : c.hatch.provenance === 'legacy-unknown' ? 'Not recorded' : ageText(pet)}</dd></div>
      </dl>
      <p className="sl-fine">{pet.name} keeps the look, home, stage and counts it has always had. Nothing about it was changed by the move here.</p>
    </div>
  )
}

/** The steps of growing up, with the one it is on now. */
function Journey({ steps, at }: { steps: string[]; at: number }) {
  return (
    <ol className="sl-journey">
      {steps.map((s, i) => (
        <li key={s} className={i < at ? 'is-done' : i === at ? 'is-now' : 'is-later'} aria-current={i === at ? 'step' : undefined}>
          <span className="sl-journey__dot" aria-hidden="true">
            {i < at ? <svg viewBox="0 0 12 12" width="14" height="14"><path d="M2 6.4l2.7 2.7L10 3.4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" /></svg>
              : i === at ? <svg viewBox="0 0 12 12" width="14" height="14"><path d="M6 0l1.3 4.7L12 6 7.3 7.3 6 12 4.7 7.3 0 6l4.7-1.3z" fill="currentColor" /></svg> : null}
          </span>
          <span className="sl-journey__name">{s}</span>
          <span className="sr-only">{i < at ? ' (done)' : i === at ? ' (now)' : ' (still to come)'}</span>
        </li>
      ))}
    </ol>
  )
}

/** Growing up. A first-version Cozmling keeps its own stages and thresholds exactly. An adventurer's
    later stages have no approved thresholds yet, so no bar is shown for one: only what has been counted. */
function GrowingUp({ c, pet, name, hatched }: { c: Companion; pet: Pet; name: string; hatched: boolean }) {
  const counts = hatched && (
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
        <Journey steps={STAGES.map(s => STAGE_NAME[s])} at={STAGES.indexOf(hatched ? g.stage : 'egg')} />
        {hatched && (
          <>
            <p className="sl-grow__row"><b>{STAGE_NAME[g.stage]}</b><span>{g.next ? <>{g.points} / {g.next.at} to {STAGE_NAME[g.next.stage]}</> : <>Fully grown · {g.points} points</>}</span></p>
            <div className="sl-bar" role="progressbar" aria-label="Growth" aria-valuemin={0} aria-valuemax={100} aria-valuenow={g.pct}><i style={{ width: `${g.pct}%` }} /></div>
          </>
        )}
        {counts}
        <p className="sl-fine">Arcade runs count the most toward growing up, and runs played while {name} is happy count double. Daily check-ins and care help too.</p>
      </div>
    )
  }
  return (
    <div className="panel sl-grow">
      <header className="panel__head"><h2>Growing up</h2></header>
      <Journey steps={['Star Egg', ...ADV_STAGES.map(s => ADV_STAGE[s])]} at={hatched ? ADV_STAGES.indexOf(c.progress.visualStage ?? 'hatchling') + 1 : 0} />
      {counts}
      <p className="sl-fine">{hatched
        ? <>How a Hatchling grows up is still being decided, so there’s no bar to fill yet. Everything you do together is counted, and nothing {name} has done will be lost.</>
        : <>Keep the egg warm and it hatches into a Hatchling.</>}</p>
    </div>
  )
}

/** Where a first-version Cozmling is on its own ladder. Its stage is never shown lower than the one it arrived with. */
function legacyProgress(c: LegacyCompanion) {
  const stage = legacyStage(c), points = legacyGrowth(c)
  const i = GROWTH.findIndex(s => s.stage === stage), from = GROWTH[i]?.at ?? 0, next = i < 0 ? null : GROWTH[i + 1] ?? null
  const pct = next ? Math.max(0, Math.min(100, Math.round(((points - from) / (next.at - from)) * 100))) : 100
  return { stage, points, next, pct }
}
