/* ============================================================
   THE FADING STARFLOWER: a three-visit story for a Cozmling at Cadet stage or older.

   Original COZMC draft (Story Mode, November 14, 2026), after the starflower premise in the
   Cozmling storytelling direction. The same for every Starprint: only the voice lines differ.

   Visit 1: by a mossy stone near the edge of the Grove, a starflower is fading, and the evening smells
   of frost. Three equally good choices, each leaving something the next visits remember:
     Stay a while    the Cozmling sees how the petals fold, and can share it later (an observation)
     Ask for help    the lamplighter promises a lantern, after the evening route (a promise, kept by
                     the world the next day: the lantern appears beside the same stone)
     Rest for now    its friend sits with it, and offers to walk back together next time (an offer)
   Visit 2: the frost has come. Its friend, the lantern or the walk, depending on what happened.
   Visit 3: the flower has gone to seed. A sketch, the lamplighter's question, or where to go next.

   The flower follows the world's rule, the same for everyone and every choice: frost falls the night
   after it is found, and it has gone to seed two days later. Nothing anyone does saves or harms it.
   Characters act on what they saw, heard or guessed, on their own errands, and on what they promised.
   Every visit ends at a natural place to stop. No choice earns a reward, a score or a rank.
   ============================================================ */
import type { Arc, Line, SceneCtx } from './arc'
import { daysBetween, knows, type World } from './world'

export type Flower = 'fading' | 'curled' | 'seeds'
/** The world's rule for the starflower: frost the night after it is found, seeds two days after. */
export function flowerOn(started: string | null | undefined, day: string): Flower {
  if (!started) return 'fading'
  const d = daysBetween(started, day)
  return d <= 0 ? 'fading' : d === 1 ? 'curled' : 'seeds'
}

const NUMBER = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const flower = (c: SceneCtx) => flowerOn(c.arc?.started, c.day)
const FLOWER_LINE: Record<Flower, string> = {
  fading: 'Near the edge of the Cosmic Grove, beside a mossy stone, {name} finds a starflower. Its five petals still glow, but only just, like a lamp turned low.',
  curled: 'The frost came in the night. The starflower’s petals are curled tight, edged with silver.',
  seeds: 'The starflower has closed for the season. A few silver seeds rest in the moss where it stood.',
}
/** After two or more story days away, a word about the time that has passed. */
const catchUp = (c: SceneCtx): Line[] => (c.away != null && c.away >= 2 ? [`It has been ${NUMBER[c.away] ?? c.away} days since {name} was last by the mossy stone.`] : [])
const branchIs = (b: string, visits: number) => (a: { branch: string | null; visits: unknown[] } | null) => !!a && a.branch === b && a.visits.length === visits
const lanternAt = (w: World) => w.objects.lantern?.at ?? null

export const STARFLOWER: Arc = {
  id: 'starflower',
  version: 'draft-1',
  status: 'draft',
  title: 'The Fading Starflower',
  minStage: 'cadet',
  visits: 3,
  stop: 'That’s all for today. The stone will still be there tomorrow.',
  closing: 'Nobody knows yet whether the seeds will grow. They’ll wait in the moss through the cold.',
  picture: c => ({ flower: flower(c), lantern: lanternAt(c.world) ?? 'none' }),
  scenes: [
    /* ---------------- visit 1 ---------------- */
    {
      id: 'find',
      when: a => a === null,
      lines: () => [
        FLOWER_LINE.fading,
        { voice: 'noticing' },
        'The air smells of frost tonight. Its friend is somewhere nearby, gathering moss for a new nest. Down the path, the lamplighter has started the evening route, one lantern at a time.',
      ],
      prompt: 'What would you like to do?',
      choices: () => [
        {
          id: 'stay', label: 'Stay a while.',
          effects: () => [{ do: 'start', arc: 'starflower' }, { do: 'branch', arc: 'starflower', branch: 'stay' }, { do: 'observe', fact: 'starflower', who: 'cozmling' }, { do: 'observe', fact: 'petal-fold', who: 'cozmling' }],
          outcome: () => [
            '{name} stays by the stone as the light leaves the Grove. Just before dark, the petals fold, one by one, toward the warm side of the stone.',
            'Nobody else is there to see it. {name} keeps the picture in its mind all the way home.',
          ],
        },
        {
          id: 'ask', label: 'Ask for help.',
          effects: () => [
            { do: 'start', arc: 'starflower' }, { do: 'branch', arc: 'starflower', branch: 'ask' },
            { do: 'observe', fact: 'starflower', who: 'cozmling' }, { do: 'tell', fact: 'starflower', from: 'cozmling', to: 'lamplighter' },
            { do: 'promise', id: 'lantern', by: 'lamplighter', to: 'cozmling', what: 'bring a lantern to the mossy stone after the evening route', dueInDays: 1, note: 'The lamplighter left a lantern by the mossy stone, after the route.',
              then: [{ do: 'place', object: 'lantern', at: 'stone' }, { do: 'observe', fact: 'petals-curled', who: 'lamplighter' }, { do: 'guess', fact: 'frost', who: 'lamplighter' }] },
          ],
          outcome: () => [
            '{name} hurries down the path and catches up with the lamplighter.',
            '“A starflower by the mossy stone? I can bring a lantern,” says the lamplighter, “but not until my route is done. Every path needs its light first. I’ll come as soon as I can.”',
            'It’s a promise. {name} heads home to wait.',
          ],
        },
        {
          id: 'rest', label: 'Rest for now.',
          effects: () => [
            { do: 'start', arc: 'starflower' }, { do: 'branch', arc: 'starflower', branch: 'rest' },
            { do: 'observe', fact: 'starflower', who: 'cozmling' }, { do: 'observe', fact: 'starflower', who: 'friend' },
            { do: 'offer', id: 'walk-back', by: 'friend', what: 'walk back together after the next visit' },
          ],
          outcome: () => [
            '{name} sits down beside the stone. Before long, its friend wanders over and sits too, without asking anything.',
            'They watch the starflower glow until it’s time to go. “Come back tomorrow?” says its friend. “We could walk home together after.”',
          ],
        },
      ],
    },

    /* ---------------- visit 2 ---------------- */
    {
      id: 'share',
      when: branchIs('stay', 1),
      lines: c => [
        ...catchUp(c), FLOWER_LINE[flower(c)], { voice: 'setback' },
        knows(c.world, 'friend', 'starflower')
          ? 'Its friend is there too, looking at the curled petals. “What did you see, that last evening?”'
          : 'Its friend finds {name} there. “I didn’t see you all evening,” it says. “What happened here?”',
      ],
      prompt: 'What would you like to do?',
      choices: () => [
        {
          id: 'show', label: 'Show your friend how the petals folded.',
          effects: () => [{ do: 'tell', fact: 'petal-fold', from: 'cozmling', to: 'friend' }, { do: 'observe', fact: 'starflower', who: 'friend' }],
          outcome: () => [
            '{name} points to the warm side of the stone. “They folded this way, toward the warmth,” it says.',
            'Its friend looks for a long time. “I would never have known,” it says quietly.',
          ],
        },
        {
          id: 'later', label: 'Keep it to yourself for now.',
          effects: () => [{ do: 'thread', id: 'fold-kept', note: 'a detail kept for another day' }],
          outcome: () => ['“I’ll tell you another day,” says {name}. Its friend nods. Some things are easier to share later.'],
        },
      ],
    },
    {
      id: 'lantern',
      when: branchIs('ask', 1),
      lines: c => {
        const at = c.world.objects.lantern
        return [
          ...catchUp(c), FLOWER_LINE[flower(c)], { voice: 'setback' },
          at?.at === 'stone'
            ? `Beside the same stone stands a small brass lantern${at.since === c.day ? ', its glass still warm' : ''}. The lamplighter kept the promise, once the route was done.`
            : 'The lamplighter hasn’t come yet. The route must be long tonight.',
          ...(at?.at === 'stone' ? [{ voice: 'small-win' } as Line] : []),
          at?.at === 'stone'
            ? 'Its friend comes over the stream and stops. “Where did that lantern come from?”'
            : 'Its friend comes over the stream to wait with {name}.',
        ]
      },
      prompt: 'What would you like to do?',
      choices: () => [
        {
          id: 'tell', label: 'Tell your friend about the lamplighter’s promise.',
          effects: () => [{ do: 'tell', fact: 'promise:lantern', from: 'cozmling', to: 'friend' }, { do: 'observe', fact: 'lantern', who: 'friend' }],
          outcome: () => [
            '“I asked for help, and the lamplighter came after the route,” says {name}.',
            'Its friend smiles at the lantern. “Then we’re not the only ones looking after this place.”',
          ],
        },
        {
          id: 'sit', label: 'Sit by the lantern together.',
          effects: () => [{ do: 'observe', fact: 'lantern', who: 'friend' }, { do: 'thread', id: 'lantern-evening', note: 'an evening by the lantern' }],
          outcome: () => ['They sit in the small circle of light without saying much. The lantern hums softly, the way old lanterns do.'],
        },
      ],
    },
    {
      id: 'walk',
      when: branchIs('rest', 1),
      lines: c => [
        ...catchUp(c), FLOWER_LINE[flower(c)], { voice: 'setback' },
        'Its friend is already by the stone. It saw the frost too. “I hoped it would hold on a little longer,” it says.',
        ...(c.world.offers['walk-back'] ? ['“Shall we walk back together, like we said?”'] : []),
      ],
      prompt: 'What would you like to do?',
      choices: () => [
        {
          id: 'walk', label: 'Walk back together, the long way round.',
          effects: () => [{ do: 'thread', id: 'walked-together', note: 'a walk home together' }],
          outcome: () => ['They take the long way, past the glowing mushrooms and over the little stream. Neither of them hurries.'],
        },
        {
          id: 'linger', label: 'Stay by the stone a little longer.',
          effects: () => [{ do: 'thread', id: 'lingered', note: 'a little longer by the stone' }],
          outcome: () => ['{name} isn’t ready to go yet. Its friend waits nearby, close but not too close, until it is.'],
        },
      ],
    },

    /* ---------------- visit 3 ---------------- */
    {
      id: 'sketch',
      when: branchIs('stay', 2),
      last: true,
      lines: c => [
        ...catchUp(c), FLOWER_LINE[flower(c)], { voice: 'noticing' },
        '{name} sits down to sketch the mossy stone, so it won’t forget the starflower.',
        knows(c.world, 'cozmling', 'petal-fold') ? 'In its sketch, the petals fold toward the warm side of the stone, just the way it saw them that night.' : 'It draws the petals as it remembers them.',
        knows(c.world, 'friend', 'petal-fold') ? 'Its friend adds the stream and the moss, and leaves the petals for {name} to draw.' : 'Its friend watches, curious about the way the petals lean.',
      ],
      prompt: 'What would you like to do with the sketch?',
      choices: c => [
        {
          id: 'keep', label: 'Keep the sketch by its bed.',
          effects: () => [{ do: 'place', object: 'sketch', at: 'home' }],
          outcome: () => ['The sketch goes up by its bed, where it can see it before sleep.'],
        },
        {
          id: 'give', label: 'Give the sketch to its friend.',
          effects: () => [{ do: 'place', object: 'sketch', at: 'friend' }, ...(knows(c.world, 'friend', 'petal-fold') ? [] : [{ do: 'tell' as const, fact: 'petal-fold', from: 'cozmling' as const, to: 'friend' as const }])],
          outcome: () => ['Its friend holds the sketch carefully. “I’ll keep it somewhere safe,” it says.'],
        },
      ],
    },
    {
      id: 'return',
      when: branchIs('ask', 2),
      last: true,
      lines: c => [
        ...catchUp(c), FLOWER_LINE[flower(c)], { voice: 'noticing' },
        knows(c.world, 'lamplighter', 'petals-curled')
          ? 'The lamplighter stops by on the morning route. “When I came with the lantern, the petals were already curled,” they say. “I think the frost got here first. I can’t be sure.”'
          : 'The lamplighter stops by on the morning route.',
        '“Shall I leave the lantern here for the path home,” they ask, “or take it back for my route?”',
      ],
      prompt: 'What would you like to do?',
      choices: () => [
        {
          id: 'leave', label: 'Leave it here for the path home.',
          effects: () => [{ do: 'place', object: 'lantern', at: 'path' }],
          outcome: () => ['The lamplighter sets the lantern on the path that leads home. Tonight, anyone walking back will see the way.'],
        },
        {
          id: 'back', label: 'Give it back for the route.',
          effects: () => [{ do: 'place', object: 'lantern', at: 'lamplighter' }],
          outcome: () => ['“Then it will light someone else’s way,” says the lamplighter, lifting it carefully. “Thank you for asking me.”'],
        },
      ],
    },
    {
      id: 'next',
      when: branchIs('rest', 2),
      last: true,
      lines: c => [
        ...catchUp(c), FLOWER_LINE[flower(c)], { voice: 'noticing' },
        c.world.threads['walked-together']
          ? 'On the way back, its friend asks, “Where should we go next time?”'
          : 'This time they walk back together. Halfway home, its friend asks, “Where should we go next time?”',
      ],
      prompt: 'Where would you like to go?',
      choices: () => [
        {
          id: 'moon', label: 'Up to the Moon Base, to see the stars up close.',
          effects: () => [{ do: 'thread', id: 'next-walk', note: 'the Moon Base' }],
          outcome: () => ['“The Moon Base it is,” says its friend. “Maybe not tomorrow. But soon.”'],
        },
        {
          id: 'stream', label: 'Along the stream, to where the water sings.',
          effects: () => [{ do: 'thread', id: 'next-walk', note: 'along the stream' }],
          outcome: () => ['“I know the place,” says its friend. “Let’s go when the frost has gone.”'],
        },
      ],
    },
  ],
}

/** Every Story Mode arc, in the order the director considers new ones. */
export const ARCS: Arc[] = [STARFLOWER]
