/* Shared by the Star Loft and the observatory: a Cozmling's two sky colours, and reading the sky of
   one that hatched before its sky could be read (from its own record, nothing guessed). */
import { useEffect } from 'react'
import { GLOWS } from '../../companion/look'
import { ELEMENTS } from '../domain/starprint'
import { cozmlingStore } from '../index'
import type { Companion } from '../types'
import { loadSkyEngine } from './load'
import { playerTimeZone } from './observatory'
import { awaitingSky } from './options'

const deepen = (hex: string) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * 0.28).toString(16).padStart(2, '0')).join('')
/** The two colours its sky is painted in: its element's, or a first-version Cozmling's own glow. */
export function skyColors(c: Companion): [string, string] {
  if (c.kind === 'adventurer') return ELEMENTS[c.starprint.element].orb
  const glow = GLOWS[c.legacy.pet.look.glow] ?? GLOWS[0]
  return [glow, deepen(glow)]
}

export function useLateSky(c: Companion) {
  const needs = awaitingSky(c), id = c.companionId
  useEffect(() => {
    if (!needs) return
    let live = true
    loadSkyEngine().then(sky => { if (live) void cozmlingStore()?.update(id, (cur, now) => sky.readSkyLate(cur, now, playerTimeZone()), { event: { eventId: `sky:${id}`, type: 'sky-read' } }) }, () => { /* next time */ })
    return () => { live = false }
  }, [needs, id])
}
