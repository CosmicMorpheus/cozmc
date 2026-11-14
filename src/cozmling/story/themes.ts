/* ============================================================
   THE WORDS FOR A COZMLING'S DAY: original COZMC writing, polished in the zodiac writing review
   (November 13, 2026).

   A day's kind (play, comfort, curiosity…) is chosen from the day, the Cozmling's growth stage and
   its story so far (source.ts), never from its sign or its chart. Each kind brings its titles,
   words, small tendencies, invitations, reflections, and a moment for the Cozmling's own voice
   (voices.ts). Everything here is a small tendency ("it seems", "as if"), never a rule, and nothing
   here may say what will happen.
   ============================================================ */
import type { HomeId } from '../../companion/care'
import type { MoonPhaseName } from '../celestial/types'
import type { VoiceMoment } from './voices'

export type DayKind = 'play' | 'comfort' | 'curiosity' | 'connection' | 'courage' | 'growth' | 'reflection' | 'creativity' | 'dreams' | 'change' | 'quiet'
/** Something the story can invite the player to do. Each one can be seen to have happened, without any reward. */
export type InvitationAction = 'feed' | 'play' | 'pat' | 'rest' | 'arcade' | 'observatory'

/** Every kind of day, in the order the daily rotation walks through them (source.ts). */
export const DAY_KINDS: DayKind[] = ['curiosity', 'play', 'comfort', 'connection', 'courage', 'reflection', 'creativity', 'growth', 'dreams', 'change', 'quiet']

/** The moment each kind of day pauses on, where the Cozmling's own voice comes in. Asleep, it is always resting. */
export const MOMENT_BY_KIND: Record<DayKind, VoiceMoment> = {
  curiosity: 'noticing', play: 'small-win', comfort: 'resting', connection: 'helping-a-friend', courage: 'small-win', reflection: 'resting',
  creativity: 'small-win', growth: 'noticing', dreams: 'resting', change: 'setback', quiet: 'resting',
}
/** The same for every Cozmling: what happens at that moment. The line after it is the Cozmling's own (voices.ts). */
export const MOMENT_SETUP: Record<VoiceMoment, string> = {
  noticing: 'Then something new catches its eye.',
  'small-win': 'Then one small thing goes just right.',
  resting: 'Later, it settles in for a quiet moment.',
  'helping-a-friend': 'A friend stops by with a small worry.',
  setback: 'Then one small plan doesn’t quite work out.',
  'asking-for-help': 'Then something has it stuck for a moment.',
}
/** Resting while asleep. */
export const ASLEEP_SETUP = 'It sleeps on, peacefully.'

export interface DayTheme {
  titles: string[]
  words: [string, string, string]
  /** a small tendency, shown in the Cozmling's own home ({prop} is a place in it) */
  tendencies: string[]
  invite: InvitationAction[]
  reflections: string[]
}

export const THEMES: Record<DayKind, DayTheme> = {
  connection: {
    titles: ['A moment of connection', 'Close company', 'A friendly sky'],
    words: ['Connection', 'Creativity', 'Companionship'],
    tendencies: [
      'It seems to want company today: it keeps wandering back towards you, and stays close to {prop}.',
      'It seems pleased to hear you nearby, turning toward the sound with a little wiggle.',
    ],
    invite: ['pat', 'play'],
    reflections: ['One way to begin is to make room for someone beside you.', 'A friend is someone who notices when you arrive.'],
  },
  play: {
    titles: ['A bright, bouncy day', 'Sunny spirits', 'A day to shine'],
    words: ['Joy', 'Play', 'Confidence'],
    tendencies: [
      'It seems full of bounce today, trying a few small hops and then pausing to look around.',
      'It seems delighted by the bright patch near {prop}, where it pauses for a tiny, cheerful twirl.',
    ],
    invite: ['play', 'arcade'],
    reflections: ['A shared giggle can make this moment feel a little lighter.', 'In play, it can try something unfamiliar with room for a wobble.'],
  },
  comfort: {
    titles: ['A cosy day', 'Close to home', 'Soft and safe'],
    words: ['Comfort', 'Home', 'Feelings'],
    tendencies: [
      'It seems drawn to its familiar corner by {prop}, moving a few small things into comfortable places.',
      'It seems to be checking that everything familiar is still where it belongs.',
    ],
    invite: ['feed', 'pat'],
    reflections: ['A welcome can help a new place begin to feel like home.', 'Care can travel both ways, even through something as small as a shared snack.'],
  },
  curiosity: {
    titles: ['A day of questions', 'Curious stars', 'Something to figure out'],
    words: ['Curiosity', 'Learning', 'Conversation'],
    tendencies: [
      'It seems full of questions today, with even {prop} offering something new to wonder about.',
      'It tilts its head at every new sound, as if working out what each one means.',
    ],
    invite: ['observatory', 'play'],
    reflections: ['Every question is a small light in the dark.', 'A second question can help a shared idea become clearer.'],
  },
  courage: {
    titles: ['A brave little day', 'A small act of courage', 'A spark of courage'],
    words: ['Courage', 'Energy', 'Adventure'],
    tendencies: [
      'It seems curious about the view beside {prop}, lifting its head for a careful peek.',
      'It seems ready to try something new, pausing as if choosing its first small step.',
    ],
    invite: ['arcade', 'play'],
    reflections: ['Courage can include a question, a helping hand or a pause.', 'A small step can count, even when the next one needs to wait.'],
  },
  growth: {
    titles: ['Room to grow', 'A stretching kind of day', 'A hopeful sky'],
    words: ['Growth', 'Hope', 'Generosity'],
    tendencies: [
      'Beside {prop}, it pauses for a moment. There is still plenty of the day left to explore.',
      'It seems to be in a generous mood, ready to share whatever it finds.',
    ],
    invite: ['feed', 'arcade'],
    reflections: ['Growing up happens a day at a time, and today counts.', 'We are all COZMC. Brick by brick, we build.'],
  },
  reflection: {
    titles: ['A thoughtful day', 'Quiet stars', 'Slow and steady'],
    words: ['Patience', 'Focus', 'Learning'],
    tendencies: [
      'It seems thoughtful by {prop}, watching a small detail as though there is more to notice.',
      'It seems happy to take its time, pausing between small tasks to notice how each one feels.',
    ],
    invite: ['pat', 'observatory'],
    reflections: ['Patience is a kind of strength.', 'Some things need time. A friend can sit nearby while they take shape.'],
  },
  creativity: {
    titles: ['A day for new ideas', 'An unusual idea', 'New patterns'],
    words: ['Creativity', 'Surprise', 'Originality'],
    tendencies: [
      'It seems curious about the pebbles by {prop}, trying patterns and leaving space for another idea.',
      'It seems interested in doing a familiar thing another way, pausing to notice the difference.',
    ],
    invite: ['play', 'arcade'],
    reflections: ['An idea can carry a little of the one who made it.', 'A new idea can need a little time to feel familiar.'],
  },
  dreams: {
    titles: ['Dreaming weather', 'A soft, slow day', 'Far-away stars'],
    words: ['Dreams', 'Imagination', 'Calm'],
    tendencies: [
      'It gazes up past {prop} for a long time, as if listening to something far away.',
      'It seems lost in a small daydream, moving slowly as though following an imaginary trail.',
    ],
    invite: ['rest', 'pat'],
    reflections: ['A quiet pause can have a place beside every busy part of the story.', 'An imagined place can be worth visiting, even without a plan to go there.'],
  },
  change: {
    titles: ['A day of quiet strength', 'Deep roots', 'Turning a corner'],
    words: ['Strength', 'Change', 'Renewal'],
    tendencies: [
      'It seems a little surer of itself today, standing firm beside {prop}.',
      'It seems pleased with a small effort today, whether the tricky part is finished or still needs time.',
    ],
    invite: ['feed', 'play'],
    reflections: ['An ending can leave room for many feelings.', 'Something hard can deserve care, even before anything changes.'],
  },
  quiet: {
    titles: ['A quiet sky', 'An open day', 'A blank page'],
    words: ['Calm', 'Freedom', 'Choice'],
    tendencies: [
      'There is time today to see where a quiet moment takes the two of you.',
      'The room is quiet. There is time for an idea to come along.',
    ],
    invite: ['play', 'pat'],
    reflections: ['A quiet moment can hold an idea of its own.', 'There can be good company in a little silence.'],
  },
}

/** How today's strongest aspect might read, for the sky reading beside the story (never the story itself). */
export const AS_THE_SKY_SAYS: Record<'flow' | 'tension' | 'blend', string[]> = {
  flow: ['As a sky symbol, this can suggest a moment when things come together.', 'One way to read this symbol is as a little room to breathe.'],
  tension: ['As a sky symbol, this can suggest two things pulling in different directions.', 'One way to read this symbol is as a moment that takes patience.'],
  blend: ['One theme in today’s sky meets a theme from its birth sky.', 'These sky symbols can bring two themes together, like two notes sounding at once.'],
}

/** Places in each home, for the small things it does. */
export const PROPS: Record<HomeId, string[]> = {
  grove: ['the mossy log', 'its woven nest', 'the glowing mushrooms', 'the edge of the pines'],
  moonbase: ['the porthole', 'the little alien plant', 'the blinking console', 'its sleep pod'],
  loft: ['the big window', 'the orrery', 'the lanterns', 'its bed'],
}
export const HOME_NAME: Record<HomeId, string> = { grove: 'the Cosmic Grove', moonbase: 'the Moon Base', loft: 'the Star Loft' }

/** The Moon's phase, as it is spoken of. */
export const PHASE_PHRASE: Record<MoonPhaseName, string> = {
  'New Moon': 'a new Moon', 'Waxing Crescent': 'a waxing crescent Moon', 'First Quarter': 'a first-quarter Moon', 'Waxing Gibbous': 'a waxing gibbous Moon',
  'Full Moon': 'a full Moon', 'Waning Gibbous': 'a waning gibbous Moon', 'Last Quarter': 'a last-quarter Moon', 'Waning Crescent': 'a waning crescent Moon',
}

/** Opening lines by the time of day the story is written ({name}, {home}, {phase}). */
export const OPENINGS = {
  morning: ['{name} wakes beneath {phase} in {home}.', 'Morning in {home}: {name} is up and looking around under {phase}.'],
  afternoon: ['It’s afternoon in {home}, and {name} is out and about.', '{name} spends the afternoon exploring {home}.'],
  evening: ['Evening settles over {home}, and {name} watches {phase} come up.', 'The light is going in {home}, and {name} is still wide awake.'],
  night: ['It’s late in {home}, and {name} is still awake under {phase}.', 'Night has fallen on {home}, and {name} is up past its bedtime.'],
  asleep: ['{name} is curled up asleep in {home}, its antenna glowing softly under {phase}.'],
  hatched: ['Today {name} saw {home} for the very first time, under {phase}.'],
}

/** How it is doing, after its happiness and sustenance are said. */
export const CONDITION = {
  great: ['There’s plenty of spark in it today.', 'It’s feeling on top of the world.'],
  food: { good: 'Its tummy has started to rumble a little.', low: 'It’s hungry, and keeps looking at you hopefully.' },
  fun: { good: 'It keeps nudging the star ball towards you.', low: 'It’s bored, and a game would mean a lot to it.' },
  energy: { good: 'It yawns more than it means to.', low: 'It can barely keep its eyes open.' },
}

export const CLOSINGS = [
  'Perhaps a few moments together could give it another memory worth carrying into tomorrow.',
  'Whatever you do together today becomes part of its story.',
  'There’s room in the day for one more shared adventure.',
]

export const INVITATION_TEXT: Record<InvitationAction, (name: string) => string> = {
  feed: n => `Share a meal with ${n}.`,
  play: n => `Play a game of star ball with ${n}.`,
  pat: n => `Give ${n} a pat or two.`,
  rest: n => `Let ${n} rest when it gets tired.`,
  arcade: n => `Play one arcade game with ${n}.`,
  observatory: n => `Look at today’s sky together in ${n}’s observatory.`,
}
