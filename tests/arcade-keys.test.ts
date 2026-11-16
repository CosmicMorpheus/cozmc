/* The games step aside for typing, menus, dialogs and shortcuts. `npm test`. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { notForTheGame } from '../src/arcade/keys'

const el = (tagName: string, inside: string[] = [], isContentEditable = false) => ({
  tagName, isContentEditable, closest: (selector: string) => (selector.split(', ').some(s => inside.includes(s)) ? {} : null),
})
const key = (target: unknown, mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}) =>
  ({ ctrlKey: false, metaKey: false, altKey: false, ...mods, target }) as unknown as KeyboardEvent

test('typing into a field, a menu or a dialog is never taken by a game', () => {
  assert.equal(notForTheGame(key(el('INPUT'))), true, 'the site search')
  assert.equal(notForTheGame(key(el('TEXTAREA'))), true)
  assert.equal(notForTheGame(key(el('SELECT'))), true)
  assert.equal(notForTheGame(key(el('DIV', [], true))), true, 'an editable area')
  assert.equal(notForTheGame(key(el('A', ['.site-menu__panel']))), true, 'a link in the open site menu')
  assert.equal(notForTheGame(key(el('BUTTON', ['[role="dialog"]']))), true, 'a button in a dialog')
  assert.equal(notForTheGame(key(el('DIV', ['.modal']))), true)
})

test('shortcuts with Ctrl, Cmd or Alt are left to the browser', () => {
  for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) assert.equal(notForTheGame(key(el('CANVAS'), { [mod]: true })), true, mod)
})

test('keys on the game, the page or the body still reach the game', () => {
  assert.equal(notForTheGame(key(el('CANVAS'))), false)
  assert.equal(notForTheGame(key(el('BODY'))), false)
  assert.equal(notForTheGame(key(el('H1'))), false)
  assert.equal(notForTheGame(key(null)), false)
})
