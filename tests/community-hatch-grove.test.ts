/* Light the Grove's twelve zodiac lanterns: which signs glow for the community's shared count, in zodiac
   order, in both layouts, with every sign drawn. `npm test`. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GROVE_SIGNS, litSigns } from '../src/cozmling/community/communityHatch'
import { GroveLanterns } from '../src/cozmling/community/GroveLanterns'
import { ZODIAC_PATHS } from '../src/cozmling/components/zodiacPaths'
import { SIGNS } from '../src/cozmling/domain/starprint'

test('the lit signs are min(12, floor(12 x total / goal)): none at zero, all twelve at the goal', () => {
  // a three-contribution goal: one contribution lights four signs, two light eight, three light all twelve
  assert.deepEqual([0, 1, 2, 3, 4].map(total => litSigns(total, 3)), [0, 4, 8, 12, 12])
  assert.equal(litSigns(1, 1), 12, 'a goal of one: the first lantern lights the whole Grove')
  assert.deepEqual([0, 5, 11, 12, 30].map(total => litSigns(total, 12)), [0, 5, 11, 12, 12])
  assert.deepEqual([8, 9, 50, 99, 100].map(total => litSigns(total, 100)), [0, 1, 6, 11, 12], 'a big goal: a sign only once its share is reached')
  assert.equal(litSigns(7, 5), 12)
  // never more than twelve, never less than none, and nothing from a goal that isn't valid
  for (const [total, goal] of [[1, 0], [1, -3], [1, 1.5], [1, NaN], [NaN, 3], [-1, 3], [2, Infinity]] as const) assert.equal(litSigns(total, goal), 0, `${total} of ${goal}`)
  // the same count always gives the same signs: it depends on the shared count alone
  assert.equal(litSigns(2, 3), litSigns(2, 3))
})

test('the twelve lanterns run in zodiac order, Aries to Pisces, and every sign has its own drawn glyph', () => {
  assert.deepEqual([...GROVE_SIGNS], SIGNS.map(s => s.sign))
  assert.deepEqual([...GROVE_SIGNS], ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'])
  const glyphs = GROVE_SIGNS.map(sign => ZODIAC_PATHS[sign].join(' '))
  assert.ok(glyphs.every(g => /^M/.test(g)), 'every sign is drawn')
  assert.equal(new Set(glyphs).size, 12, 'twelve different glyphs')
})

test('both layouts draw all twelve lanterns, lit in zodiac order, with a label that says which', () => {
  const lanterns = (html: string, layout: 'wide' | 'narrow') => {
    const svg = html.slice(html.indexOf(`data-layout="${layout}"`), html.indexOf('</svg>', html.indexOf(`data-layout="${layout}"`)))
    return [...svg.matchAll(/data-sign="([a-z]+)" data-lit="(true|false)"/g)].map(m => [m[1], m[2] === 'true'] as const)
  }
  for (const [lit, label] of [
    [0, 'The twelve zodiac lanterns, Aries to Pisces, are waiting to be lit.'],
    [4, '4 of 12 zodiac lanterns lit: Aries, Taurus, Gemini, Cancer.'],
    [8, '8 of 12 zodiac lanterns lit: Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio.'],
    [12, 'All twelve zodiac lanterns are lit, Aries to Pisces.'],
  ] as const) {
    const html = renderToStaticMarkup(createElement(GroveLanterns, { lit }))
    assert.ok(html.includes(`aria-label="${label}"`), label)
    assert.ok(html.includes(`data-lit-count="${lit}"`))
    for (const layout of ['wide', 'narrow'] as const) {
      const drawn = lanterns(html, layout)
      assert.deepEqual(drawn.map(([sign]) => sign), [...GROVE_SIGNS], `${layout}: all twelve, in order`)
      assert.deepEqual(drawn.map(([, on]) => on), GROVE_SIGNS.map((_, i) => i < lit), `${layout}: the first ${lit} lit`)
    }
  }
  // the narrow layout hangs them from two garlands of six
  const narrow = renderToStaticMarkup(createElement(GroveLanterns, { lit: 0 }))
  const svg = narrow.slice(narrow.indexOf('data-layout="narrow"'))
  assert.equal((svg.slice(0, svg.indexOf('</svg>')).match(/class="grove__wire"/g) ?? []).length, 2)
  // out-of-range values are clamped, never drawn as more than twelve
  assert.ok(renderToStaticMarkup(createElement(GroveLanterns, { lit: 40 })).includes('data-lit-count="12"'))
})
