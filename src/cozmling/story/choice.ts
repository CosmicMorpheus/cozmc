/* ============================================================
   CHOICE STORIES: short stories in which the player chooses how a Cozmling meets a moment.

   - The same scenes, choices and endings for every Cozmling. The only words that depend on its
     Starprint are its voice lines: a story's own opening line for each archetype, and the
     archetype's line for a moment (voices.ts). A voice never chooses anything.
   - Every route reaches a safe ending with a friend nearby. No route earns a reward, a rank, a
     badge or a teaching; nothing in the care meters, growth, scores or tokens changes.
   - A finished story is kept as one 'choice-story' event with the text exactly as shown and both
     choices, so a later edit of the story never changes what was read. Its id comes from the moment
     the reading began, so a choice pressed twice is kept once. Reading it again is a new event that
     points to the first; the first is never overwritten.
   ============================================================ */
import { voiceLine, type Archetype, type VoiceMoment } from './voices'

export interface StoryChoice { id: string; label: string; to: string }
export interface StoryEnding { id: string; title: string; outcome: string; invitation: string; reflection: string }
export interface StoryNode {
  /** paragraphs; {name} is the Cozmling's name */
  text: string[]
  /** the Cozmling's own voice, placed before paragraph `at` (text.length = after the last): the story's opening line for its archetype, or its line for a moment */
  voice?: { at: number; line: 'opening' | VoiceMoment }
  /** a first line that depends on the choice that led here, where routes meet */
  arrivals?: Record<string, string>
  prompt?: string
  choices?: StoryChoice[]
  ending?: StoryEnding
}
export interface ChoiceStory {
  id: string
  version: string
  /** a draft is shown only on the preview site and in local work */
  status: 'draft' | 'approved'
  title: string
  minutes: number
  entry: string
  nodes: Record<string, StoryNode>
  /** one opening line per archetype (the only text in the first scene that differs between Starprints) */
  openings: Record<Archetype, string>
  provenance: { kind: 'original'; label: string; notes: string }
}

export interface Paragraph { text: string; voice?: true }
export interface Scene { id: string; paragraphs: Paragraph[]; prompt: string | null; choices: StoryChoice[]; ending: StoryEnding | null }
export interface Who { name: string; archetype: Archetype | null }

/** A scene as this Cozmling sees it. `arrivedBy`: the choice that led here. */
export function scene(story: ChoiceStory, id: string, who: Who, arrivedBy?: string): Scene {
  const node = story.nodes[id]
  if (!node) throw new Error(`No scene ${id} in ${story.id}`)
  const fill = (s: string) => s.replace(/\{name\}/g, who.name)
  const voice = !node.voice ? null : node.voice.line === 'opening' ? (who.archetype ? story.openings[who.archetype] : null) : voiceLine(who.archetype, node.voice.line)
  const paragraphs: Paragraph[] = []
  const arrival = arrivedBy ? node.arrivals?.[arrivedBy] : undefined
  if (arrival) paragraphs.push({ text: fill(arrival) })
  node.text.forEach((t, i) => {
    if (voice && node.voice!.at === i) paragraphs.push({ text: voice, voice: true })
    paragraphs.push({ text: fill(t) })
  })
  if (voice && node.voice!.at >= node.text.length) paragraphs.push({ text: voice, voice: true })
  return { id, paragraphs, prompt: node.prompt ?? null, choices: node.choices ?? [], ending: node.ending ?? null }
}

/** The scene a choice leads to, or null if that choice isn't offered there. */
export function next(story: ChoiceStory, id: string, choiceId: string): string | null {
  return story.nodes[id]?.choices?.find(c => c.id === choiceId)?.to ?? null
}

/** Every way through the story: the scenes passed and the choices made, from the first scene to an ending. */
export function routes(story: ChoiceStory): { path: string[]; picks: string[] }[] {
  const out: { path: string[]; picks: string[] }[] = []
  const walk = (id: string, path: string[], picks: string[]) => {
    if (path.includes(id)) throw new Error(`${story.id} loops back to ${id}`)
    const node = story.nodes[id], here = [...path, id]
    if (node.ending) { out.push({ path: here, picks }); return }
    for (const c of node.choices ?? []) walk(c.to, here, [...picks, c.id])
  }
  walk(story.entry, [], [])
  return out
}

const words = (s: string) => s.trim().split(/\s+/).length
/** What's wrong with a story, if anything: a choice to nowhere, a dead end, a loop, an unreachable scene, a missing or long opening. */
export function storyProblems(story: ChoiceStory, archetypes: Archetype[]): string[] {
  const p: string[] = []
  if (!story.nodes[story.entry]) p.push(`no first scene ${story.entry}`)
  for (const [id, n] of Object.entries(story.nodes)) {
    if (!!n.ending === !!n.choices?.length) p.push(`${id} needs either choices or an ending`)
    for (const c of n.choices ?? []) if (!story.nodes[c.to]) p.push(`${id}/${c.id} leads nowhere (${c.to})`)
    if (n.voice && (n.voice.at < 0 || n.voice.at > n.text.length)) p.push(`${id}: voice placed outside the scene`)
    if (n.ending && (!n.ending.invitation || !n.ending.reflection)) p.push(`${id}: an ending needs an invitation and a reflection`)
  }
  try {
    const seen = new Set(routes(story).flatMap(r => r.path))
    for (const id of Object.keys(story.nodes)) if (!seen.has(id)) p.push(`${id} can't be reached`)
  } catch (e) { p.push(String((e as Error).message)) }
  for (const a of archetypes) {
    const o = story.openings[a]
    if (!o) p.push(`no opening line for the ${a}`)
    else if (words(o) > 20) p.push(`the ${a}'s opening is longer than 20 words`)
  }
  return p
}

/* ---------------- what is kept ---------------- */

export interface ChoiceRun {
  schema: 1
  storyId: string
  version: string
  title: string
  /** the scenes passed through, first to last */
  path: string[]
  choices: { node: string; id: string; label: string }[]
  ending: { id: string; title: string; outcome: string }
  /** everything as it appeared: each scene's paragraphs (voice lines included), its question and the choices offered */
  shown: { voice: Archetype | null; scenes: { id: string; paragraphs: string[]; prompt: string | null; offered: string[] }[]; invitation: string; reflection: string }
  provenance: { kind: 'original'; label: string }
  startedAt: number
  finishedAt: number
  /** a reading again points to the first reading; the first is never changed */
  replayOf: string | null
}

/** The id a finished reading is kept under: one per reading (from the moment it began), so a choice pressed twice, or a
    retried save, is kept once, while two readings (or two devices' readings, merged) stay apart. */
export const choiceEventId = (companionId: string, story: Pick<ChoiceStory, 'id' | 'version'>, reading: { startedAt: number; nonce: string }) => `choice:${companionId}:${story.id}@${story.version}:${reading.startedAt.toString(36)}-${reading.nonce}`

/** The record of one reading, from the choices made. Throws if the choices don't make a route to an ending. */
export function runRecord(story: ChoiceStory, who: Who, picks: string[], times: { startedAt: number; finishedAt: number }, replayOf: string | null = null): ChoiceRun {
  const path = [story.entry], choices: ChoiceRun['choices'] = [], scenes: ChoiceRun['shown']['scenes'] = []
  let arrivedBy: string | undefined
  for (let i = 0; ; i++) {
    const id = path[path.length - 1], sc = scene(story, id, who, arrivedBy)
    scenes.push({ id, paragraphs: sc.paragraphs.map(p => p.text), prompt: sc.prompt, offered: sc.choices.map(c => c.label) })
    if (sc.ending) {
      if (i !== picks.length) throw new Error('more choices than the story has')
      return {
        schema: 1, storyId: story.id, version: story.version, title: story.title, path, choices,
        ending: { id: sc.ending.id, title: sc.ending.title, outcome: sc.ending.outcome },
        shown: { voice: who.archetype, scenes, invitation: sc.ending.invitation, reflection: sc.ending.reflection },
        provenance: { kind: story.provenance.kind, label: story.provenance.label },
        startedAt: times.startedAt, finishedAt: times.finishedAt, replayOf,
      }
    }
    const c = sc.choices.find(x => x.id === picks[i])
    if (!c) throw new Error(`no choice ${picks[i]} in ${id}`)
    choices.push({ node: id, id: c.id, label: c.label })
    path.push(c.to); arrivedBy = c.id
  }
}

/** A kept reading, if it is one this version of the site can show. */
export function asChoiceRun(data: unknown): ChoiceRun | null {
  const r = data as ChoiceRun | null
  return r && r.schema === 1 && typeof r.storyId === 'string' && Array.isArray(r.path) && Array.isArray(r.choices) && !!r.ending && !!r.shown ? r : null
}
