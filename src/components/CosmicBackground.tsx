import { useEffect, useRef } from 'react'

const FRAME_INTERVAL = 1000 / 24
const STAR_PIXEL_BUDGET = 1_600_000
const GALAXY_PIXEL_BUDGET = 400_000
const FOIL_COLORS = ['#f2c45c', '#6ce7ff', '#bf91fc', '#ed8ec8', '#a5efab']

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

function createStars(width: number, height: number) {
  const random = seededRandom(0x24c02)
  const count = Math.min(480, Math.max(32, Math.round(width * height / 3350)))
  return Array.from({ length: count }, () => {
    const pale = random()
    const size = random()
    return {
      x: random() * width,
      y: random() * height,
      size: size < .065 ? 2.55 : size < .31 ? 1.65 : 1.05,
      color: pale < .73 ? '#eef0ed' : FOIL_COLORS[Math.floor(random() * FOIL_COLORS.length)],
      light: .23 + .60 * random() ** 2.3,
      fall: 1.1 + 3.7 * random(),
      drift: .45 + .7 * random(),
      phase: random() * 2 * Math.PI,
      pulse: .48 + .55 * random(),
    }
  })
}

function drawGalaxy(
  context: CanvasRenderingContext2D,
  x: number, y: number, radius: number, angle: number,
  colors: readonly [core: string, near: string, far: string],
  seed: number,
) {
  const [core, near, far] = colors
  const random = seededRandom(seed)
  context.save()
  context.translate(x, y)
  context.rotate(angle)
  context.scale(radius, radius * .47)
  const haze = context.createRadialGradient(0, 0, 0, 0, 0, 1.12)
  haze.addColorStop(0, core + '36')
  haze.addColorStop(.10, near + '23')
  haze.addColorStop(.33, near + '12')
  haze.addColorStop(.72, far + '08')
  haze.addColorStop(1, far + '00')
  context.fillStyle = haze
  context.fillRect(-1.12, -1.12, 2.24, 2.24)

  // Draw and cache two dusty arms around the tilted disk.
  for (let arm = 0; arm < 2; arm++) {
    const offset = arm * Math.PI
    const tint = arm === 0 ? near : far
    for (let point = 0; point < 45; point++) {
      const position = point / 44
      const distance = .1 + position * .91
      const bearing = offset + distance * 4.62 + .05 * Math.sin(point * .7 + arm)
      const armX = Math.cos(bearing) * distance
      const armY = Math.sin(bearing) * distance
      const spread = .085 + random() * .074
      const cloud = context.createRadialGradient(armX, armY, 0, armX, armY, spread)
      cloud.addColorStop(0, tint + '16')
      cloud.addColorStop(.55, tint + '07')
      cloud.addColorStop(1, tint + '00')
      context.fillStyle = cloud
      context.globalAlpha = .14 + .78 * Math.sin(Math.PI * position) ** .8
      context.fillRect(armX - spread, armY - spread, spread * 2, spread * 2)
    }

    for (let point = 0; point < 265; point++) {
      const distance = .055 + random() ** 1.3 * .94
      const bearing = offset + distance * 4.62 + (random() - .5) * (.25 + .55 * distance)
      const grain = .003 + random() * .008
      const light = (.12 + .29 * random()) * (1 - distance * .76)
      context.fillStyle = random() < .15 ? core : tint
      context.globalAlpha = light
      context.fillRect(Math.cos(bearing) * distance, Math.sin(bearing) * distance, grain, grain)
    }
    context.globalAlpha = 1
  }
  context.restore()
}

function fitCanvas(
  element: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  width: number, height: number, scale: number,
) {
  element.width = Math.max(1, Math.floor(width * scale))
  element.height = Math.max(1, Math.floor(height * scale))
  context.setTransform(element.width / width, 0, 0, element.height / height, 0, 0)
}

export function CosmicBackground({ paused }: { paused: boolean }) {
  const starLayer = useRef<HTMLCanvasElement>(null)
  const galaxyLayer = useRef<HTMLCanvasElement>(null)
  const setPaused = useRef<((value: boolean) => void) | null>(null)

  useEffect(() => {
    const starsElement = starLayer.current
    const galaxiesElement = galaxyLayer.current
    const starContext = starsElement?.getContext('2d')
    const galaxyContext = galaxiesElement?.getContext('2d')
    if (!starsElement || !galaxiesElement || !starContext || !galaxyContext) return

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let width = 0
    let height = 0
    let deviceScale = 0
    let stars: ReturnType<typeof createStars> = []
    let frame = 0
    let lastDraw = 0
    let starTime = 0
    let isPaused = true

    const paintStars = (seconds: number) => {
      starTime += seconds
      starContext.clearRect(0, 0, width, height)
      for (const star of stars) {
        star.x = (star.x + star.drift * seconds) % width
        star.y = (star.y + star.fall * seconds) % height
        const edge = .68 + .32 * Math.abs(2 * star.x / width - 1)
        const twinkle = 1 + .14 * Math.sin(star.phase + starTime * star.pulse)
        starContext.globalAlpha = star.light * twinkle * edge
        starContext.fillStyle = star.color
        starContext.fillRect(star.x, star.y, star.size, star.size)
      }
      starContext.globalAlpha = 1
    }

    const resize = () => {
      const nextWidth = starsElement.clientWidth
      const nextHeight = starsElement.clientHeight
      const nextScale = window.devicePixelRatio || 1
      if (!nextWidth || !nextHeight) return
      if (width === nextWidth && height === nextHeight && deviceScale === nextScale) return

      width = nextWidth
      height = nextHeight
      deviceScale = nextScale
      const area = width * height
      fitCanvas(starsElement, starContext, width, height, Math.min(deviceScale, 1.5, Math.sqrt(STAR_PIXEL_BUDGET / area)))
      fitCanvas(galaxiesElement, galaxyContext, width, height, Math.min(.8, Math.sqrt(GALAXY_PIXEL_BUDGET / area)))
      drawGalaxy(galaxyContext, width * .89, height * .30, Math.min(192, width * .14), -.56, ['#d6f7ff', '#668dff', '#a579e5'], 91)
      drawGalaxy(galaxyContext, width * .10, height * .75, Math.min(159, width * .124), .38, ['#ffe69c', '#9e64de', '#bb6a9d'], 72)
      stars = createStars(width, height)
      paintStars(0)
    }

    const animate = (now: number) => {
      const elapsed = now - lastDraw
      if (elapsed >= FRAME_INTERVAL) {
        paintStars(Math.min(elapsed / 1000, .1))
        lastDraw = now
      }
      frame = window.requestAnimationFrame(animate)
    }

    const sync = () => {
      if (isPaused || motion.matches || document.hidden) {
        if (frame) window.cancelAnimationFrame(frame)
        frame = 0
      } else if (!frame) {
        lastDraw = performance.now()
        frame = window.requestAnimationFrame(animate)
      }
    }

    setPaused.current = value => { isPaused = value; sync() }
    resize()
    window.addEventListener('resize', resize, { passive: true })
    document.addEventListener('visibilitychange', sync)
    motion.addEventListener('change', sync)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', sync)
      motion.removeEventListener('change', sync)
      setPaused.current = null
    }
  }, [])

  useEffect(() => { setPaused.current?.(paused) }, [paused])

  return (
    <>
      <canvas ref={galaxyLayer} className="cosmic-background cosmic-background--galaxies" aria-hidden="true" />
      <canvas ref={starLayer} className="cosmic-background cosmic-background--stars" aria-hidden="true" />
    </>
  )
}
