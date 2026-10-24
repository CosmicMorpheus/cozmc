import type { SharePayload } from './share'
import type { ArcadeGame } from '../arcade/types'
import type { Wisdom } from '../data/quotes'
import { byline } from '../data/quotes'
import { compact, fmt, short } from './format'
import { nfdName } from './nfd'
import { SITE_URL } from '../config'
import type { Tier } from './tiers'

/** X counts any link as 23 characters. */
const xLen = (s: string) => s.replace(/https?:\/\/\S+/g, 'x'.repeat(23)).length
const who = (addr?: string | null) => (addr ? nfdName(addr) ?? short(addr, 5) : null)

export function scoreShare(o: { game: ArcadeGame; score: number; player?: string | null; mine: boolean; rank?: number; verified?: boolean; newBest?: boolean; shot?: CanvasImageSource | null; daily?: number }): SharePayload {
  const url = `${SITE_URL}/#/arcade/${o.game.id}${o.daily ? '/daily' : ''}`
  const name = who(o.player)
  const n = fmt(o.score)
  if (o.daily) {
    const text = o.mine
      ? `COZMC Daily #${o.daily} 👾 ${n} on ${o.game.title}${o.rank && o.verified ? ` (#${o.rank} today)` : ''}.\n\nSame run for everyone today. Beat me:\n${url}\n\n$COZMC #Algorand`
      : `${name} is #${o.rank} in COZMC Daily #${o.daily} with ${n} on ${o.game.title} 👾\n\nSame run for everyone today. Can you beat it?\n${url}\n\n$COZMC #Algorand`
    return {
      card: {
        kind: 'score', score: o.score, game: o.game.title, verified: o.verified, shot: o.shot, kicker: `COZMC Daily #${o.daily}`,
        cta: o.mine ? 'Same run. Beat me.' : 'Same run. Beat it.',
        byline: [name, o.rank ? `#${o.rank} today` : null].filter(Boolean).join('  ·  ') || undefined,
      },
      text, file: `cozmc-daily-${o.daily}-${o.game.id}-${o.score}.png`,
    }
  }
  const card = o.mine
    ? {
        kicker: o.rank && o.verified ? `I’m #${o.rank} on the board` : o.newBest ? 'New personal best' : 'I just scored',
        cta: 'Can you beat me?',
        byline: [name, o.rank && !o.verified ? `would rank #${o.rank}` : null].filter(Boolean).join('  ·  ') || undefined,
      }
    : { kicker: `#${o.rank} on the board`, cta: 'Can you beat it?', byline: name ? `held by ${name}` : undefined }
  const text = o.mine
    ? `I just scored ${n} on ${o.game.title} in the COZMC arcade 👾 Can you beat me?\n\n${url}\n\n$COZMC #Algorand`
    : `${name} holds #${o.rank} on ${o.game.title} with ${n} 👾 Can you beat it?\n\n${url}\n\n$COZMC #Algorand`
  return { card: { kind: 'score', score: o.score, game: o.game.title, verified: o.verified, shot: o.shot, ...card }, text, file: `cozmc-${o.game.id}-${o.score}.png` }
}

export function burnShare(o: { amount: number; wish?: string; burner?: string | null; mine: boolean; rank?: number }): SharePayload {
  const amt = compact(o.amount)
  const name = who(o.burner)
  const wish = o.wish?.trim()
  let text = o.mine
    ? `I just burned ${amt} $COZMC in the Bonfire 🔥${wish ? `\n\n“${wish}”` : ''}\n\nLight it yourself: ${SITE_URL}`
    : `${name} has burned ${amt} $COZMC in the Bonfire 🔥 #${o.rank} on the board.\n\n${SITE_URL}/#/community/bonfire`
  if (xLen(text) > 280) text = `I just burned ${amt} $COZMC in the Bonfire 🔥\n\n${SITE_URL}`
  return {
    card: { kind: 'burn', kicker: o.mine ? 'I just burned' : `#${o.rank} burner`, amount: amt, wish, byline: o.mine ? undefined : name ? `BURNED BY ${name.toUpperCase()}` : undefined },
    text, file: `cozmc-bonfire-${amt}.png`,
  }
}

export function quoteShare(w: Wisdom): SharePayload {
  const url = `${SITE_URL}/#/community/wisdom`
  let text = `“${w.t}”\n— ${w.a}\n\nDaily wisdom from COZMC ✦ ${url}`
  if (xLen(text) > 280) text = `“${w.t}” — ${w.a}\n\n${url}`
  if (xLen(text) > 280) text = `“${w.t.slice(0, 280 - 23 - w.a.length - 12).trim()}…” — ${w.a}\n\n${url}`
  return { card: { kind: 'quote', t: w.t, a: w.a, src: byline(w) || undefined, ctx: w.ctx }, text, file: `cozmc-wisdom.png` }
}

export function playerShare(o: { name: string; tier: Tier; tierNo: number; stats: [string, string][]; badges: number; total: number; kinds: string[]; streak: number }): SharePayload {
  const url = `${SITE_URL}/#/arcade/card`
  const bits = [`${o.tier.name} tier`, `${o.badges}/${o.total} badges`, o.streak > 1 ? `${o.streak}-day daily streak` : null].filter(Boolean).join(', ')
  return {
    card: { kind: 'player', name: o.name, tier: o.tier, tierNo: o.tierNo, stats: o.stats, badges: o.badges, total: o.total, kinds: o.kinds },
    text: `My COZMC player card 👾 ${bits}.\n\nGet yours: ${url}\n\n$COZMC #Algorand`,
    file: `cozmc-card-${o.tier.id}.png`,
  }
}
