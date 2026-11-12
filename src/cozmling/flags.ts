/* The switch for the rebuilt Cozmling (v2). OFF unless the site is built with VITE_COZMLING_V2=1.
   With it off the site runs exactly as before: the old Cozmling page, Buddy, Spotlight and arcade
   cheer, and none of the code in src/cozmling/ is loaded. */
export const COZMLING_V2: boolean = import.meta.env.VITE_COZMLING_V2 === '1'
/** Extra inspection tools for local work and the preview site. Never on unless v2 is on. */
export const COZMLING_DEV: boolean = COZMLING_V2 && (import.meta.env.DEV || import.meta.env.VITE_COZMLING_DEV === '1')
