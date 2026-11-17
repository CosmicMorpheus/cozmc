/* After npm install: mark astronomy-engine's esm/ folder as ES modules. The package points `import` at esm/astronomy.js
   but doesn't say it is ESM, so a Node that doesn't sniff the syntax (Netlify's function runtime) loads it as
   CommonJS and fails. The browser build and `require` are unaffected. Safe to run any number of times. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('../node_modules/astronomy-engine/esm/', import.meta.url)
const marker = new URL('package.json', dir)
if (existsSync(dir) && !(existsSync(marker) && JSON.parse(readFileSync(marker, 'utf8')).type === 'module')) {
  writeFileSync(marker, '{ "type": "module" }\n')
}
