/* ============================================================
   THE WORDS FOR A COZMLING'S DAY: original COZMC writing.

   A day's story is built from today's strongest transit (which part of the Cozmling's own sky it
   touches gives the day its kind), the Cozmling's home, and how it is doing. Everything here is a
   small tendency ("it seems", "as if"), never a rule: the sky offers a theme, and what happens is
   up to the player. Nothing here may say what will happen.
   ============================================================ */
import type { HomeId } from '../../companion/care'
import type { MoonPhaseName, PointId } from '../celestial/types'

export type DayKind = 'play' | 'comfort' | 'curiosity' | 'connection' | 'courage' | 'growth' | 'reflection' | 'creativity' | 'dreams' | 'change' | 'quiet'
/** Something the story can invite the player to do. Each one can be seen to have happened, without any reward. */
export type InvitationAction = 'feed' | 'play' | 'pat' | 'rest' | 'arcade' | 'observatory'

/** A transit's kind of day comes from the point of the Cozmling's own sky it touches. */
export const KIND_BY_POINT: Record<PointId, DayKind> = {
  sun: 'play', moon: 'comfort', mercury: 'curiosity', venus: 'connection', mars: 'courage', jupiter: 'growth',
  saturn: 'reflection', uranus: 'creativity', neptune: 'dreams', pluto: 'change', ascendant: 'connection', midheaven: 'growth',
}

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
      'Whenever it hears you nearby, it turns round with a small burst of excitement.',
    ],
    invite: ['pat', 'play'],
    reflections: ['The sky may offer a direction, but the journey is built together.', 'A friend is someone who notices when you arrive.'],
  },
  play: {
    titles: ['A bright, bouncy day', 'Sunny spirits', 'A day to shine'],
    words: ['Joy', 'Play', 'Confidence'],
    tendencies: [
      'It can’t seem to stay still today: every hop is a little higher than the last.',
      'It has found a bright spot near {prop} and is showing off in it.',
    ],
    invite: ['play', 'arcade'],
    reflections: ['Joy shared is joy doubled.', 'Play is how we practise being brave.'],
  },
  comfort: {
    titles: ['A cosy day', 'Close to home', 'Soft and safe'],
    words: ['Comfort', 'Home', 'Feelings'],
    tendencies: [
      'It keeps tidying its little corner by {prop}, just the way it likes it.',
      'It seems to be checking that everything familiar is still where it belongs.',
    ],
    invite: ['feed', 'pat'],
    reflections: ['Home is wherever someone is glad to see you.', 'Looking after someone is a way of being looked after, too.'],
  },
  curiosity: {
    titles: ['A day of questions', 'Curious stars', 'Something to figure out'],
    words: ['Curiosity', 'Learning', 'Conversation'],
    tendencies: [
      'It has a question for everything today, starting with {prop}.',
      'It tilts its head at every new sound, as if working out what each one means.',
    ],
    invite: ['observatory', 'play'],
    reflections: ['Every question is a small light in the dark.', 'Learning together is the best kind of learning.'],
  },
  courage: {
    titles: ['A brave little day', 'Ready for anything', 'A spark of courage'],
    words: ['Courage', 'Energy', 'Adventure'],
    tendencies: [
      'It climbs up beside {prop} and peers out, braver than usual.',
      'It marches about with its antenna held high, as if it is on a mission.',
    ],
    invite: ['arcade', 'play'],
    reflections: ['Courage is curiosity that keeps going.', 'Small steps, taken often, go a long way.'],
  },
  growth: {
    titles: ['Room to grow', 'A stretching kind of day', 'A hopeful sky'],
    words: ['Growth', 'Hope', 'Generosity'],
    tendencies: [
      'It stretches up tall beside {prop}, as if measuring how much it has grown.',
      'It seems to be in a generous mood, ready to share whatever it finds.',
    ],
    invite: ['feed', 'arcade'],
    reflections: ['Growing up happens a day at a time, and today counts.', 'We are all COZMC. Brick by brick, we build.'],
  },
  reflection: {
    titles: ['A thoughtful day', 'Quiet stars', 'Slow and steady'],
    words: ['Patience', 'Focus', 'Learning'],
    tendencies: [
      'It sits quietly by {prop} for a while, turning something over.',
      'It takes its time today, doing one small thing at a time, carefully.',
    ],
    invite: ['pat', 'observatory'],
    reflections: ['Patience is a kind of strength.', 'The best things are built slowly, together.'],
  },
  creativity: {
    titles: ['A day for new ideas', 'Something unexpected', 'New patterns'],
    words: ['Creativity', 'Surprise', 'Originality'],
    tendencies: [
      'It keeps arranging little pebbles by {prop} into patterns only it understands.',
      'It tries walking backwards, then sideways, just to see what happens.',
    ],
    invite: ['play', 'arcade'],
    reflections: ['Being yourself is the most original thing there is.', 'Every new idea starts out a little strange.'],
  },
  dreams: {
    titles: ['Dreaming weather', 'A soft, slow day', 'Far-away stars'],
    words: ['Dreams', 'Imagination', 'Calm'],
    tendencies: [
      'It gazes up past {prop} for a long time, as if listening to something far away.',
      'It moves a little slower today, half in a daydream.',
    ],
    invite: ['rest', 'pat'],
    reflections: ['Rest is part of the journey, not a break from it.', 'Dreams are plans that are still finding their feet.'],
  },
  change: {
    titles: ['A day of quiet strength', 'Deep roots', 'Turning a corner'],
    words: ['Strength', 'Change', 'Renewal'],
    tendencies: [
      'It seems a little surer of itself today, standing firm beside {prop}.',
      'It works its way through one small, hard thing today, and looks pleased with itself.',
    ],
    invite: ['feed', 'play'],
    reflections: ['Every ending is also a doorway.', 'Strength grows in the places that were hard.'],
  },
  quiet: {
    titles: ['A quiet sky', 'An open day', 'A blank page'],
    words: ['Calm', 'Freedom', 'Choice'],
    tendencies: [
      'Nothing much is stirring in its sky today, so the day is wide open: what happens next is up to the two of you.',
      'It’s a calm day in its sky, the kind that leaves plenty of room for its own ideas.',
    ],
    invite: ['play', 'pat'],
    reflections: ['A quiet day is a day you get to write yourself.', 'The sky may offer a direction, but the journey is built together.'],
  },
}

/** How today's aspect feels, in a sentence (the transit's mood). */
export const AS_THE_SKY_SAYS: Record<'flow' | 'tension' | 'blend', string[]> = {
  flow: ['Today’s sky seems to make things feel easy.', 'There’s an easy, open feeling in its sky today.'],
  tension: ['Something in today’s sky gives it a little nudge, the kind that helps it grow.', 'Its sky has a bit of a push in it today, a good kind of challenge.'],
  blend: ['Today’s sky and its own seem to line up.', 'Its own sky and today’s are close together, like two notes in tune.'],
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
