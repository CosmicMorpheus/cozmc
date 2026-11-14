/* ============================================================
   STARPRINT VOICES: how each archetype might sound at a moment in a story.

   72 short original lines, twelve archetypes across six moments, polished in the COZMC zodiac
   writing review (November 13, 2026). A Cozmling speaks in its Starprint's archetype; a
   first-version Cozmling with a sky speaks in its Sun sign's.

   A voice only colors how a moment is told. It never chooses which story is told, which choices
   are offered or what happens next: those come from the day, the Cozmling's growth stage and its
   story so far, the same for every Starprint and every chart.
   ============================================================ */
import { signInfo } from '../domain/starprint'
import type { Companion } from '../types'

export type Archetype = 'Pathfinder' | 'Keeper' | 'Messenger' | 'Nurturer' | 'Radiant Heart' | 'Inventor' | 'Harmonizer' | 'Seeker' | 'Wanderer' | 'Builder' | 'Visionary' | 'Dreamer'
/** The six moments a voice line is written for. Looking closely, asking for help and resting each have one for every archetype. */
export type VoiceMoment = 'setback' | 'noticing' | 'asking-for-help' | 'helping-a-friend' | 'resting' | 'small-win'
export const MOMENTS: VoiceMoment[] = ['setback', 'noticing', 'asking-for-help', 'helping-a-friend', 'resting', 'small-win']

export const VOICES: Record<Archetype, Record<VoiceMoment, string>> = {
  Pathfinder: {
    setback: "Oh. That was not the plan, it thinks.",
    noticing: "Oh! How long has that been there?",
    "asking-for-help": "It has one question ready. That might be enough.",
    "helping-a-friend": "If its friend wants company, it’s ready.",
    resting: "Even a spark can settle into a warm little ember.",
    "small-win": "There! That worked, it thinks.",
  },
  Keeper: {
    setback: "The disappointment settles like a pebble in a pocket.",
    noticing: "Something new stands out, like a fleck of gold in familiar stone.",
    "asking-for-help": "A familiar voice would feel like coming in out of the cold.",
    "helping-a-friend": "It hopes its company feels as welcome as a light left on.",
    resting: "The quiet settles around it like a favorite blanket.",
    "small-win": "It savors the moment like the last sip of something warm.",
  },
  Messenger: {
    setback: "It has two feelings about this, and neither has found quite the right words.",
    noticing: "It notices a tiny detail and a second, tinier question tucked inside it.",
    "asking-for-help": "It has half a question. Perhaps a friend can help it find the rest.",
    "helping-a-friend": "It wonders which part of the story its friend most wants someone to hear.",
    resting: "One thought wanders off. The next can take its time.",
    "small-win": "It has good news and is already trying out the first line of the story.",
  },
  Nurturer: {
    setback: "It feels a little ache where the hopeful thought had been.",
    noticing: "The new thing looks as though it has been waiting for a place to belong.",
    "asking-for-help": "What a relief it would be to hear a friend say, “I’m here.”",
    "helping-a-friend": "The trouble can wait a moment. How is its friend doing?",
    resting: "For a while, it lets the quiet look after it.",
    "small-win": "It tucks the memory away like a note from a friend.",
  },
  "Radiant Heart": {
    setback: "It had a speech ready for when this worked. Quiet feels better right now.",
    noticing: "A little surprise, and the day has its own bit of sparkle.",
    "asking-for-help": "It has an unfinished thought, without a grand speech to wrap around it.",
    "helping-a-friend": "It sees how much heart its friend put into this.",
    resting: "For now, it keeps its little glow to itself.",
    "small-win": "A tiny cheer seems about right.",
  },
  Inventor: {
    setback: "Not quite, it thinks, with a small, disappointed pause.",
    noticing: "One piece catches its attention. Now it wonders how that fits with the rest.",
    "asking-for-help": "It can explain where things get muddled. A friend could start there.",
    "helping-a-friend": "It wonders which part of this its friend would like a hand with.",
    resting: "The loose ends can stay loose, it thinks.",
    "small-win": "That one bit fits. Lovely.",
  },
  Harmonizer: {
    setback: "It had pictured something different, and the difference stings a little.",
    noticing: "Funny how one new thing can change the way everything around it looks.",
    "asking-for-help": "It knows how this looks from here. How might it look from a friend’s side?",
    "helping-a-friend": "It wants to hear what matters most to its friend before it offers an idea.",
    resting: "For a while, it likes the balance of sound and quiet.",
    "small-win": "This feels like two colors finding they look good together.",
  },
  Seeker: {
    setback: "The disappointment goes deeper than it expected.",
    noticing: "A quiet detail catches its attention. What else has it passed by?",
    "asking-for-help": "It has a small question, with a much bigger feeling behind it.",
    "helping-a-friend": "It can sit with a friend’s worry, even if it only knows a little of the story.",
    resting: "The quiet lets it leave a question without an answer.",
    "small-win": "The glad feeling is quiet enough to keep for itself a while.",
  },
  Wanderer: {
    setback: "Well, that was a rough turn in the story.",
    noticing: "For a moment, home feels as wide as a place it’s never been.",
    "asking-for-help": "Maybe a friend can see past this bend in the road.",
    "helping-a-friend": "It is curious about this small chapter in its friend’s much bigger story.",
    resting: "The world will still be wide after a good rest.",
    "small-win": "It has a little good news to carry into the next chapter.",
  },
  Builder: {
    setback: "It put real care into this. That’s part of why it hurts.",
    noticing: "It wonders how long that detail has been there, waiting for a slower day.",
    "asking-for-help": "It knows where it got stuck. That’s a place to start.",
    "helping-a-friend": "If its friend wants to share the load, it can take a turn.",
    resting: "Tomorrow can have what’s left to do.",
    "small-win": "Something it cared about went right. It takes a moment to enjoy it.",
  },
  Visionary: {
    setback: "The idea was lovely, it thinks. This part is harder.",
    noticing: "One new detail makes it want to turn the whole picture sideways.",
    "asking-for-help": "It could use a friend who sees this from a completely different angle.",
    "helping-a-friend": "It has a guess about what might help. It’s curious to hear its friend’s idea first.",
    resting: "Even a good idea can go off and be a cloud for a while.",
    "small-win": "Well, that worked in a way it hadn’t pictured.",
  },
  Dreamer: {
    setback: "For a moment, it imagines disappointment as a ripple crossing a quiet pond.",
    noticing: "It notices a tiny shape that reminds it of a half-remembered dream.",
    "asking-for-help": "It knows how this feels. The words are still finding their shape.",
    "helping-a-friend": "It imagines its friend’s worry as a stone that might feel lighter with company.",
    resting: "Its thoughts float past, like leaves it can let the water carry.",
    "small-win": "The glad feeling stays with it, like a tune from a good dream.",
  },
}

export const ARCHETYPES = Object.keys(VOICES) as Archetype[]
export const isArchetype = (a: unknown): a is Archetype => typeof a === 'string' && a in VOICES

/** The archetype a Cozmling speaks in: its Starprint's, or a first-version Cozmling's Sun sign's. Null when it has neither. */
export function voiceOf(c: Companion): Archetype | null {
  if (c.kind === 'adventurer') return isArchetype(c.starprint.archetype) ? c.starprint.archetype : null
  const sun = c.celestial?.bodies.sun.sign
  const a = sun ? signInfo(sun).archetype : null
  return isArchetype(a) ? a : null
}

/** Its line for a moment, or null when it has no archetype (the story reads the same without it). */
export const voiceLine = (a: Archetype | null, m: VoiceMoment): string | null => (a ? VOICES[a][m] : null)
