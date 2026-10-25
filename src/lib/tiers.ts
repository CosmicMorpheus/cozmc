/* Holder ranks, sized like the cosmos. Amounts are whole COZMC. */

export interface Tier {
  id: string
  name: string
  min: number
  color: string
  /** pixel art: '.' empty, a/b/c = palette slots */
  art: string[]
  palette: [string, string, string]
}

export const TIERS: Tier[] = [
  {
    id: 'stardust', name: 'Stardust', min: 0, color: '#c9c9c9', palette: ['#8f8f8f', '#ffffff', '#5a5a5a'],
    art: [
      '.....a.....',
      '...........',
      '.a.......a.',
      '.....b.....',
      '....bbb....',
      'a..bbbbb..a',
      '....bbb....',
      '.....b.....',
      '.a.......a.',
      '...........',
      '.....a.....',
    ],
  },
  {
    id: 'comet', name: 'Comet', min: 10_000, color: '#59e6ff', palette: ['#2a7f99', '#59e6ff', '#e8fbff'],
    art: [
      '...........',
      '.......bcc.',
      '......bccc.',
      '.....abbcc.',
      '....aab.b..',
      '...aa......',
      '..aa.......',
      '.a.........',
      'a..........',
      '...........',
      '...........',
    ],
  },
  {
    id: 'moon', name: 'Moon', min: 100_000, color: '#efe6c2', palette: ['#efe6c2', '#a99f7a', '#fffbe9'],
    art: [
      '...aaaa....',
      '..aaca.....',
      '.aaca......',
      '.aca.......',
      'aaca.......',
      'aaab.......',
      'aaab.......',
      '.aab.......',
      '.aaab......',
      '..aaab.....',
      '...aaaa....',
    ],
  },
  {
    id: 'planet', name: 'Planet', min: 1_000_000, color: '#8dff6a', palette: ['#3f9a2c', '#8dff6a', '#f6e1a8'],
    art: [
      '...........',
      '....bbb....',
      '..bbbbbbc..',
      '.bbabbbccc.',
      '.babbbcca..',
      'cccccccaaa.',
      '.aaccaaaaa.',
      '..aaaaaaa..',
      'c...aaa....',
      '...........',
      '...........',
    ],
  },
  {
    id: 'star', name: 'Star', min: 10_000_000, color: '#ffb020', palette: ['#ff6a1a', '#ffb020', '#fff4c2'],
    art: [
      '.....a.....',
      '.....a.....',
      '....aba....',
      '...abbba...',
      'aaabbcbbaaa',
      '...abbba...',
      '....aba....',
      '.....a.....',
      '.....a.....',
      '...........',
      '...........',
    ],
  },
  {
    id: 'blackhole', name: 'Black Hole', min: 50_000_000, color: '#b06bff', palette: ['#b06bff', '#ff8ad8', '#3a1a66'],
    art: [
      '...aaaaa...',
      '..abbbbba..',
      '.abc...cba.',
      'abc.....cba',
      'ab.......ba',
      'ab.......ba',
      'ab.......ba',
      'abc.....cba',
      '.abc...cba.',
      '..abbbbba..',
      '...aaaaa...',
    ],
  },
]

export const tierOf = (whole: number) => [...TIERS].reverse().find(t => whole >= t.min) ?? TIERS[0]
export const nextTier = (t: Tier) => TIERS[TIERS.indexOf(t) + 1] ?? null
export const rangeLabel = (t: Tier) => {
  const n = nextTier(t)
  const k = (v: number) => (v >= 1e6 ? `${v / 1e6}M` : v >= 1e3 ? `${v / 1e3}K` : String(v))
  return n ? `${t.min ? k(t.min) : '1'} – ${k(n.min)}` : `${k(t.min)}+`
}
