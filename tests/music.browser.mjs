/* The music player in real Chrome, with a simulated YouTube (tests/music-browser/fake-youtube.js), since the
   real one can't be reached from a test. Run from the COZMC checkout with Playwright installed:
     node tests/music.browser.mjs            (PW_CHROMIUM may point at an installed Chrome/Chromium)
   Covers: the two-second opening preview and its note; blocked and silent-only autoplay; Pause while the
   music is still loading, including a start that arrives late; YouTube failing to load, and Retry. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

const require = createRequire(import.meta.url)
const { build } = require('esbuild')
const { chromium } = require('playwright')
const root = fileURLToPath(new URL('..', import.meta.url))
const origin = 'https://music.test'
const API = 'https://www.youtube.com/iframe_api'
const fake = await readFile(new URL('./music-browser/fake-youtube.js', import.meta.url), 'utf8')
const bundle = await build({
  stdin: {
    contents: "import { createRoot } from 'react-dom/client'; import { MusicButton } from './src/components/Music'; createRoot(document.getElementById('root')).render(<MusicButton />)",
    resolveDir: root, loader: 'tsx', sourcefile: 'music-entry.tsx',
  },
  bundle: true, write: false, format: 'esm', target: 'es2022', jsx: 'automatic', outfile: 'music.js',
})
const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).contents
const html = '<!doctype html><html><body><main style="height:1200px"><button id="elsewhere">Elsewhere</button></main><div id="root"></div><script type="module" src="/music.js"></script></body></html>'

const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {})
async function open({ mode = 'allowed', bufferMs, readyMs, stored, youtube = 'up' } = {}) {
  const context = await browser.newContext()
  const state = { youtube }
  await context.route('**/*', route => {
    const url = route.request().url()
    if (url === API) return state.youtube === 'up' ? route.fulfill({ contentType: 'text/javascript', body: fake }) : route.abort()
    if (url === origin + '/') return route.fulfill({ contentType: 'text/html', body: html })
    if (url === origin + '/music.js') return route.fulfill({ contentType: 'text/javascript', body: Buffer.from(js) })
    return route.abort()
  })
  await context.addInitScript(([m, ms, rs, s]) => {
    window.__ytMode = m
    if (ms) window.__ytBufferMs = ms
    if (rs) window.__ytReadyMs = rs
    if (s) sessionStorage.setItem('cozmc-music', s)
  }, [mode, bufferMs, readyMs, stored])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto(origin + '/')
  return { page, state, errors, close: () => context.close() }
}
const note = page => page.locator('.music-hint').textContent()
const ytState = page => page.evaluate(() => window.__yt?.getPlayerState() ?? null)
const play = page => page.locator('.mp__play')

try {
  // 1. Autoplay allowed: two seconds of actual playback, one pause, the note, and Play takes over
  {
    const { page, errors, close } = await open({ mode: 'allowed' })
    await page.waitForFunction(() => document.querySelector('.music-hint')?.textContent, null, { timeout: 10000 })
    assert.equal(await note(page), 'Music paused. Press Play to continue.')
    const log = await page.evaluate(() => window.__ytLog)
    const started = log.find(e => e.state === 1), paused = log.find(e => e.state === 2)
    assert.ok(paused.pos >= 1.98 && paused.pos <= 2.15, `paused after ${paused.pos} s of music`)
    assert.ok(paused.t - started.t >= 1950, 'measured from when the music started, not from page load')
    await sleep(2500)
    assert.equal(await ytState(page), 2, 'stays paused')
    assert.equal(await note(page), 'Music paused. Press Play to continue.', 'the note stays until Play')
    await play(page).click()
    await page.waitForFunction(() => window.__yt.getPlayerState() === 1)
    assert.equal(await note(page), '')
    await sleep(2600)
    assert.equal(await ytState(page), 1, 'Play keeps the music going')
    assert.deepEqual(errors, [])
    await close()
  }

  // 2. Autoplay blocked, or only silent autoplay: nothing plays, no note; a click elsewhere starts nothing; Play works
  for (const mode of ['blocked', 'muted']) {
    const { page, errors, close } = await open({ mode })
    await sleep(3500)
    assert.notEqual(await ytState(page), 1, `${mode}: nothing plays`)
    assert.equal(await note(page), '', `${mode}: no note`)
    await page.locator('#elsewhere').click()
    await sleep(1200)
    assert.notEqual(await ytState(page), 1, `${mode}: a click elsewhere doesn't start the music`)
    await play(page).click()
    await page.waitForFunction(() => window.__yt.getPlayerState() === 1)
    await sleep(2600)
    assert.equal(await ytState(page), 1, `${mode}: Play plays, with no automatic pause`)
    assert.equal(await note(page), '')
    assert.deepEqual(errors, [])
    await close()
  }

  // 2b. Play pressed before the player is ready: it waits, then plays (and is never taken for a Pause)
  {
    const { page, errors, close } = await open({ mode: 'blocked', readyMs: 2500 })
    await page.waitForTimeout(300)
    await play(page).click()
    assert.equal(await play(page).getAttribute('aria-label'), 'Pause background music', 'queued: the button offers Pause')
    assert.equal(await page.locator('.mp__title').textContent(), 'Tuning in…')
    await page.waitForFunction(() => window.__yt?.getPlayerState() === 1, null, { timeout: 8000 })
    await sleep(2600)
    assert.equal(await ytState(page), 1, 'it plays on, with no automatic pause')
    assert.equal(await page.evaluate(() => sessionStorage.getItem('cozmc-music')), 'on')
    assert.deepEqual(errors, [])
    await close()
  }

  // 3. Pause while the music is still loading stops it, even when the start arrives after the Pause
  for (const mode of ['allowed', 'late']) {
    const { page, errors, close } = await open({ mode, bufferMs: 1500, stored: 'off' })
    await page.waitForFunction(() => window.__yt)
    await play(page).click()
    await page.waitForFunction(() => window.__yt.getPlayerState() === 3)
    assert.equal(await play(page).getAttribute('aria-label'), 'Pause background music', 'loading shows Pause')
    await play(page).click()
    await sleep(2200)                       // past the moment the pending start would land
    assert.notEqual(await ytState(page), 1, `${mode}: still not playing`)
    assert.equal(await play(page).getAttribute('aria-label'), 'Play background music')
    assert.equal(await page.evaluate(() => sessionStorage.getItem('cozmc-music')), 'off', 'the choice is kept')
    assert.deepEqual(errors, [])
    await close()
  }

  // 4. YouTube can't be reached: "Music unavailable" and Retry, which plays once YouTube answers
  {
    const { page, state, errors, close } = await open({ youtube: 'down' })
    await page.locator('.mp__play[aria-label="Music unavailable: retry loading it"]').waitFor({ timeout: 5000 })
    assert.equal(await page.locator('.mp__title').textContent(), 'Music unavailable')
    assert.equal(await page.locator('.mp__skip').count(), 0, 'no skip while there is no music')
    state.youtube = 'up'
    await play(page).click()
    await page.waitForFunction(() => window.__yt?.getPlayerState() === 1, null, { timeout: 10000 })
    await sleep(2600)
    assert.equal(await ytState(page), 1, 'Retry counts as pressing Play: no automatic pause')
    assert.equal(await note(page), '')
    assert.deepEqual(errors, [])
    await close()
  }
  console.log('Music player browser test passed.')
} finally {
  await browser.close()
}
