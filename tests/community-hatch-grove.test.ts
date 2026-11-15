/* Light the Grove's twelve zodiac lanterns: which signs glow for the community's shared count, in zodiac
   order, each with its sign drawn and its state named. `npm test`. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { GROVE_SIGNS, litSigns } from '../src/cozmling/community/communityHatch'
import { GroveLanterns } from '../src/cozmling/community/GroveLanterns'
import { ZODIAC_PATHS } from '../src/cozmling/components/zodiacPaths'
import { SIGNS, signInfo } from '../src/cozmling/domain/starprint'

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
  // and it agrees with the brief's floor(min(total / goal, 1) * 12) everywhere it's defined
  for (let goal = 1; goal <= 200; goal++) {
    for (let total = 0; total <= goal + 2; total++) assert.equal(litSigns(total, goal), Math.floor(Math.min(total / goal, 1) * 12), `${total} of ${goal}`)
  }
})

test('the twelve lanterns run in zodiac order, Aries to Pisces, and every sign has its own drawn glyph', () => {
  assert.deepEqual([...GROVE_SIGNS], SIGNS.map(s => s.sign))
  assert.deepEqual([...GROVE_SIGNS], ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'])
  const glyphs = GROVE_SIGNS.map(sign => ZODIAC_PATHS[sign].join(' '))
  assert.ok(glyphs.every(g => /^M/.test(g)), 'every sign is drawn')
  assert.equal(new Set(glyphs).size, 12, 'twelve different glyphs')
})

test('the twelve lanterns are listed in zodiac order, the first ones lit, each with its sign drawn and its state named', () => {
  const lanterns = (html: string) => [...html.matchAll(/data-sign="([a-z]+)" data-element="[a-z]+" data-lit="(true|false)"/g)].map(m => [m[1], m[2] === 'true'] as const)
  for (const lit of [0, 4, 8, 12]) {
    const html = renderToStaticMarkup(createElement(GroveLanterns, { lit }))
    assert.ok(html.includes('role="list" aria-label="Zodiac lanterns"'))
    assert.ok(html.includes(`data-lit-count="${lit}"`))
    assert.deepEqual(lanterns(html), GROVE_SIGNS.map((sign, index) => [sign, index < lit]), `${lit}: all twelve in order, the first ${lit} lit`)
    // a screen reader hears each lantern's own state
    for (const [index, sign] of GROVE_SIGNS.entries()) {
      assert.ok(html.includes(`${signInfo(sign).name} lantern: ${index < lit ? 'lit' : 'unlit'}`), `${lit}: ${sign}`)
    }
    // every sign is drawn as strokes: none is left to a font, which shows emoji on some phones
    assert.equal(html.match(/class="sl-glyph community-hatch__sign"/g)?.length, 12)
    assert.ok(!html.includes('sl-glyph--text'))
  }
  // out-of-range values are clamped: never more than twelve, never fewer than none
  assert.ok(renderToStaticMarkup(createElement(GroveLanterns, { lit: 40 })).includes('data-lit-count="12"'))
  assert.ok(renderToStaticMarkup(createElement(GroveLanterns, { lit: -2 })).includes('data-lit-count="0"'))
})
