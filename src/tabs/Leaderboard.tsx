import { useState } from 'react'
import { useWallet } from '@txnlab/use-wallet-react'
import { GAMES } from '../arcade/games'
import { useChain } from '../lib/data'
import { burnerBoard, gameBoard, rankLabel } from '../lib/boards'
import { ago, compact, fmt } from '../lib/format'
import { Addr, Failed, Loading } from '../components/ui'
import { Flame, TierBadge } from '../components/Pixel'
import { tierOf } from '../lib/tiers'
import { EXPLORER_TX } from '../config'
import { countdown, dailyNo, msToReset, utcDay } from '../lib/daily'
import type { TabId } from '../App'
import { ShareBtn } from '../components/Share'
import { burnShare, scoreShare } from '../lib/sharePayloads'

export function Leaderboard({ go, onBurn }: { go: (t: TabId, sub?: string) => void; onBurn: () => void }) {
  const [board, setBoard] = useState<string>(GAMES[0].id)
  const [span, setSpan] = useState<'all' | 'today'>('all')
  const { scores, burns, holders, reload } = useChain()
  const { activeAddress } = useWallet()
  const bal = new Map((holders.data ?? []).map(h => [h.address, h.amount]))
  const tier = (a: string) => { const b = bal.get(a); return b ? <TierBadge tier={tierOf(b)} size={14} /> : null }

  return (
    <>
      <header className="page-head">
        <h1>Leaderboards</h1>
        <p>Every run and every burn here lives on Algorand. Each wallet’s best run counts.</p>
      </header>

      <div className="seg" role="tablist" aria-label="Board">
        {GAMES.map(g => <button key={g.id} role="tab" aria-selected={board === g.id} onClick={() => setBoard(g.id)}>{g.title}</button>)}
        <button role="tab" aria-selected={board === 'burners'} onClick={() => setBoard('burners')}><Flame size={12} /> Top burners</button>
      </div>

      {board !== 'burners' && (
        <div className="span-row">
          <div className="seg seg--tight" role="tablist" aria-label="Time span">
            <button role="tab" aria-selected={span === 'all'} onClick={() => setSpan('all')}>All-time</button>
            <button role="tab" className="is-daily" aria-selected={span === 'today'} onClick={() => setSpan('today')}>Daily #{dailyNo()}</button>
          </div>
          {span === 'today' && <p className="small muted">Today’s seeded run only. Resets in {countdown(msToReset())}.</p>}
        </div>
      )}

      {board === 'burners' ? (
        burns.error && !burns.data ? <Failed what="burns" retry={() => reload('burns')} /> :
        !burns.data ? <Loading what="the Bonfire" /> : (() => {
          const rows = burnerBoard(burns.data)
          return rows.length ? (
            <div className="board-wrap"><table className="board">
              <thead><tr><th>Rank</th><th>Burner</th><th className="num">Burned</th><th className="num hide-sm">Burns</th><th className="hide-sm">Latest wish</th><th className="share-col"><span className="sr-only">Share</span></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.sender} className={`${i < 3 ? `podium p${i + 1}` : ''}${r.sender === activeAddress ? ' me' : ''}`}>
                    <td className="rank">{rankLabel(i)}</td>
                    <td><span className="who">{tier(r.sender)}<Addr address={r.sender} you={r.sender === activeAddress} /></span></td>
                    <td className="num fire">{fmt(r.total)}</td>
                    <td className="num hide-sm">{r.count}</td>
                    <td className="hide-sm wish">{r.lastWish ? <a href={EXPLORER_TX(r.lastTx)} target="_blank" rel="noopener">“{r.lastWish}”</a> : <span className="muted">—</span>}</td>
                    <td className="share-col"><ShareBtn label="" className="icon-btn" make={() => burnShare({ amount: r.total, wish: r.lastWish, burner: r.sender, mine: r.sender === activeAddress, rank: i + 1 })} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : <div className="empty"><p>No one has burned COZMC yet. The first burner tops this board.</p><button className="btn btn--fire btn--sm" onClick={onBurn}>Burn COZMC</button></div>
        })()
      ) : (
        scores.error && !scores.data ? <Failed what="scores" retry={() => reload('scores')} /> :
        !scores.data ? <Loading what="scores" /> : (() => {
          const game = GAMES.find(g => g.id === board)!
          const today = span === 'today' ? utcDay() : undefined
          const rows = gameBoard(game, scores.data, today)
          return rows.length ? (
            <div className="board-wrap"><table className="board">
              <thead><tr><th>Rank</th><th>Player</th><th className="num">Score</th><th className="num hide-sm">Runs</th><th className="hide-sm">When</th><th className="share-col"><span className="sr-only">Share</span></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.player} className={`${i < 3 ? `podium p${i + 1}` : ''}${r.player === activeAddress ? ' me' : ''}`}>
                    <td className="rank">{rankLabel(i)}</td>
                    <td><span className="who">{tier(r.player)}<Addr address={r.player} you={r.player === activeAddress} /></span></td>
                    <td className="num score"><a href={EXPLORER_TX(r.txid)} target="_blank" rel="noopener">{fmt(r.score)}</a></td>
                    <td className="num hide-sm">{r.runs}</td>
                    <td className="hide-sm muted">{ago(r.time)}</td>
                    <td className="share-col"><ShareBtn label="" className="icon-btn" make={() => scoreShare({ game, score: r.score, player: r.player, mine: r.player === activeAddress, rank: i + 1, verified: true, daily: today != null ? dailyNo(today) : undefined })} /></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          ) : today != null
            ? <div className="empty"><p>Nobody has posted today’s {game.title} run yet. First on the board wins the morning.</p><button className="btn btn--phos btn--sm" onClick={() => go('arcade', `${game.id}/daily`)}>Play Daily #{dailyNo()}</button></div>
            : <div className="empty"><p>No {game.title} scores on-chain yet. Post the first run and it’s yours.</p><button className="btn btn--phos btn--sm" onClick={() => go('arcade', game.id)}>Play {game.title}</button></div>
        })()
      )}
      <p className="fineprint">Each posted score paid 0.1 ALGO that bought COZMC on Pact and burned it, all in one signed group; runs outside a game’s limits are ignored. Burns are COZMC transfers to the Bonfire, totalled per wallet ({compact((burns.data ?? []).reduce((s, b) => s + b.amount, 0))} so far).</p>
    </>
  )
}
