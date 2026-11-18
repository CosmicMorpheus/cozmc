/* The skin colours: every one the Wardrobe offers is drawn in its own body colour, accepted by the server for a new
   Starprint, and Burnt orange is one of them. Saved Cozmlings keep exactly the colour they had (indices only grow). */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { BODIES } from '../src/companion/look'
import { SKINS } from '../src/cozmling/domain/adventurer'
import { SKIN_BODY } from '../src/cozmling/integrations/originalScene'
import { SKINS as SERVER_SKINS } from '../netlify/cozmling/account.mjs'

test('every offered skin colour is drawn, in its own colour, and accepted by the server', () => {
  assert.ok(SKINS.length >= 15)
  assert.ok(SKINS.some(s => s.id === 'burnt-orange' && s.name === 'Burnt orange'), 'Burnt orange is offered')
  assert.deepEqual([...SERVER_SKINS].sort(), SKINS.map(s => s.id).sort(), 'the server accepts exactly the colours the page offers')
  const bodies = SKINS.map(s => SKIN_BODY[s.id])
  assert.ok(bodies.every(i => Number.isInteger(i) && BODIES[i]), 'each has a body colour in the art')
  assert.equal(new Set(bodies).size, bodies.length, 'no two skins are drawn the same')
})

test('the original six keep the body colour they always had', () => {
  assert.deepEqual({ teal: SKIN_BODY.teal, sky: SKIN_BODY.sky, lilac: SKIN_BODY.lilac, rose: SKIN_BODY.rose, moss: SKIN_BODY.moss, pearl: SKIN_BODY.pearl },
    { teal: 0, sky: 1, lilac: 2, rose: 3, moss: 4, pearl: 7 })
  assert.deepEqual(BODIES.slice(0, 8), ['#6fe3c4', '#7cc8ff', '#c6a2ee', '#ff9ccf', '#b4f06a', '#ffb98a', '#8dff6a', '#d9d4ec'])
})
