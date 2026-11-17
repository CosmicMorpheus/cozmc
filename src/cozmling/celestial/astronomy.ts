/* astronomy-engine, for the browser and the server alike. Its ESM entry is a file Node treats as CommonJS, so on the
   server (a Netlify Function, where the package stays outside the bundle) its names are only on the default export;
   in the browser build they're named exports. Taking whichever is there keeps one import for both. */
import * as namespace from 'astronomy-engine'

type Astronomy = typeof namespace
const astronomy: Astronomy = ((namespace as unknown as { default?: Astronomy }).default ?? namespace)

export const { Body, GeoVector, MakeTime, MoonPhase, RotateVector, Rotation_EQD_ECT, Rotation_EQJ_ECT, SiderealTime, SphereFromVector } = astronomy
export type Body = namespace.Body
