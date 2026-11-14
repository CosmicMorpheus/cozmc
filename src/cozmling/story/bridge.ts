/* ============================================================
   THE BRIDGE AFTER THE RAIN: the first choice story.

   Original COZMC draft. The story is draft 0.2 from the COZMC philosophy handoff, with a few
   additions marked below. The twelve opening lines (one per archetype) are from the COZMC zodiac
   writing review (November 13, 2026); they let the Cozmling feel the moment without leaning
   toward any choice. Looking closely, asking for help and resting are equally good first steps,
   and every route ends safely with a friend nearby. Fiction: no claim about today's sky.
   ============================================================ */
import type { ChoiceStory } from './choice'
import type { Archetype } from './voices'

/** How each archetype meets the washed-out bridge, before the player decides anything. */
const OPENINGS: Record<Archetype, string> = {
  Pathfinder: "Oh. This was supposed to be the good part of the morning.",   // Aries
  Keeper: "It misses the bridge the way it misses a familiar voice.",   // Taurus
  Messenger: "It knows one thing. It misses the bridge. All the other thoughts are talking at once.",   // Gemini
  Nurturer: "Its friend is here, and the sad part of the morning feels a little less lonely.",   // Cancer
  "Radiant Heart": "It wants to say something brave, then finds it doesn’t have to yet.",   // Leo
  Inventor: "It remembers when the bridge was only an idea. The idea hadn’t felt nearly this complicated.",   // Virgo
  Harmonizer: "It can miss the bridge and still be glad its friend came. Both feelings belong on the bank.",   // Libra
  Seeker: "The first feeling has a name. The feeling underneath it might take a little longer.",   // Scorpio
  Wanderer: "It thought it knew what kind of morning this would be. The Grove had a different opening line.",   // Sagittarius
  Builder: "It had put real care into the bridge. Two loose planks don’t undo that.",   // Capricorn
  Visionary: "It’s still the same Grove. Funny how two loose planks can change the whole picture.",   // Aquarius
  Dreamer: "In its mind, the disappointment looks like a little cloud with the whole sky around it.",   // Pisces
}

export const BRIDGE: ChoiceStory = {
  id: 'bridge-after-rain',
  version: 'draft-0.3',
  status: 'draft',
  title: 'The Bridge After the Rain',
  minutes: 3,
  entry: 'S0',
  openings: OPENINGS,
  provenance: {
    kind: 'original',
    label: 'Original COZMC draft story',
    notes: 'Draft 0.2 from the philosophy handoff. Added in 0.3: the Cozmling’s name; its voice (an opening line per archetype, and its line for noticing, asking for help, resting and a small win); a first line in “A new plan” for each route that leads there; a question before the second choice; and “plans” for “sketch” in “Another view”, a route with no sketch.',
  },
  nodes: {
    S0: {
      text: [
        'Yesterday, {name} built a small bridge over the Grove’s stream. This morning, rain has pushed two planks loose. The crossing is closed, and the stepping stones are hidden beneath the water.',
        '{name} sits on the bank. All that work, it thinks.',
        'A friend arrives with a warm snack. The friend does not rush to explain the feeling away.',
      ],
      voice: { at: 3, line: 'opening' },
      prompt: 'What would you like to do first?',
      choices: [
        { id: 'A', label: 'Look closely at what happened.', to: 'S1A' },
        { id: 'B', label: 'Ask a friend to help make a new plan.', to: 'S1B' },
        { id: 'C', label: 'Rest together and return later.', to: 'S1C' },
      ],
    },
    S1A: {
      text: [
        'From the safe bank, you notice leaves gathered near the bridge.',
        'You sketch where the water flows. The bridge is still broken, but the problem looks a little clearer.',
      ],
      voice: { at: 1, line: 'noticing' },
      prompt: 'What would you like to do next?',
      choices: [
        { id: 'A1', label: 'Share the sketch and plan a stronger crossing.', to: 'E1' },
        { id: 'A2', label: 'Keep observing from the bank and decide tomorrow.', to: 'E2' },
      ],
    },
    S1B: {
      text: [
        'Your friend has ideas, too. One plan uses fewer materials. Another leaves more room for high water. You cannot know everything yet, but you can listen and compare.',
      ],
      voice: { at: 0, line: 'asking-for-help' },
      prompt: 'What would you like to do next?',
      choices: [
        { id: 'B1', label: 'Draw a plan together and test a small model on dry ground.', to: 'E1' },
        { id: 'B2', label: 'Ask another neighbor what they have noticed before choosing.', to: 'E3' },
      ],
    },
    S1C: {
      text: [
        'You share the snack away from the water. The bridge is not fixed, and it is still all right to take a break.',
        'Your friend stays beside you.',
      ],
      voice: { at: 1, line: 'resting' },
      prompt: 'What would you like to do next?',
      choices: [
        { id: 'C1', label: 'Return later and make a plan together.', to: 'E1' },
        { id: 'C2', label: 'Leave a safe-path note for visitors and stop for today.', to: 'E4' },
      ],
    },
    E1: {
      arrivals: {
        A1: 'You spread the sketch on a flat rock, and your friend points at the leaves: that’s where the water pushed hardest.',
        B1: 'Your friend’s two ideas turn into one: fewer materials, and room for high water.',
        C1: 'After the snack and a rest, things feel a little lighter. You come back to the stream together.',
      },
      text: [
        'On dry ground, you try a small model. One part wobbles. You change it together.',
        'The real crossing stays closed until it can be repaired safely, but now there is a plan and someone to share it with.',
      ],
      voice: { at: 1, line: 'small-win' },
      ending: {
        id: 'E1', title: 'A new plan', outcome: 'A plan for a safer crossing, made and tested together.',
        invitation: 'Try one small step on a task, or ask someone to think it through with you.',
        reflection: 'A setback can leave room for a new plan and a helping hand.',
      },
    },
    E2: {
      text: ['You save the sketch and mark the crossing closed. Nothing needs to be decided this minute. Tomorrow, you will have your observations to help you begin.'],
      ending: {
        id: 'E2', title: 'Time to notice', outcome: 'The crossing marked closed, and the sketch saved for tomorrow.',
        invitation: 'Notice one detail before deciding what to do next.',
        reflection: 'Looking carefully can be part of moving forward.',
      },
    },
    E3: {
      text: ['A neighbor remembers where the stream rose last season. Their memory adds something your plans could not show. Together, you choose a safe meeting place to plan the repair another day.'],
      ending: {
        id: 'E3', title: 'Another view', outcome: 'A neighbor’s memory added, and a safe place chosen to plan the repair.',
        invitation: 'Ask someone what they have noticed about a shared problem.',
        reflection: 'Another person’s view can make the picture larger.',
      },
    },
    E4: {
      text: ['Your note helps visitors find the longer, dry path. The bridge can wait. You and your friend head home, knowing where to return when you have more energy.'],
      ending: {
        id: 'E4', title: 'Enough for today', outcome: 'The crossing closed, a safe path marked, and time to rest.',
        invitation: 'If you need a pause, let yourself take one. You can come back later.',
        reflection: 'Rest and care can belong to the same day.',
      },
    },
  },
}
