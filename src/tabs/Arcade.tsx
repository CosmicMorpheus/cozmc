import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { GAMES } from '../arcade/games'
import type { ArcadeGame, GameHandle, GameHud, TouchButton } from '../arcade/types'
import { plausible } from '../arcade/types'
import { sfx } from '../arcade/sfx'
import { useChain } from '../lib/data'
import { gameBoard } from '../lib/boards'
import { buildScoreGroup, signAndSend } from '../lib/chain'
import { fmt, compact } from '../lib/format'
import { countdown, dailyNo, msToReset, seedFor, utcDay } from '../lib/daily'
import { gameEvent, liveStreak, recordRun, runBadges, setSkin as saveSkin, todaysDaily, unlock, useProfile } from '../lib/profile'
import { TIERS, tierOf } from '../lib/tiers'
import { Addr } from '../components/ui'
import { Icon, TierBadge } from '../components/Pixel'
import { useMe } from '../components/Wallet'
import { ShareBtn } from '../components/Share'
import { scoreShare } from '../lib/sharePayloads'
import { EXPLORER_TX, SCORE_FEE_ALGO } from '../config'
import { GameThumb } from '../components/GameThumb'
import { GiveawayStrip } from '../components/GiveawayStrip'
import { prizeFor, weekOf } from '../lib/giveaway'
import { SocialIcon, socialLinks } from '../components/Community'
import type { RunOutcome } from '../companion/care'

// the Cozmling art loads with its own chunk
const Buddy = lazy(() => import('../companion/Buddy').then(m => ({ default: m.Buddy })))

/** Each finished run cheers up the wallet's Cozmling (a local copy; it's backed up with the next check-in). */
async function cheerCozmling(owner: string, run: { daily: boolean; best: boolean }): Promise<RunOutcome | null> {
  const { load, save, arcadeRun } = await import('../companion/care')
  const pet = load(owner)
  if (!pet) return null
  const out = arcadeRun(pet, run)
  save(owner, out.pet)
  return out
}

export function Arcade({ playing, daily, setPlaying }: { playing: string | null; daily: boolean; setPlaying: (id: string | null, daily?: boolean) => void }) {
  const game = GAMES.find(g => g.id === playing)
  return game ? <Cabinet key={game.id} game={game} daily={daily} onExit={() => setPlaying(null)} /> : <Floor onPlay={setPlaying} />
}

/** Ticks once a minute so countdowns stay honest. */
function useMinute() {
  const [, set] = useState(0)
  useEffect(() => { const t = setInterval(() => set(n => n + 1), 30_000); return () => clearInterval(t) }, [])
}

/* ---------- the arcade floor ---------- */
function Floor({ onPlay }: { onPlay: (id: string, daily?: boolean) => void }) {
  const { scores } = useChain()
  const profile = useProfile()
  useMinute()
  const today = utcDay(), streak = liveStreak(profile)
  const discord = socialLinks()[0]
  return (
    <>
      <header className="page-head">
        <h1>Arcade</h1>
        <p>{GAMES.length} games, all free to play, no wallet needed. Tap a screen to start. Connect a wallet to post your run on-chain and get on the leaderboard.</p>
      </header>
      <section className="daily-strip" aria-label="Daily Challenge">
        <div className="daily-strip__tag">Daily #{dailyNo()}</div>
        <p>Every game has one seeded run today, the same for everyone. Play it as often as you like; your best counts. <span className="muted">Resets in {countdown(msToReset())}.</span></p>
        {streak > 0 && <p className="daily-strip__streak"><b>{streak}</b> day streak</p>}
      </section>
      <GiveawayStrip />
      <div className="cabinets">
        {GAMES.map(g => {
          const top = gameBoard(g, scores.data ?? [])[0]
          const dTop = gameBoard(g, scores.data ?? [], today)[0]
          const mine = todaysDaily(g.id, profile)
          return (
            <article className="cab" key={g.id}>
              <button className="cab__screen" onClick={() => onPlay(g.id)} aria-label={`Play ${g.title}`}>
                <GameThumb game={g} />
                <span className="cab__attract" aria-hidden="true">Press start</span>
              </button>
              <div className="cab__body">
                <h2>{g.title}</h2>
                <p>{g.tagline}</p>
                <dl className="cab__stats">
                  <div><dt>High score</dt><dd>{top ? <><b>{fmt(top.score)}</b> <Addr address={top.player} /></> : 'Nobody yet. Take the crown.'}</dd></div>
                  <div><dt>Today’s daily</dt><dd>{dTop ? <><b>{fmt(dTop.score)}</b> <Addr address={dTop.player} /></> : 'Wide open'}{mine != null && <span className="muted"> · you {fmt(mine)}</span>}</dd></div>
                </dl>
                <div className="row">
                  <button className="btn btn--phos" onClick={() => onPlay(g.id)}><Icon name="play" size={10} /> Free play</button>
                  <button className="btn btn--ghost" onClick={() => onPlay(g.id, true)}>Daily #{dailyNo()}</button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {discord && (
        <aside className="arcade-ask">
          <p><b>Got a game idea?</b> The next cabinet could be yours. Pitch it, playtest with us, or help build it in the Discord.</p>
          <a className="btn btn--discord btn--sm" href={discord.url} target="_blank" rel="noopener"><SocialIcon name="discord" size={14} /> Share it on Discord</a>
        </aside>
      )}
    </>
  )
}

/* ---------- on-screen controls: they press the same keys a keyboard would ---------- */
const KEY: Record<TouchButton, string> = { left: 'ArrowLeft', right: 'ArrowRight', jump: ' ', rotate: 'ArrowUp', down: 'ArrowDown', drop: ' ', hold: 'c', tap: ' ' }
const LABEL: Record<TouchButton, string> = { left: '◀', right: '▶', jump: 'JUMP', rotate: '⟳', down: '▼', drop: 'DROP', hold: 'HOLD', tap: 'TAP' }
function TouchPad({ buttons }: { buttons: TouchButton[] }) {
  const press = (k: string, down: boolean) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true }))
  return (
    <div className="pad" aria-label="Touch controls" style={{ ['--cols' as string]: buttons.length > 4 ? 3 : buttons.length }}>
      {buttons.map(b => (
        <button key={b} className={`pad__btn pad__btn--${b}`} aria-label={b}
          onPointerDown={e => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); press(KEY[b], true) }}
          onPointerUp={() => press(KEY[b], false)} onPointerCancel={() => press(KEY[b], false)} onContextMenu={e => e.preventDefault()}>
          {LABEL[b]}
        </button>
      ))}
    </div>
  )
}

/* ---------- skins, unlocked by holder tier ---------- */
function SkinPicker({ game, current, tierIdx, onPick, disabled }: { game: ArcadeGame; current: string; tierIdx: number; onPick: (id: string) => void; disabled: boolean }) {
  const [hint, setHint] = useState('')
  if (!game.skins?.length) return null
  return (
    <section className="panel skins">
      <header className="panel__head"><h2>Skins</h2><span className="muted small">by holder tier</span></header>
      <div className="skins__grid">
        {game.skins.map(s => {
          const t = TIERS[s.tier], locked = s.tier > tierIdx
          return (
            <button key={s.id} className="skin" aria-pressed={current === s.id} aria-disabled={locked || disabled} disabled={disabled && !locked}
              title={locked ? `Hold ${compact(t.min)}+ COZMC (${t.name}) to unlock` : s.name}
              onClick={() => { if (locked) setHint(`${s.name} unlocks at ${t.name} tier: hold ${compact(t.min)}+ COZMC in a connected wallet.`); else { setHint(''); onPick(s.id) } }}>
              <TierBadge tier={t} size={22} />
              <span>{s.name}</span>
              {locked && <em>{compact(t.min)}+</em>}
            </button>
          )
        })}
      </div>
      {hint && <p className="small muted skins__hint">{hint}</p>}
    </section>
  )
}

/* ---------- a playable cabinet ---------- */
type Post = 'idle' | 'prep' | 'sign' | 'send' | 'done' | 'error'

function Cabinet({ game, daily: startDaily, onExit }: { game: ArcadeGame; daily: boolean; onExit: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const handle = useRef<GameHandle | null>(null)
  const lives = game.maxLives ?? 3
  const [hud, setHud] = useState<GameHud>({ score: 0, lives, level: 1 })
  const overAt = useRef(0)
  const runDay = useRef<number | null>(null)            // set while/after a Daily run
  const [mode, setModeState] = useState<'free' | 'daily'>(startDaily ? 'daily' : 'free')
  const [phase, setPhase] = useState<'ready' | 'play' | 'over'>('ready')
  const [result, setResult] = useState<{ score: number; ms: number; day: number | null } | null>(null)
  const [newBest, setNewBest] = useState<'' | 'best' | 'daily'>('')
  const [muted, setMuted] = useState(sfx.muted)
  const [post, setPost] = useState<Post>('idle')
  const [postErr, setPostErr] = useState('')
  const [postTx, setPostTx] = useState('')
  const [postBurn, setPostBurn] = useState(0)
  const [cheer, setCheer] = useState<RunOutcome | null>(null)
  const { scores, reload } = useChain()
  const { activeAddress, algodClient, signTransactions } = useWallet()
  const { openConnect, holding } = useMe()
  const owner = useRef(activeAddress)
  owner.current = activeAddress
  const profile = useProfile()
  useMinute()

  const today = utcDay()
  const boardDay = result?.day ?? (mode === 'daily' ? today : null)
  const board = gameBoard(game, scores.data ?? [], boardDay ?? undefined)
  const best = mode === 'daily' ? todaysDaily(game.id, profile) ?? 0 : profile.best[game.id] ?? 0

  // skins: the saved choice, if the wallet's tier still unlocks it
  const tierIdx = activeAddress ? TIERS.indexOf(tierOf(holding ?? 0)) : 0
  const skins = game.skins ?? []
  const saved = profile.skins[game.id]
  const skin = skins.find(s => s.id === saved && s.tier <= tierIdx)?.id ?? skins[0]?.id ?? 'classic'

  useEffect(() => {
    let last = 0
    const h = game.create(canvas.current!, {
      onHud(next) { const now = performance.now(); if (now - last > 80) { last = now; setHud(next) } },
      onEvent(type, v) { gameEvent(type, v) },
      onOver(r) {
        overAt.current = performance.now()
        const day = runDay.current
        const rec = recordRun(game.id, r.score, day)
        runBadges(day != null, rec.streak)
        setNewBest(day != null ? (rec.newDailyBest ? 'daily' : '') : rec.newBest ? 'best' : '')
        if (owner.current && r.score > 0 && r.ms >= 5000) cheerCozmling(owner.current, { daily: day != null, best: day != null ? rec.newDailyBest : rec.newBest }).then(setCheer, () => {})
        setResult({ ...r, day }); setPhase('over'); setPost('idle'); setPostErr(''); setHud(h => ({ ...h, score: r.score, lives: 0 }))
      },
    }, { skin })
    handle.current = h
    document.fonts.load('700 8px Silkscreen').then(() => { if (handle.current === h) h.setSkin?.(skin) }, () => {})   // repaint the idle screen in the pixel font
    return () => h.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game])
  useEffect(() => { handle.current?.setSkin?.(skin) }, [skin])

  const setMode = (m: 'free' | 'daily') => {
    setModeState(m); setResult(null); setPhase('ready')
    history.replaceState(null, '', `#/arcade/${game.id}${m === 'daily' ? '/daily' : ''}`)
  }
  const start = () => {
    const day = utcDay()
    runDay.current = mode === 'daily' ? day : null
    setPhase('play'); setResult(null); setNewBest(''); canvas.current?.focus()
    handle.current?.start(mode === 'daily' ? { seed: seedFor(game.id, day) } : undefined)
  }
  useEffect(() => {
    // Enter/Space starts a run, but not in the first moment after dying (mashing jump shouldn't restart)
    const k = (e: KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && phase !== 'play' && performance.now() - overAt.current > 900 && (e.target as HTMLElement)?.tagName !== 'BUTTON') { e.preventDefault(); start() } }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  })

  async function postScore() {
    if (!result || !activeAddress) return
    setPost('prep'); setPostErr('')
    try {
      // one signature: 0.1 ALGO buys COZMC on Pact and the same group burns it (see buildScoreGroup)
      const g = await buildScoreGroup(algodClient, activeAddress, game.id, result.score, result.ms, result.day ?? undefined)
      setPost('sign')
      await signAndSend(algodClient, async t => { const r = await signTransactions(t); setPost('send'); return r }, g.txns)
      setPostTx(g.scoreTxId); setPostBurn(g.burn); setPost('done'); sfx.level(); unlock('posted'); unlock('burner')
      setTimeout(() => { reload('scores'); reload('burns') }, 2500)
    } catch (e: any) {
      const m = String(e?.message ?? e)
      setPostErr(/reject|cancel|closed|denied/i.test(m) ? 'Signature cancelled. Nothing was posted or spent.' : /overspend|below min/i.test(m) ? `This wallet needs a little more ALGO: ${SCORE_FEE_ALGO} to burn plus about 0.01 in fees.` : m.slice(0, 220))
      setPost('error')
    }
  }

  const rankIfPosted = result ? board.filter(r => r.score > result.score && r.player !== activeAddress).length + 1 : 0
  const ok = result ? plausible(game, result.score, result.ms) : false
  const dayNo = dailyNo(boardDay ?? today)
  const where = result?.day != null ? 'today’s daily board' : 'the board'

  return (
    <div className="cabinet">
      <div className="cabinet__bar">
        <button className="btn btn--sm btn--ghost" onClick={onExit}>← Arcade</button>
        <h1 className="cabinet__title">{game.title}</h1>
        <button className="btn btn--sm btn--ghost" onClick={() => { setMuted(!muted); handle.current?.setMuted(!muted) }} aria-pressed={!muted}>{muted ? 'Sound off' : 'Sound on'}</button>
      </div>

      <div className="cabinet__mode">
        <div className="seg seg--tight" role="tablist" aria-label="Mode">
          <button role="tab" aria-selected={mode === 'free'} disabled={phase === 'play'} onClick={() => setMode('free')}>Free play</button>
          <button role="tab" className="is-daily" aria-selected={mode === 'daily'} disabled={phase === 'play'} onClick={() => setMode('daily')}>Daily #{dailyNo()}</button>
        </div>
        <p className="small muted">{mode === 'daily'
          ? <>Same run for everyone today. Resets in {countdown(msToReset())}.{liveStreak(profile) > 0 && <> Streak <b className="phos">{liveStreak(profile)}</b>.</>}</>
          : 'A fresh random run every time.'}</p>
      </div>

      <div className="cabinet__grid">
        <div className="cabinet__play">
          <div className="hud" aria-live="off">
            <span>Score <b>{String(hud.score).padStart(6, '0')}</b></span>
            {lives > 0 && <span className="hud__lives" aria-label={`${hud.lives} of ${lives} lives`}>{Array.from({ length: lives }, (_, i) => <span key={i} className={i < hud.lives ? 'on' : ''}><Icon name="heart" size={12} /></span>)}</span>}
            <span>{game.levelLabel ?? 'Lvl'} <b>{hud.level}</b></span>
            <span className="hide-sm">{mode === 'daily' ? 'Today' : 'Best'} <b>{fmt(best)}</b></span>
          </div>
          <div className="screen crt">
            <canvas ref={canvas} tabIndex={0} aria-label={`${game.title} game screen`} />
            {phase === 'ready' && (
              <div className="screen__overlay">
                {mode === 'daily' && <p className="screen__tag">Daily #{dailyNo()}</p>}
                <p className="screen__big blink-slow">Press start</p>
                <button className="btn btn--phos" onClick={start}>Start</button>
                <ul className="screen__controls">{game.controls.map(c => <li key={c}>{c}</li>)}</ul>
              </div>
            )}
            {phase === 'over' && result && (
              <div className="screen__overlay screen__overlay--over">
                {result.day != null && <p className="screen__tag">Daily #{dailyNo(result.day)}</p>}
                <p className="screen__big">Game over</p>
                <p className="screen__score">{fmt(result.score)}{newBest && <span className="screen__new">{newBest === 'daily' ? 'Today’s best' : 'New best'}</span>}</p>
                {!ok ? (
                  <p className="state state--err">That run is outside this game’s limits, so it can’t be posted.</p>
                ) : !activeAddress ? (
                  <button className="btn btn--phos" onClick={openConnect}>Connect to post score</button>
                ) : post === 'done' ? (
                  <p className="state state--ok">Posted. You’re #{rankIfPosted} on {where}, your post burned {fmt(postBurn)} COZMC, and you have +1 <a href="#/arcade/giveaway">giveaway ticket</a>. <a href={EXPLORER_TX(postTx)} target="_blank" rel="noopener">View ↗</a></p>
                ) : post === 'prep' ? <p className="state state--load"><span className="blink">▮</span> Getting a price from Pact…</p>
                  : post === 'sign' ? <p className="state state--load"><span className="blink">▮</span> Approve in your wallet…</p>
                  : post === 'send' ? <p className="state state--load"><span className="blink">▮</span> Buying, burning and posting…</p>
                  : (
                    <>
                      <button className="btn btn--fire" onClick={postScore}>Post score · {SCORE_FEE_ALGO} ALGO</button>
                      <p className="screen__fine">Would rank #{rankIfPosted} on {where}. Your {SCORE_FEE_ALGO} ALGO buys COZMC on Pact and burns it in the Bonfire, all in one signature. It also earns you a ticket in this week’s {compact(prizeFor(Math.max(1, weekOf())))} COZMC giveaway.</p>
                    </>
                  )}
                {post === 'error' && <p className="state state--err">{postErr}</p>}
                <div className="row row--center">
                  <button className="btn btn--ghost" onClick={start}>Play again</button>
                  <ShareBtn label="Share score" className="btn btn--ghost" make={() => {
                    const shot = document.createElement('canvas'), src = canvas.current!
                    shot.width = src.width; shot.height = src.height; shot.getContext('2d')!.drawImage(src, 0, 0)
                    return scoreShare({ game, score: result.score, player: activeAddress, mine: true, newBest: !!newBest, rank: ok ? rankIfPosted : undefined, verified: post === 'done', shot, daily: result.day != null ? dailyNo(result.day) : undefined })
                  }} />
                </div>
              </div>
            )}
          </div>
          {game.touch && <TouchPad buttons={game.touch} />}
        </div>

        <div className="cabinet__side">
          <aside className="panel cabinet__board">
            <header className="panel__head"><h2>{boardDay != null ? `Daily #${dayNo} top 3` : 'Top 3'}</h2><a className="link" href="#/arcade/boards">Full board</a></header>
            {board.length ? (
              <ol className="mini-board">
                {board.slice(0, 3).map((r, i) => <li key={r.player} className={r.player === activeAddress ? 'me' : ''}><span className="mb__rank">{i + 1}</span><Addr address={r.player} you={r.player === activeAddress} /><span className="mb__score">{fmt(r.score)}</span></li>)}
              </ol>
            ) : <p className="muted small">{boardDay != null ? 'Nobody’s posted today’s run yet. First on the board wins the morning.' : 'Nobody’s on the board yet.'}</p>}
          </aside>
          <Suspense fallback={null}><Buddy owner={activeAddress ?? null} last={cheer} onConnect={openConnect} /></Suspense>
          <SkinPicker game={game} current={skin} tierIdx={tierIdx} disabled={phase === 'play'} onPick={id => saveSkin(game.id, id)} />
        </div>
      </div>
    </div>
  )
}
