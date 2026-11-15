/* The switch for the rebuilt Cozmling (v2). OFF unless the site is built with VITE_COZMLING_V2=1.
   With it off the site runs exactly as before: the old Cozmling page, Buddy, Spotlight and arcade
   cheer, and none of the code in src/cozmling/ is loaded. */
export const COZMLING_V2: boolean = import.meta.env.VITE_COZMLING_V2 === '1'
/** Extra inspection tools for local work and the preview site. Never on unless v2 is on. */
export const COZMLING_DEV: boolean = COZMLING_V2 && (import.meta.env.DEV || import.meta.env.VITE_COZMLING_DEV === '1')
/** Permit new adoption only in the signed wallet account flow. Off in regular builds.
    (Plain `import.meta.env.X`, never `?.`: the build replaces these exactly, so a switched-off build leaves the code out.) */
export const COZMLING_WALLET_ACCOUNT: boolean = import.meta.env.VITE_COZMLING_WALLET_ACCOUNT === '1'
/** The Community Hatch event (Light the Grove), in wallet-account builds. Off in regular builds. */
export const COZMC_COMMUNITY_HATCH: boolean = import.meta.env.VITE_COZMC_COMMUNITY_HATCH === '1'
