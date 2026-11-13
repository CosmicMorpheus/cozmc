/* Which engine and library worked a chart out. Kept apart from the astronomy itself, so a page can
   check a saved chart or report without loading the library. */
export const ENGINE = { name: 'cozmc-celestial', version: 1 } as const
/** Must match the version installed (a test checks it). Changing it changes the engine's version too. */
export const LIBRARY = { name: 'astronomy-engine', version: '2.1.19' } as const
