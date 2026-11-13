/* Loads the astronomy (celestial/engine.ts) once, on first use. If it can't load (offline, say),
   play goes on: an egg still hatches, and its sky is read from its record the next time it can be. */
type Engine = typeof import('./engine')
let loading: Promise<Engine> | null = null
export const loadSkyEngine = (): Promise<Engine> => (loading ??= import('./engine').catch(e => { loading = null; throw e }))
