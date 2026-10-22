/* ============================================================
   DAILY WISDOM
   Every line here has a known source. Famous fakes ("Be the change",
   most internet Rumi/Buddha, "You have power over your mind…") are
   deliberately left out. Proverbs are traceable to their original
   language. To add one: { t, a, src?, y? } — y is the year (negative = BC).
   ============================================================ */

export interface Wisdom { t: string; a: string; src?: string; y?: number; ctx?: string }

export const WISDOM: Wisdom[] = [
  // ---- the Stoics & the ancients ----
  { a: 'Marcus Aurelius', src: 'Meditations 5.20', y: 175, t: 'The impediment to action advances action. What stands in the way becomes the way.' },
  { a: 'Marcus Aurelius', src: 'Meditations 7.47', y: 175, t: 'Look round at the courses of the stars, as if you were going along with them.' },
  { a: 'Marcus Aurelius', src: 'Meditations 4.49', y: 175, t: 'Be like the promontory against which the waves continually break; but it stands firm and tames the fury of the water around it.' },
  { a: 'Marcus Aurelius', src: 'Meditations 10.16', y: 175, t: 'Waste no more time arguing about what a good man should be. Be one.' },
  { a: 'Marcus Aurelius', src: 'Meditations 4.17', y: 175, t: 'Do not act as if you were going to live ten thousand years. While you live, while it is in your power, be good.' },
  { a: 'Marcus Aurelius', src: 'Meditations 7.59', y: 175, t: 'Look within. Within is the fountain of good, and it will ever bubble up, if you will ever dig.' },
  { a: 'Seneca', src: 'Letters to Lucilius 13.4', y: 64, t: 'We suffer more often in imagination than in reality.' },
  { a: 'Seneca', src: 'On the Shortness of Life', y: 49, t: 'It is not that we have a short time to live, but that we waste a lot of it.' },
  { a: 'Seneca', src: 'Letters to Lucilius 28.1', y: 64, t: 'You must change your soul, not your sky.' },
  { a: 'Epictetus', src: 'Discourses 3.23', y: 108, t: 'First say to yourself what you would be; and then do what you have to do.' },
  { a: 'Epictetus', src: 'Enchiridion 5', y: 108, t: 'Men are disturbed not by things, but by the opinions they have of things.' },
  { a: 'Socrates', src: 'Plato, Apology 38a', y: -399, t: 'The unexamined life is not worth living.' },
  { a: 'Delphic maxim', src: 'Temple of Apollo at Delphi', t: 'Know thyself.' },
  { a: 'Heraclitus', src: 'Fragment B91', y: -500, t: 'You cannot step twice into the same river.' },
  { a: 'Heraclitus', src: 'Fragment B119', y: -500, t: 'Character is destiny.' },
  { a: 'Aristotle', src: 'Nicomachean Ethics', y: -340, t: 'One swallow does not make a summer, nor does one day.' },
  { a: 'Aristotle', src: 'Nicomachean Ethics', y: -340, t: 'We become just by doing just acts, temperate by doing temperate acts, brave by doing brave acts.' },
  { a: 'Diogenes', src: 'Diogenes Laërtius 6.63', y: -350, ctx: 'Asked where he came from:', t: 'I am a citizen of the world.' },
  { a: 'Ovid', src: 'Epistulae ex Ponto 4.10', y: 15, t: 'Dripping water hollows out stone.' },
  { a: 'Lao Tzu', src: 'Tao Te Ching 64', y: -400, t: 'A journey of a thousand miles begins with a single step.' },
  { a: 'Lao Tzu', src: 'Tao Te Ching 78', y: -400, t: 'Nothing in the world is softer or weaker than water, yet nothing is better at overcoming the hard and strong.' },
  { a: 'Lao Tzu', src: 'Tao Te Ching 33', y: -400, t: 'He who overcomes others is strong; he who overcomes himself is mighty.' },
  { a: 'Confucius', src: 'Analects, Book 9', y: -480, t: 'When the year becomes cold, then we know how the pine and the cypress are the last to lose their leaves.' },
  { a: 'Confucius', src: 'Analects, Book 15', y: -480, t: 'What you do not want done to yourself, do not do to others.' },
  { a: 'Sun Tzu', src: 'The Art of War', y: -500, t: 'Supreme excellence consists in breaking the enemy’s resistance without fighting.' },
  { a: 'The Buddha', src: 'Dhammapada 5', y: -300, t: 'Hatred is never appeased by hatred in this world. By non-hatred alone is hatred appeased.' },
  { a: 'Bhagavad Gita', src: '2.47', y: -200, t: 'You have the right to work, but never to the fruit of work.' },

  // ---- thinkers ----
  { a: 'Friedrich Nietzsche', src: 'Thus Spoke Zarathustra', y: 1883, t: 'One must still have chaos in oneself to be able to give birth to a dancing star.' },
  { a: 'Friedrich Nietzsche', src: 'Twilight of the Idols', y: 1889, t: 'If we have our own why of life, we shall get along with almost any how.' },
  { a: 'Friedrich Nietzsche', src: 'Twilight of the Idols', y: 1889, t: 'What does not destroy me makes me stronger.' },
  { a: 'Søren Kierkegaard', src: 'Journals', y: 1843, t: 'Life can only be understood backwards; but it must be lived forwards.' },
  { a: 'Immanuel Kant', src: 'Critique of Practical Reason', y: 1788, t: 'Two things fill the mind with ever new and increasing admiration and awe: the starry heavens above and the moral law within.' },
  { a: 'Blaise Pascal', src: 'Pensées', y: 1660, t: 'The sole cause of man’s unhappiness is that he does not know how to stay quietly in his room.' },
  { a: 'Blaise Pascal', src: 'Pensées', y: 1660, t: 'The eternal silence of these infinite spaces frightens me.' },
  { a: 'Baruch Spinoza', src: 'Ethics', y: 1677, t: 'All things excellent are as difficult as they are rare.' },
  { a: 'Henry David Thoreau', src: 'Walden', y: 1854, t: 'I went to the woods because I wished to live deliberately, to front only the essential facts of life, and see if I could not learn what it had to teach, and not, when I came to die, discover that I had not lived.' },
  { a: 'Ralph Waldo Emerson', src: 'Experience', y: 1844, t: 'The years teach much which the days never know.' },
  { a: 'Albert Camus', src: 'Return to Tipasa', y: 1952, t: 'In the depth of winter, I finally learned that within me there lay an invincible summer.' },
  { a: 'Albert Camus', src: 'The Myth of Sisyphus', y: 1942, t: 'The struggle itself toward the heights is enough to fill a man’s heart. One must imagine Sisyphus happy.' },
  { a: 'Viktor Frankl', src: 'Man’s Search for Meaning', y: 1946, t: 'Everything can be taken from a man but one thing: the last of the human freedoms, to choose one’s attitude in any given set of circumstances, to choose one’s own way.' },
  { a: 'Fyodor Dostoevsky', src: 'The Brothers Karamazov', y: 1880, t: 'Above all, don’t lie to yourself.' },
  { a: 'Leo Tolstoy', src: 'Three Methods of Reform', y: 1900, t: 'Everybody thinks of changing humanity, and nobody thinks of changing himself.' },
  { a: 'Carl Jung', src: 'Letter to Fanny Bowditch', y: 1916, t: 'Who looks outside, dreams; who looks inside, awakes.' },
  { a: 'Franz Kafka', src: 'Letter to Oskar Pollak', y: 1904, t: 'A book must be the axe for the frozen sea within us.' },
  { a: 'Richard Feynman', src: 'Cargo Cult Science', y: 1974, t: 'The first principle is that you must not fool yourself, and you are the easiest person to fool.' },
  { a: 'Albert Einstein', src: 'The Saturday Evening Post', y: 1929, t: 'Imagination is more important than knowledge. For knowledge is limited, whereas imagination embraces the entire world.' },
  { a: 'Martin Luther King Jr.', src: 'Strength to Love', y: 1963, t: 'Darkness cannot drive out darkness; only light can do that. Hate cannot drive out hate; only love can do that.' },
  { a: 'Annie Dillard', src: 'The Writing Life', y: 1989, t: 'How we spend our days is, of course, how we spend our lives.' },
  { a: 'Bruce Lee', src: 'The Pierre Berton Show', y: 1971, t: 'Empty your mind, be formless, shapeless, like water. Water can flow or it can crash. Be water, my friend.' },
  { a: 'Miyamoto Musashi', src: 'The Book of Five Rings', y: 1645, t: 'Do nothing which is of no use.' },
  { a: 'Layman Pang', src: 'Zen verse', y: 800, t: 'Supernatural power and marvelous activity: drawing water and carrying firewood.' },
  { a: 'Matsuo Bashō', src: 'Words by a Brushwood Gate', y: 1693, t: 'Do not seek to follow in the footsteps of the men of old; seek what they sought.' },
  { a: 'Kobayashi Issa', src: 'Haiku', y: 1820, t: 'O snail, climb Mount Fuji, but slowly, slowly!' },
  { a: 'Mizuta Masahide', src: 'Haiku', y: 1700, t: 'Barn’s burnt down. Now I can see the moon.' },
  { a: 'Rumi', src: 'tr. Coleman Barks', y: 1250, t: 'Out beyond ideas of wrongdoing and rightdoing, there is a field. I’ll meet you there.' },

  // ---- poets & storytellers ----
  { a: 'Rainer Maria Rilke', src: 'The Book of Hours', y: 1905, t: 'Let everything happen to you: beauty and terror. Just keep going. No feeling is final.' },
  { a: 'Rainer Maria Rilke', src: 'Letters to a Young Poet', y: 1903, t: 'Live the questions now. Perhaps you will then gradually, without noticing it, live along some distant day into the answer.' },
  { a: 'Mary Oliver', src: 'The Summer Day', y: 1990, t: 'Tell me, what is it you plan to do with your one wild and precious life?' },
  { a: 'Mary Oliver', src: 'Sometimes', y: 2008, t: 'Instructions for living a life: Pay attention. Be astonished. Tell about it.' },
  { a: 'T. S. Eliot', src: 'Little Gidding', y: 1942, t: 'We shall not cease from exploration, and the end of all our exploring will be to arrive where we started and know the place for the first time.' },
  { a: 'William Blake', src: 'Auguries of Innocence', y: 1803, t: 'To see a World in a Grain of Sand and a Heaven in a Wild Flower, hold Infinity in the palm of your hand and Eternity in an hour.' },
  { a: 'Walt Whitman', src: 'Song of Myself', y: 1855, t: 'I am large, I contain multitudes.' },
  { a: 'Emily Dickinson', src: 'Poem 690', y: 1863, t: 'Forever is composed of nows.' },
  { a: 'Emily Dickinson', src: 'Poem 254', y: 1861, t: '“Hope” is the thing with feathers that perches in the soul, and sings the tune without the words, and never stops at all.' },
  { a: 'Robert Frost', src: 'A Servant to Servants', y: 1914, t: 'The best way out is always through.' },
  { a: 'Robert Frost', src: 'The Road Not Taken', y: 1916, t: 'Two roads diverged in a wood, and I took the one less traveled by, and that has made all the difference.' },
  { a: 'William Shakespeare', src: 'Hamlet', y: 1600, t: 'There is nothing either good or bad, but thinking makes it so.' },
  { a: 'Oscar Wilde', src: 'Lady Windermere’s Fan', y: 1892, t: 'We are all in the gutter, but some of us are looking at the stars.' },
  { a: 'Rabindranath Tagore', src: 'Fireflies', y: 1928, t: 'Faith is the bird that feels the light and sings when the dawn is still dark.' },
  { a: 'Kahlil Gibran', src: 'The Prophet', y: 1923, t: 'Work is love made visible.' },
  { a: 'Antonio Machado', src: 'Campos de Castilla', y: 1912, t: 'Traveler, there is no road; the road is made by walking.' },
  { a: 'Fernando Pessoa', src: 'as Ricardo Reis', y: 1933, t: 'To be great, be whole: exclude nothing, exaggerate nothing that is you.' },
  { a: 'Ernest Hemingway', src: 'A Farewell to Arms', y: 1929, t: 'The world breaks everyone and afterward many are strong at the broken places.' },
  { a: 'Antoine de Saint-Exupéry', src: 'The Little Prince', y: 1943, t: 'It is only with the heart that one can see rightly; what is essential is invisible to the eye.' },
  { a: 'Langston Hughes', src: 'Dreams', y: 1923, t: 'Hold fast to dreams, for if dreams die, life is a broken-winged bird that cannot fly.' },
  { a: 'Maya Angelou', src: 'Still I Rise', y: 1978, t: 'You may trod me in the very dirt, but still, like dust, I’ll rise.' },
  { a: 'J. R. R. Tolkien', src: 'The Fellowship of the Ring', y: 1954, t: 'All we have to decide is what to do with the time that is given us.' },
  { a: 'J. R. R. Tolkien', src: 'The Fellowship of the Ring', y: 1954, t: 'Not all those who wander are lost.' },
  { a: 'J. R. R. Tolkien', src: 'The Fellowship of the Ring', y: 1954, t: 'Even the smallest person can change the course of the future.' },
  { a: 'Ursula K. Le Guin', src: 'The Left Hand of Darkness', y: 1969, t: 'It is good to have an end to journey toward; but it is the journey that matters, in the end.' },
  { a: 'Frank Herbert', src: 'Dune', y: 1965, t: 'I must not fear. Fear is the mind-killer. Fear is the little-death that brings total obliteration. I will face my fear.' },
  { a: 'Carl Sagan', src: 'Cosmos', y: 1980, t: 'We are a way for the cosmos to know itself.' },
  { a: 'Carl Sagan', src: 'Contact', y: 1985, t: 'For small creatures such as we the vastness is bearable only through love.' },
  { a: 'Stephen Hawking', src: 'London Paralympics', y: 2012, t: 'Remember to look up at the stars and not down at your feet.' },
  { a: 'Hávamál', src: 'The Poetic Edda', y: 900, t: 'Cattle die, and kinsmen die, and so one dies one’s self; but a noble name will never die, if good renown one gets.' },

  // ---- proverbs ----
  { a: 'Turkish proverb', t: 'No matter how far you have gone on the wrong road, turn back.' },
  { a: 'Turkish proverb', t: 'He who seeks a faultless friend remains friendless.' },
  { a: 'Turkish proverb', t: 'A cup of coffee commits one to forty years of friendship.' },
  { a: 'Japanese proverb', t: 'Fall seven times, stand up eight.' },
  { a: 'Japanese proverb', t: 'Even dust, piled up, becomes a mountain.' },
  { a: 'Japanese saying', ctx: 'Ichi-go ichi-e, from the tea ceremony:', t: 'One time, one meeting. This moment will never come again.' },
  { a: 'Chinese proverb', t: 'Be not afraid of growing slowly; be afraid only of standing still.' },
  { a: 'Chinese proverb', t: 'A single spark can start a prairie fire.' },
  { a: 'Irish proverb', t: 'It is in the shelter of each other that the people live.' },
  { a: 'Zulu proverb', ctx: 'Umuntu ngumuntu ngabantu:', t: 'A person is a person through other people.' },
  { a: 'Ethiopian proverb', t: 'When spider webs unite, they can tie up a lion.' },
  { a: 'Haitian proverb', t: 'Beyond mountains, there are mountains.' },
  { a: 'Māori proverb', t: 'I walk backwards into the future with my eyes fixed on my past.' },
  { a: 'Arab proverb', t: 'Trust in God, but tie your camel.' },
  { a: 'Russian proverb', t: 'Measure seven times, cut once.' },
  { a: 'Korean proverb', t: 'Even if the sky falls, there is a hole to climb out of.' },
  { a: 'Persian adage', t: 'This too shall pass.' },
  { a: 'Latin motto', ctx: 'Per aspera ad astra:', t: 'Through hardships to the stars.' },
  { a: 'German proverb', t: 'Beginning is easy; continuing is an art.' },
  { a: 'Norwegian saying', t: 'There is no bad weather, only bad clothes.' },
]

/** Markus's six principles. */
export const PRINCIPLES = [
  { name: 'Purpose', line: 'Know what matters. Move toward it.' },
  { name: 'Presence', line: 'Make space for clarity, wisdom, and new ideas.' },
  { name: 'Discipline', line: 'Build small habits that support who you want to become.' },
  { name: 'Nature', line: "Respect life's rhythm: movement, stillness, growth, and change." },
  { name: 'Goodness', line: 'Protect the honest, kind, useful part of yourself.' },
  { name: 'Self-mastery', line: 'Choose where your energy goes. Keep practicing.' },
] as const

/* A fixed shuffle, so every visitor sees the same quote on the same day and
   cycling never repeats until the whole collection has gone by. */
const ORDER = (() => {
  const idx = WISDOM.map((_, i) => i)
  let s = 20261017
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]] }
  return idx
})()

const N = WISDOM.length
export const dayNumber = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000)
export const todayPos = () => dayNumber() % N
export const wisdomAt = (pos: number) => WISDOM[ORDER[((pos % N) + N) % N]]

export const dated = (y?: number) =>
  y == null ? '' : y < 0 ? `c. ${-y} BC` : y < 1000 ? `c. ${y} AD` : [1250, 1660, 1700, 1803, 1820].includes(y) ? `c. ${y}` : String(y)
export const byline = (w: Wisdom) => [w.src, dated(w.y)].filter(Boolean).join(' · ')
