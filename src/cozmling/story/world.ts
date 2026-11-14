/* ============================================================
   STORY MODE: what the game remembers between visits.

   A visit happens on a story day: the player's own calendar day (the same boundary as the daily
   story), or, in a preview test save, that save's simulated day. Everything that happens is kept
   as a 'story-mode' event with a stable id, and the world is worked out from those events, in order:
   - what each character saw, heard or guessed, and from whom;
   - promises: who made them, to whom, when they fall due, and whether they were kept;
   - where objects are; offers a character made for a later visit; threads a later story can pick up;
   - for each arc: the day it began, which way it went, every visit and choice, the day it ended.

   The store keeps an event id only once, so refreshing, a second tab or pressing a choice twice
   applies its effects once. Elapsed time is settled by the game's rules when a story day begins:
   a promise that has fallen due is kept by the world, once, on the day it fell due.
   Nothing here reads a Cozmling's sign, chart or private notes.
   ============================================================ */
import type { JourneyEvent } from '../types'

export type Who = 'cozmling' | 'friend' | 'lamplighter'

export type Effect =
  | { do: 'start'; arc: string }
  | { do: 'branch'; arc: string; branch: string }
  | { do: 'observe'; fact: string; who: Who }
  | { do: 'tell'; fact: string; from: Who; to: Who }
  | { do: 'guess'; fact: string; who: Who }
  | { do: 'promise'; id: string; by: Who; to: Who; what: string; dueInDays: number; then: Effect[]; note: string }
  | { do: 'keep'; promise: string }
  | { do: 'place'; object: string; at: string }
  | { do: 'offer'; id: string; by: Who; what: string }
  | { do: 'thread'; id: string; note: string }
  | { do: 'finish'; arc: string }

/** One kept event of Story Mode. A choice is the player's; a world event is the game's rules at work (a promise kept). */
export interface StoryModeData {
  schema: 1
  kind: 'choice' | 'world'
  /** 'main' for the real save; 'test-1', 'test-2'… in a preview test save */
  run: string
  arc: string
  arcVersion: string
  title: string
  /** the scene a choice was made in, or the rule that acted */
  scene: string
  /** the story day it happened on */
  day: string
  choice?: { id: string; label: string }
  effects: Effect[]
  /** a choice: everything as it appeared, and what followed */
  shown?: { paragraphs: string[]; prompt: string | null; offered: string[]; outcome: string[]; voice: string | null }
  /** a world event: what happened, in a line */
  note?: string
}

/** The id an event is kept under: one per arc, scene (or rule) and run, so it can only ever be kept once. */
export const storyModeEventId = (companionId: string, run: string, arc: string, step: string) => `sm:${companionId}:${run}:${arc}:${step}`

export const asStoryMode = (data: unknown): StoryModeData | null => {
  const d = data as StoryModeData | null
  return d && d.schema === 1 && (d.kind === 'choice' || d.kind === 'world') && typeof d.run === 'string' && typeof d.arc === 'string' && typeof d.day === 'string' && Array.isArray(d.effects) ? d : null
}

/* ---------------- story days ---------------- */

const utc = (day: string) => { const [y, m, d] = day.split('-').map(Number); return Date.UTC(y, m - 1, d) }
export const addDays = (day: string, n: number) => new Date(utc(day) + n * 86_400_000).toISOString().slice(0, 10)
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000)

/* ---------------- the world ---------------- */

export interface Knowledge { how: 'saw' | 'heard' | 'guessed' | 'promised'; from?: Who; day: string }
export interface PromiseState { id: string; arc: string; arcVersion: string; title: string; by: Who; to: Who; what: string; madeOn: string; dueOn: string; status: 'open' | 'kept'; keptOn?: string; then: Effect[]; note: string }
export interface ArcState { started: string; branch: string | null; visits: { scene: string; day: string; choice: string; label: string }[]; finished: string | null }
export interface World {
  run: string
  arcs: Record<string, ArcState>
  knows: Partial<Record<Who, Record<string, Knowledge>>>
  promises: Record<string, PromiseState>
  objects: Record<string, { at: string; since: string }>
  offers: Record<string, { by: Who; what: string; day: string }>
  threads: Record<string, { note: string; day: string }>
  /** the events it was worked out from, in order */
  log: StoryModeData[]
}

export const emptyWorld = (run: string): World => ({ run, arcs: {}, knows: {}, promises: {}, objects: {}, offers: {}, threads: {}, log: [] })

/** The world as this run's events leave it. Events of any other kind, or another run, are ignored, so an old save with no story history is an empty world. */
export function worldFrom(events: JourneyEvent[], run: string): World {
  const w = emptyWorld(run)
  const mine = events.flatMap(e => { const d = e.type === 'story-mode' ? asStoryMode(e.data) : null; return d && d.run === run ? [{ d, at: e.at }] : [] })
  // in story order: by day, the world's own doings first (they happen as the day begins), then by when they were kept
  mine.sort((a, b) => (a.d.day < b.d.day ? -1 : a.d.day > b.d.day ? 1 : a.d.kind !== b.d.kind ? (a.d.kind === 'world' ? -1 : 1) : a.at - b.at))
  for (const { d } of mine) {
    for (const f of d.effects) apply(w, f, d)
    if (d.kind === 'choice' && d.choice && w.arcs[d.arc]) w.arcs[d.arc].visits.push({ scene: d.scene, day: d.day, choice: d.choice.id, label: d.choice.label })
    w.log.push(d)
  }
  return w
}

function know(w: World, who: Who, fact: string, k: Knowledge) {
  const mind = (w.knows[who] ??= {})
  if (k.how === 'guessed' && mind[fact]) return                 // a guess never replaces something seen or heard
  mind[fact] = k
}

function apply(w: World, f: Effect, d: StoryModeData) {
  const day = d.day
  switch (f.do) {
    case 'start': w.arcs[f.arc] ??= { started: day, branch: null, visits: [], finished: null }; break
    case 'branch': if (w.arcs[f.arc]) w.arcs[f.arc].branch = f.branch; break
    case 'observe': know(w, f.who, f.fact, { how: 'saw', day }); break
    case 'tell': know(w, f.to, f.fact, { how: 'heard', from: f.from, day }); break
    case 'guess': know(w, f.who, f.fact, { how: 'guessed', day }); break
    case 'promise':
      w.promises[f.id] ??= { id: f.id, arc: d.arc, arcVersion: d.arcVersion, title: d.title, by: f.by, to: f.to, what: f.what, madeOn: day, dueOn: addDays(day, f.dueInDays), status: 'open', then: f.then, note: f.note }
      know(w, f.by, `promise:${f.id}`, { how: 'promised', day }); know(w, f.to, `promise:${f.id}`, { how: 'heard', from: f.by, day })
      break
    case 'keep': {
      const p = w.promises[f.promise]
      if (!p || p.status === 'kept') break
      p.status = 'kept'; p.keptOn = day
      for (const g of p.then) apply(w, g, d)
      break
    }
    case 'place': w.objects[f.object] = { at: f.at, since: day }; break
    case 'offer': w.offers[f.id] ??= { by: f.by, what: f.what, day }; break
    case 'thread': w.threads[f.id] ??= { note: f.note, day }; break
    case 'finish': if (w.arcs[f.arc] && !w.arcs[f.arc].finished) w.arcs[f.arc].finished = day; break
  }
}

/**
 * What the world does by itself by `day`: each promise that has fallen due is kept, on the day it fell
 * due. Each is one event with a stable id, so working this out again (a refresh, a retried story day,
 * a second tab) never keeps a promise twice.
 */
export function dueEvents(w: World, day: string, companionId: string, now: number): JourneyEvent[] {
  return Object.values(w.promises).filter(p => p.status === 'open' && p.dueOn <= day).map(p => {
    const data: StoryModeData = { schema: 1, kind: 'world', run: w.run, arc: p.arc, arcVersion: p.arcVersion, title: p.title, scene: `keep-${p.id}`, day: p.dueOn, effects: [{ do: 'keep', promise: p.id }], note: p.note }
    return { eventId: storyModeEventId(companionId, w.run, p.arc, `keep-${p.id}`), companionId, type: 'story-mode', at: now, data: data as unknown as Record<string, unknown> }
  })
}

/** Does this character know this, and how? */
export const knows = (w: World, who: Who, fact: string): Knowledge | null => w.knows[who]?.[fact] ?? null
