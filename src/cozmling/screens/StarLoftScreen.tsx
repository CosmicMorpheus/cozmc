/* The Star Loft: where a Cozmling lives, whichever kind it is.

   A first-version Cozmling keeps its own look, home, stage and rules and is drawn by its own
   renderer; a Starprint adventurer is drawn from its art. Around either one this screen is the
   same: who it is, under its own sky; the scene; Food / Fun / Energy; the care buttons; its
   Starprint, wardrobe, growth and memories; where it is saved; and the way to the arcade.
   Every action is a real button. Nothing here needs a wallet. */
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { ageText, FOODS, GROWTH, HOMES, utcDay, type Pet } from '../../companion/care'
import { STAGE_NAME, STAGES } from '../../companion/look'
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
import { loadSkyEngine } from '../celestial/load'
import { playerTimeZone } from '../celestial/observatory'
import { legacySkyOption, starprintDisagrees } from '../celestial/options'
import { skyColors, useLateSky } from '../celestial/useSky'
import { bigThree, todayHeadline } from '../celestial/interpret'
import { useLiveSky } from '../celestial/useLiveSky'
import { POINTS } from '../celestial/zodiac'

type AdvStage = NonNullable<AdventurerCompanion['progress']['visualStage']>
const ADV_STAGE: Record<AdvStage, string> = { hatchling: 'Hatchling', adolescent: 'Adolescent', ascended: 'Ascended' }
const ADV_STAGES = Object.keys(ADV_STAGE) as AdvStage[]
const ARCADE: [string, string][] = [['moon-bounce', 'Moon Bounce'], ['brick-by-brick', 'Brick by Brick'], ['moonshot', 'Moonshot']]
const NOT_SAVED = 'That didn’t save. Try again in a moment.'
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
  const [o1, o2] = skyColors(c)

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
    // its sky is read in the same moment it hatches. If the astronomy can't load, it still hatches, and its
    // sky is read from its record (birthday and hatch time) as soon as it can be
    const sky = await loadSkyEngine().catch(() => null), tz = playerTimeZone()
    const before = c.kind === 'adventurer' ? c.starprint.coreSign : null
    hatchedHere.current = true                 // set before the save: the page can show the hatchling before the save call returns
    const res = await store.update(id, (cur, now) => (sky ? sky.hatchWithSky(cur, now, tz) : hatch(cur, now)), { event: { eventId: `hatched:${id}`, type: 'hatched' } })
    setBusy(false)
    setCrack(0)
    if (!res.ok) { hatchedHere.current = false; if (res.reason !== 'duplicate') setSay(NOT_SAVED); return }      // 'duplicate' = it already hatched in another tab
    scene.current?.react('hatch')
    const born = res.companion.celestial, after = res.companion.kind === 'adventurer' ? res.companion.starprint.coreSign : null
    setSay(!born ? `Welcome to the world, ${name}!`
      : before && after && before !== after ? `Welcome to the world, ${name}! It hatched just past the cusp: ${bigThree(born)}.`
      : `Welcome to the world, ${name}! ${bigThree(born)}.`)
  }
  // a Cozmling that hatched before its sky could be read gets it now, from its own record
  useLateSky(c)
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
          {c.kind === 'adventurer' ? <StarprintPanel c={c} /> : <FirstVersionPanel c={c} pet={pet} hatched={hatched} onSay={setSay} />}

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
  const sign = signInfo(c.starprint.coreSign), el = ELEMENTS[c.starprint.element], sky = c.celestial
  const signOf = (s: Parameters<typeof signInfo>[0]) => signInfo(s).name
  return (
    <div className="panel sl-print">
      <header className="panel__head"><h2>Starprint</h2>{sky && <a className="link" href="#/cozmling/sky">Birth sky</a>}</header>
      <div className="sl-print__row">
        <span className="sl-medal" aria-hidden="true"><Glyph sign={sign.sign} size={34} /></span>
        <dl className="sl-facts">
          <div><dt>{sky ? 'Sun' : 'Sign'}</dt><dd>{sky && <span className="sl-pglyph" aria-hidden="true">{POINTS.sun.glyph}</span>}{sign.name}</dd></div>
          {sky && <div><dt>Moon</dt><dd><span className="sl-pglyph" aria-hidden="true">{POINTS.moon.glyph}</span>{signOf(sky.bodies.moon.sign)}</dd></div>}
          {sky?.angles && <div><dt>Rising</dt><dd><span className="sl-pglyph" aria-hidden="true">AC</span>{signOf(sky.angles.ascendant.sign)}</dd></div>}
          <div><dt>Element</dt><dd><Orb element={c.starprint.element} size={13} /> {el.name}</dd></div>
          <div><dt>Archetype</dt><dd>The {c.starprint.archetype}</dd></div>
          <div><dt>Birthday</dt><dd>{birthdayText(c.starprint.chosenBirthday)}</dd></div>
        </dl>
      </div>
      {sky && <TodayLine c={c} />}
      {sky
        ? <p className="sl-fine">Born on its birthday at the minute it hatched, under the sky over the Origin Observatory on Mauna Kea. <a className="sl-inlink" href="#/cozmling/sky">Open its birth sky</a>.{starprintDisagrees(c) && <> Its Starprint was chosen before skies were read: on its birth minute the Sun was in {signOf(sky.bodies.sun.sign)}.</>}</p>
        : c.hatch.status === 'egg'
        ? <p className="sl-fine">Its birth sky is read the minute it hatches: its birthday, at that time of day, over the Origin Observatory on Mauna Kea.</p>
        : <p className="sl-fine">Reading the sky it was born under…</p>}
    </div>
  )
}

/** Today's sky in a line, and the way in. Read once a day, when it isn't saved yet: after that it costs nothing. */
function TodayLine({ c }: { c: Companion }) {
  const today = useLiveSky(c, { live: false })
  if (today.status === 'none') return null
  return (
    <p className="sl-today" aria-live="polite">
      <span className="sl-today__k">Today</span>
      {today.report ? <a className="sl-inlink" href="#/cozmling/sky/today">{todayHeadline(today.report, nameOf(c))}</a>
        : today.status === 'offline' ? <span>Today’s sky can’t be read just now.</span>
        : <span>Reading today’s sky…</span>}
    </p>
  )
}

/** A first-version Cozmling says what it is, and that it stays that way. Its sky is read only if its player asks. */
function FirstVersionPanel({ c, pet, hatched, onSay }: { c: LegacyCompanion; pet: Pet; hatched: boolean; onSay: (text: string) => void }) {
  const [busy, setBusy] = useState(false)
  const option = legacySkyOption(c)
  const read = async (choice: 'birth' | 'awakening') => {
    setBusy(true)
    const sky = await loadSkyEngine().catch(() => null)
    const res = sky ? await cozmlingStore()?.update(c.companionId, (cur, now) => sky.readLegacySky(cur, now, playerTimeZone(), choice), { event: { eventId: `sky:${c.companionId}`, type: 'sky-read', data: { kind: choice } } }) : null
    setBusy(false)
    onSay(res?.ok && res.companion.celestial ? `${pet.name}’s sky: ${bigThree(res.companion.celestial)}.` : 'The sky couldn’t be read just now. Try again in a moment.')
  }
  return (
    <div className="panel sl-print">
      <header className="panel__head"><h2>About {pet.name}</h2>{c.celestial && <a className="link" href="#/cozmling/sky">{c.celestial.kind === 'birth' ? 'Birth sky' : 'Its sky'}</a>}</header>
      <dl className="sl-facts sl-facts--wide">
        <div><dt>Kind</dt><dd>First-version Cozmling</dd></div>
        <div><dt>Stage</dt><dd>{STAGE_NAME[legacyStage(c)]}</dd></div>
        <div><dt>Home</dt><dd>{HOMES[pet.home].name}</dd></div>
        <div><dt>Age</dt><dd>{!hatched ? 'Not hatched yet' : c.hatch.provenance === 'legacy-unknown' ? 'Not recorded' : ageText(pet)}</dd></div>
        {c.celestial && <div><dt>{c.celestial.kind === 'birth' ? 'Birth sky' : 'Awakening sky'}</dt><dd>{bigThree(c.celestial)}</dd></div>}
      </dl>
      {c.celestial && <TodayLine c={c} />}
      <p className="sl-fine">{pet.name} keeps the look, home, stage and counts it has always had. Nothing about it was changed by the move here.</p>
      {option === 'birth' && (
        <div className="sl-skyask">
          <p>{pet.name} hatched on {new Date(c.hatch.hatchedAt!).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}. You can read the sky it hatched under, over the Origin Observatory on Mauna Kea. It doesn’t change anything else about {pet.name}.</p>
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void read('birth')}>{busy ? 'Reading…' : `Read ${pet.name}’s sky`}</button>
        </div>
      )}
      {option === 'awakening' && (
        <div className="sl-skyask">
          <p>The moment {pet.name} hatched was never recorded (it was brought back from a wallet note), so its birth sky can’t be known. You can give it an awakening sky instead: the sky at the moment you press the button, always labelled as an awakening, never as its birth.</p>
          <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => void read('awakening')}>{busy ? 'Reading…' : `Give ${pet.name} an awakening sky`}</button>
        </div>
      )}
      {option === 'egg' && <p className="sl-fine">Once {pet.name} hatches, you can read the sky it hatched under.</p>}
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
