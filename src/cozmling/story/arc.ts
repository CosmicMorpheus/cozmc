/* ============================================================
   STORY MODE ARCS: authored scenes that open for a reason, and a small director that picks today's.

   An arc is a story told over several visits, one a story day. Each scene says when it may come
   next (from the saved world only), what it says (which can depend on what characters know, what is
   where, and how long you have been away), the choices it offers, and their effects. The director
   picks the visit for a story day:
     1. if a choice was already made today, what followed it, until the next story day;
     2. an arc under way whose next scene is due, the one with something new to see first (a promise
        kept since the last visit);
     3. a new arc whose growth stage the Cozmling has reached;
     4. otherwise a word about the stage the next story is waiting for, or a quiet day.
   Its inputs are the world, the story day and the growth stage: never the sign, the chart or notes.
   The Starprint only fills in the voice lines a scene leaves room for.
   ============================================================ */
import { STAGES, type Stage } from '../../companion/look'
import { daysBetween, storyModeEventId, type ArcState, type Effect, type StoryModeData, type World } from './world'
import { voiceLine, type Archetype, type VoiceMoment } from './voices'
import type { JourneyEvent } from '../types'

/** A line of a scene: words, or a place for the Cozmling's own voice at a moment. */
export type Line = string | { voice: VoiceMoment }
export interface SceneCtx {
  world: World
  /** this arc's state, or null before it has begun */
  arc: ArcState | null
  day: string
  /** whole story days since the last visit to this arc (null on the first) */
  away: number | null
}
export interface SceneChoice {
  id: string
  label: string
  effects: (c: SceneCtx) => Effect[]
  /** what follows, in the story's own words ({name} is the Cozmling's name) */
  outcome: (c: SceneCtx) => string[]
}
export interface ArcScene {
  id: string
  /** may this be the arc's next scene? (`arc` is null when the arc hasn't begun) */
  when: (arc: ArcState | null, w: World) => boolean
  lines: (c: SceneCtx) => Line[]
  prompt: string
  choices: (c: SceneCtx) => SceneChoice[]
  /** the arc ends with this scene */
  last?: true
}
export interface Arc {
  id: string
  version: string
  /** a draft is shown only on the preview site and in local work */
  status: 'draft' | 'approved'
  title: string
  /** the growth stage a Cozmling must have reached for the arc to begin */
  minStage: Stage
  visits: number
  scenes: ArcScene[]
  /** what is drawn beside the words: worked out from the world and the day only */
  picture: (c: SceneCtx) => Record<string, string>
  /** said after every choice: a natural place to stop */
  stop: string
  /** said when the arc is over */
  closing: string
}

export interface Paragraph { text: string; voice?: true }
export interface Rendered { paragraphs: Paragraph[]; prompt: string; choices: { id: string; label: string }[]; picture: Record<string, string> }

const fill = (s: string, name: string) => s.replace(/\{name\}/g, name)

/** A scene as this Cozmling sees it. Only the paragraphs marked `voice` depend on its Starprint. */
export function render(arc: Arc, scene: ArcScene, c: SceneCtx, who: { name: string; archetype: Archetype | null }): Rendered {
  const paragraphs = scene.lines(c).flatMap((l): Paragraph[] => {
    if (typeof l === 'string') return [{ text: fill(l, who.name) }]
    const v = voiceLine(who.archetype, l.voice)
    return v ? [{ text: v, voice: true }] : []
  })
  return { paragraphs, prompt: scene.prompt, choices: scene.choices(c).map(ch => ({ id: ch.id, label: fill(ch.label, who.name) })), picture: arc.picture(c) }
}

export type Visit =
  | { kind: 'scene'; arc: Arc; scene: ArcScene; ctx: SceneCtx; number: number }
  | { kind: 'today'; arc: Arc; ctx: SceneCtx; last: StoryModeData }
  | { kind: 'waiting'; arc: Arc; stage: Stage }
  | { kind: 'quiet'; finished: Arc[] }

export const stageReached = (stage: Stage, min: Stage) => STAGES.indexOf(stage) >= STAGES.indexOf(min)
const lastDay = (a: ArcState | undefined) => a?.visits[a.visits.length - 1]?.day ?? null
/** Something new to see at this arc since the last visit: a promise to it, kept after that visit. */
const news = (w: World, arcId: string) => Object.values(w.promises).some(p => p.arc === arcId && p.status === 'kept' && (p.keptOn ?? '') > (lastDay(w.arcs[arcId]) ?? '')) ? 1 : 0

/** Today's visit. The same world, story day and growth stage always give the same visit, for every Starprint. */
export function nextVisit(w: World, at: { day: string; stage: Stage }, arcs: Arc[]): Visit {
  const ctx = (arc: Arc): SceneCtx => { const a = w.arcs[arc.id] ?? null, last = lastDay(a ?? undefined); return { world: w, arc: a, day: at.day, away: last ? daysBetween(last, at.day) : null } }
  // one visit a story day: once a choice is made, what followed stays until the next day
  const today = [...w.log].reverse().find(d => d.kind === 'choice' && d.day === at.day && arcs.some(a => a.id === d.arc))
  if (today) { const arc = arcs.find(a => a.id === today.arc)!; return { kind: 'today', arc, ctx: ctx(arc), last: today } }
  // arcs under way, the one with something new to see first
  const going = arcs.filter(a => w.arcs[a.id] && !w.arcs[a.id].finished)
    .sort((a, b) => news(w, b.id) - news(w, a.id) || (w.arcs[a.id].started < w.arcs[b.id].started ? -1 : 1))
  for (const arc of going) {
    const a = w.arcs[arc.id], scene = arc.scenes.find(s => s.when(a, w)), last = lastDay(a)
    if (scene && (!last || last < at.day)) return { kind: 'scene', arc, scene, ctx: ctx(arc), number: a.visits.length + 1 }
  }
  // a new arc, once the Cozmling has reached its stage
  for (const arc of arcs) {
    if (w.arcs[arc.id] || !stageReached(at.stage, arc.minStage)) continue
    const scene = arc.scenes.find(s => s.when(null, w))
    if (scene) return { kind: 'scene', arc, scene, ctx: ctx(arc), number: 1 }
  }
  const waiting = arcs.find(a => !w.arcs[a.id] && !stageReached(at.stage, a.minStage))
  return waiting ? { kind: 'waiting', arc: waiting, stage: waiting.minStage } : { kind: 'quiet', finished: arcs.filter(a => w.arcs[a.id]?.finished) }
}

/** The event a choice is kept as: its effects, and the scene exactly as it appeared with what followed. One per arc and scene, so it is kept once. */
export function choiceEvent(arc: Arc, scene: ArcScene, c: SceneCtx, choiceId: string, who: { companionId: string; name: string; archetype: Archetype | null }, run: string, now: number): JourneyEvent {
  const shown = render(arc, scene, c, who), ch = scene.choices(c).find(x => x.id === choiceId)
  if (!ch) throw new Error(`No choice ${choiceId} in ${arc.id}/${scene.id}`)
  const effects = [...ch.effects(c), ...(scene.last ? [{ do: 'finish' as const, arc: arc.id }] : [])]
  const data: StoryModeData = {
    schema: 1, kind: 'choice', run, arc: arc.id, arcVersion: arc.version, title: arc.title, scene: scene.id, day: c.day,
    choice: { id: ch.id, label: fill(ch.label, who.name) }, effects,
    shown: { paragraphs: shown.paragraphs.map(p => p.text), prompt: scene.prompt, offered: shown.choices.map(x => x.label), outcome: [...ch.outcome(c), ...(scene.last ? [arc.closing] : []), arc.stop].map(s => fill(s, who.name)), voice: who.archetype },
  }
  return { eventId: storyModeEventId(who.companionId, run, arc.id, scene.id), companionId: who.companionId, type: 'story-mode', at: now, data: data as unknown as Record<string, unknown> }
}

/** What's wrong with an arc, if anything: a branch that can't finish in its visits, a scene that can never come, a choice without effects. */
export function arcProblems(arc: Arc, explore: (arc: Arc) => { path: string[]; finished: boolean }[]): string[] {
  const p: string[] = [], seen = new Set<string>()
  for (const r of explore(arc)) {
    r.path.forEach(s => seen.add(s))
    if (!r.finished) p.push(`${r.path.join(' → ')} doesn't finish`)
    if (r.path.length !== arc.visits) p.push(`${r.path.join(' → ')} takes ${r.path.length} visits, not ${arc.visits}`)
  }
  for (const s of arc.scenes) if (!seen.has(s.id)) p.push(`${s.id} can never come`)
  return p
}
