/* ============================================================
   CozmlingDailyStoryEngine: a Cozmling's story for one day.

   In:  the narrative context (context.ts: the day, its home, growth stage, Food, Fun, Energy, sleep,
        what you have done together, milestones, its story so far, its voice and its birth chart)
        and the day's theme (source.ts).
   Out: a title, the day's theme in three words, a short original story with one line in the
        Cozmling's own voice, an invitation, a reflection, today's sky reading beside it, and where it
        all came from.

   The story, its invitation and its reflection come from the day, its growth stage, its story so far
   and how it is doing: the same for every Starprint and every chart. Its Starprint gives it its
   voice (voices.ts), and its chart gives the sky reading shown beside the story; neither chooses
   anything. Deterministic templates (themes.ts), no AI service, no paid feed, nothing sent anywhere.
   A story is written once a day and kept (useDailyStory.ts), so a refresh never changes it.
   A story never changes needs, rewards, scores or tokens.
   ============================================================ */
import { STAGE_NAME, type Stage } from '../../companion/look'
import { skyNotes, transitReading, transitTitle } from '../celestial/interpret'
import { signInfo } from '../domain/starprint'
import type { Counters, NarrativeContext } from './context'
import type { DailyTheme, SourceInfo } from './source'
import { AS_THE_SKY_SAYS, ASLEEP_SETUP, CLOSINGS, CONDITION, HOME_NAME, INVITATION_TEXT, MOMENT_BY_KIND, MOMENT_SETUP, OPENINGS, PHASE_PHRASE, PROPS, THEMES, type DayKind, type InvitationAction } from './themes'
import { voiceLine, type VoiceMoment } from './voices'

/** 2: the story is chosen from the day, growth stage and story history, never the sign or chart; the Starprint gives one line of voice. */
export const STORY_ENGINE = { name: 'cozmc-story', version: 2 } as const

export interface DailyStory {
  /** 1: written before November 2026, when the day's sky chose the story; still shown as it was written */
  schema: 1 | 2
  companionId: string
  day: string
  timeZone: string
  title: string
  theme: [string, string, string]
  kind: DayKind
  /** today's strongest transit (or, on a quiet day, the Moon), and what it might mean */
  influence: { title: string; lines: string[] }
  /** the story itself: the same for every Starprint and chart on the same day, at the same stage, with the same story history */
  story: string[]
  /** schema 2: the moment the story pauses on, and the Cozmling's own line for it (its Starprint's voice), shown after the first paragraph */
  moment?: VoiceMoment
  voice?: { archetype: string; line: string } | null
  invitation: { action: InvitationAction; text: string }
  reflection: string
  /** how it was doing when the story was written (and what had been done together by then) */
  snapshot: { at: number; food: number; fun: number; energy: number; asleep: boolean; stage: Stage; counters: Counters }
  source: SourceInfo
  basis: { reportDay: string; natalMoment: number; transit: string | null; engine: { name: string; version: number } }
  writtenAt: number
}

/** The one event a day's story is kept under: a refresh, a second tab or a second try finds it instead of writing another. */
export const storyEventId = (companionId: string, day: string) => `story:${companionId}:${day}`

/** A steady choice: the same day, growth stage, story history and purpose always pick the same line, for every Cozmling. */
function pick<T>(list: readonly T[], ctx: NarrativeContext, salt: string): T {
  let h = 2166136261
  for (const ch of `${ctx.seed}|${salt}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return list[h % list.length]
}

/** The moment the day pauses on: asleep it is resting; just hatched, everything is new; otherwise the day's kind decides. */
export function momentFor(ctx: Pick<NarrativeContext, 'condition' | 'relationship'>, kind: DayKind): VoiceMoment {
  if (ctx.condition.asleep) return 'resting'
  if (ctx.relationship.hatchedToday) return 'noticing'
  return MOMENT_BY_KIND[kind]
}
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '')
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const listing = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** What to invite the player to do: whatever it needs most first, then something in keeping with the day. */
function chooseInvitation(ctx: NarrativeContext, kind: DayKind): InvitationAction {
  const c = ctx.condition, arcade = ctx.kind === 'legacy'           // arcade runs count only for a first-version Cozmling, for now
  const fromTheme = (allowed: InvitationAction[]) => {
    const options = THEMES[kind].invite.filter(a => allowed.includes(a))
    return options.length ? pick(options, ctx, 'invite') : 'pat'
  }
  if (c.asleep) {
    if (Math.min(c.food, c.fun) < 55) return c.food <= c.fun ? 'feed' : 'play'
    return fromTheme(['feed', 'play', 'pat', ...(arcade ? ['arcade' as const] : []), 'observatory'])
  }
  if (c.need === 'food') return 'feed'
  if (c.need === 'fun') return arcade && THEMES[kind].invite.includes('arcade') ? 'arcade' : 'play'
  if (c.need === 'energy') return 'rest'
  return fromTheme(['feed', 'play', 'pat', 'rest', ...(arcade ? ['arcade' as const] : []), 'observatory'])
}

/** A short paragraph about what you have done together lately, and any milestone. */
function together(ctx: NarrativeContext): string[] {
  const r = ctx.relationship, out: string[] = []
  if (r.hatchedToday) out.push('It’s only just hatched, so everything is new.')
  if (ctx.milestones.birthday) out.push('And today is its birthday!')
  if (r.daysAway != null && r.daysAway >= 2) out.push(`It has been ${r.daysAway} days since you last looked after it. It kept watch over ${HOME_NAME[ctx.home]}, and it noticed the moment you came back.`)
  const s = r.sinceLastStory
  if (s) {
    const done = [s.fed && plural(s.fed, 'meal', 'meals'), s.played && plural(s.played, 'game of star ball', 'games of star ball'), s.pets && plural(s.pets, 'pat', 'pats'), s.arcade && plural(s.arcade, 'arcade run', 'arcade runs')].filter(Boolean) as string[]
    if (done.length) out.push(`Since its last story, you’ve shared ${listing(done)}.`)
  }
  if (r.careDaysThisWeek >= 5) out.push(`You’ve looked after it on ${r.careDaysThisWeek} of the last seven days, and it shows.`)
  const next = ctx.milestones.next
  if (next && next.pointsToGo > 0 && next.pointsToGo <= 10 && !r.hatchedToday) out.push(`It’s only ${plural(next.pointsToGo, 'point', 'points')} from becoming a ${STAGE_NAME[next.stage]}.`)
  return out.slice(0, 2)
}

/** Today's story for this Cozmling. */
export function writeDailyStory(ctx: NarrativeContext, theme: DailyTheme, now: number): DailyStory {
  const kind = theme.kind, bank = THEMES[kind], name = ctx.name, home = HOME_NAME[ctx.home]
  const v = { name, home, phase: PHASE_PHRASE[ctx.sky.moonPhase], prop: pick(PROPS[ctx.home], ctx, 'prop') }
  const cond = ctx.condition, h = ctx.hour
  const when = ctx.relationship.hatchedToday ? 'hatched' : cond.asleep ? 'asleep' : h >= 5 && h < 12 ? 'morning' : h < 18 && h >= 12 ? 'afternoon' : h >= 18 && h < 23 ? 'evening' : 'night'
  // its life stage, in the first line: "Orbi the Sprout wakes…"
  const opening = fill(pick(OPENINGS[when], ctx, 'open'), { ...v, name: `${name} the ${STAGE_NAME[ctx.stage]}` })
  let tendency = fill(pick(bank.tendencies, ctx, 'tend'), v)
  if (cond.asleep && kind !== 'quiet') tendency = `In its dreams, ${tendency[0].toLowerCase()}${tendency.slice(1)}`

  // the moment the day pauses on (the same for everyone), then the Cozmling's own line for it (its Starprint's voice)
  const moment = momentFor(ctx, kind)
  const setup = cond.asleep ? ASLEEP_SETUP : MOMENT_SETUP[moment]
  const line = voiceLine(ctx.voice, moment)

  // how it is doing: its happiness and sustenance every day, by the same numbers as its meters
  const stats = `Its happiness is at ${cond.fun}%, and its sustenance is at ${cond.food}%.`
  const condition = cond.asleep
    ? [cond.energy >= 99 ? 'Its energy is back to 100%.' : `Its energy is at ${cond.energy}%, and it’s resting it back up.`, stats,
       Math.min(cond.food, cond.fun) < 55 ? (cond.food <= cond.fun ? 'It may wake up hungry.' : 'It may wake up wanting to play.') : cond.energy >= 99 ? 'It’s fully rested, whenever you want to say good morning.' : '']
    : [stats, cond.need ? CONDITION[cond.need][cond.mood === 'low' ? 'low' : 'good'] : pick(CONDITION.great, ctx, 'great')]

  const action = chooseInvitation(ctx, kind)
  // today's sky reading, beside the story: its chart's strongest transit, and one way it might read (never the story's choice)
  const t = theme.transit, tz = ctx.timeZone
  const influence = t
    ? { title: transitTitle(t, name), lines: [theme.mood ? pick(AS_THE_SKY_SAYS[theme.mood], ctx, 'feel') : null, transitReading(t, name, tz).lines[1]].filter((x): x is string => !!x) }
    : { title: `The Moon in ${signInfo(ctx.sky.moonSign).name}`, lines: [skyNotes(ctx.sky.report, name)[0]] }

  return {
    schema: 2, companionId: ctx.companionId, day: ctx.day, timeZone: tz,
    title: theme.title ?? pick(bank.titles, ctx, 'title'),
    theme: theme.words ?? bank.words,
    kind,
    influence,
    story: [
      `${opening} ${tendency} ${setup}`,
      condition.filter(Boolean).join(' '),
      [...together(ctx), pick(CLOSINGS, ctx, 'close')].join(' '),
    ],
    moment,
    voice: line && ctx.voice ? { archetype: ctx.voice, line } : null,
    invitation: { action, text: INVITATION_TEXT[action](name) },
    reflection: pick(bank.reflections, ctx, 'reflect'),
    snapshot: { at: now, food: cond.food, fun: cond.fun, energy: cond.energy, asleep: cond.asleep, stage: ctx.stage, counters: ctx.counters },
    source: theme.source,
    basis: { reportDay: ctx.sky.report.day, natalMoment: ctx.natal.moment.ms, transit: t ? `${t.a}-${t.kind}-${t.b}` : null, engine: { ...STORY_ENGINE } },
    writtenAt: now,
  }
}

/** Has today's invitation been taken up since the story was written? (Seen from what has happened: no reward is attached.) */
export function invitationDone(s: DailyStory, now: { counters: Counters; energy: number; asleep: boolean }, skyVisit: string | null): boolean {
  const was = s.snapshot.counters, c = now.counters
  switch (s.invitation.action) {
    case 'feed': return c.fed > was.fed
    case 'play': return c.played > was.played
    case 'pat': return c.pets > was.pets
    case 'arcade': return c.arcade > was.arcade
    case 'rest': return now.asleep || now.energy > s.snapshot.energy + 2
    case 'observatory': return skyVisit === s.day
  }
}

/** A saved story, if it is one this engine can show. */
export function asStory(data: unknown): DailyStory | null {
  const s = data as DailyStory | null
  return s && (s.schema === 1 || s.schema === 2) && typeof s.title === 'string' && Array.isArray(s.story) && !!s.invitation && !!s.snapshot ? s : null
}
