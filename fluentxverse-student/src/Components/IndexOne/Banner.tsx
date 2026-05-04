import { useEffect, useRef, useState } from 'preact/hooks'
import * as THREE from 'three'
import './Banner.css'

type SlideTheme = 'ember' | 'ocean' | 'acid'

type HeroSlide = {
  id: string
  theme: SlideTheme
  badge: string
  category: string
  titleLines: [string, string]
  description: string
  actionHref: string
  actionLabel: string
  imageSrc?: string
  accentImageSrc?: string
  thumbSrc?: string
  thumbLabel: string
  cardStart: string
  cardEnd: string
}

type ThemePalette = {
  shellStart: string
  shellMid: string
  shellEnd: string
  glow: string
  contour: string
  rim: string
  fog: string
}

type CanvasScene = {
  rotation: number
  targetRotation: number
  pointerX: number
  pointerY: number
  tiltX: number
  tiltY: number
  width: number
  height: number
}

type DragState = {
  active: boolean
  pointerId: number | null
  startX: number
  startRotation: number
}

const AUTO_SLOW_MS = 5000
const AUTO_FAST_MS = 1200
const AUTO_SLOW_PROGRESS = 0.16
const DRAG_ROTATION_SENSITIVITY = 2.45
const RENDER_SLOT_OFFSETS = [0, 1, 2, 3, 4] as const
const CARD_ASPECT_RATIO = 1.909
const CARD_ARC_RADIANS = Math.PI * 0.366
const CARD_PLANE_WIDTH = 8.22
const ORBIT_RADIUS = CARD_PLANE_WIDTH / (2 * Math.sin(CARD_ARC_RADIANS / 2))
const ORBIT_RADIUS_X = ORBIT_RADIUS * 1.015
const ORBIT_RADIUS_Z = ORBIT_RADIUS * 0.675
const ORBIT_CENTER_X = 2.05
const ORBIT_CENTER_Y = 0.18
const ORBIT_STEP_RADIANS = (Math.PI * 2) / RENDER_SLOT_OFFSETS.length
const ORBIT_DEFAULT_PHASE = -1.0
const ORBIT_PRESENTATION_TILT_X = -0.035
const ORBIT_PRESENTATION_TILT_Y = -0.005
const ORBIT_PRESENTATION_TILT_Z = 0.105
const ORBIT_PRESENTATION_SHIFT_X = 0.56
const ORBIT_PRESENTATION_SHIFT_Y = -0.26
const ORBIT_CAMERA_X = ORBIT_CENTER_X + 0.1
const ORBIT_CAMERA_Y = -1.48
const ORBIT_CAMERA_Z = 16.35
const ORBIT_LOOK_AT_X = ORBIT_CENTER_X + 0.32
const ORBIT_LOOK_AT_Y = 0.58
const ORBIT_LOOK_AT_Z = -0.3
const TAU = Math.PI * 2
const ORBIT_SAMPLE_COUNT = 960

function getOrbitPoint(angle: number) {
  return {
    x: Math.sin(angle) * ORBIT_RADIUS_X,
    z: Math.cos(angle) * ORBIT_RADIUS_Z,
  }
}

function createOrbitSamples() {
  const samples: Array<{ angle: number; length: number }> = [{ angle: 0, length: 0 }]
  let length = 0
  let previous = getOrbitPoint(0)

  for (let index = 1; index <= ORBIT_SAMPLE_COUNT; index += 1) {
    const angle = (index / ORBIT_SAMPLE_COUNT) * TAU
    const point = getOrbitPoint(angle)

    length += Math.hypot(point.x - previous.x, point.z - previous.z)
    samples.push({ angle, length })
    previous = point
  }

  return samples
}

const ORBIT_SAMPLES = createOrbitSamples()
const ORBIT_CIRCUMFERENCE = ORBIT_SAMPLES[ORBIT_SAMPLES.length - 1].length
const ORBIT_STEP_DISTANCE = ORBIT_CIRCUMFERENCE / RENDER_SLOT_OFFSETS.length
const ORBIT_CARD_DISTANCE = ORBIT_STEP_DISTANCE * 0.92
const CENTERED_SLIDE_OFFSET = 1

function distanceToOrbitAngle(distance: number) {
  const wrappedDistance = ((distance % ORBIT_CIRCUMFERENCE) + ORBIT_CIRCUMFERENCE) % ORBIT_CIRCUMFERENCE
  let low = 0
  let high = ORBIT_SAMPLES.length - 1

  while (low < high) {
    const mid = Math.floor((low + high) / 2)

    if (ORBIT_SAMPLES[mid].length < wrappedDistance) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  const current = ORBIT_SAMPLES[low]
  const previous = ORBIT_SAMPLES[Math.max(0, low - 1)]
  const segmentLength = Math.max(current.length - previous.length, 0.0001)
  const segmentProgress = (wrappedDistance - previous.length) / segmentLength

  return previous.angle + (current.angle - previous.angle) * segmentProgress
}

const slides: HeroSlide[] = [
  {
    id: 'speak-ready',
    theme: 'ember',
    badge: 'HOT',
    category: 'LESSONS',
    titleLines: ['DAILY', 'DISPATCH'],
    description: 'Private English sessions that feel personal, focused, and easy to start from day one.',
    actionHref: '/browse-tutors',
    actionLabel: 'Launch',
    imageSrc: '/assets/img/banner/daily_dispatch.webp',
    thumbSrc: '/assets/img/banner/daily_dispatch.webp',
    thumbLabel: 'Speak',
    cardStart: '#060606',
    cardEnd: '#d8b11f',
  },
  {
    id: 'flex-pass',
    theme: 'acid',
    badge: 'FLEX',
    category: 'TICKETS',
    titleLines: ['BUSINESS', 'ENGLISH'],
    description: 'Keep trial and premium tickets on hand so you can jump into lessons whenever time opens up.',
    actionHref: '/register',
    actionLabel: 'Start',
    imageSrc: '/assets/img/banner/business_banner.webp',
    thumbSrc: '/assets/img/banner/business_banner.webp',
    thumbLabel: 'Pass',
    cardStart: '#050507',
    cardEnd: '#5a2aa8',
  },
  {
    id: 'daily-dispatch',
    theme: 'ember',
    badge: 'HOT',
    category: 'LESSONS',
    titleLines: ['PRONUNCIATION', 'PRACTICE'],
    description: 'Private English sessions that feel personal, focused, and easy to start from day one.',
    actionHref: '/browse-tutors',
    actionLabel: 'Launch',
    imageSrc: '/assets/img/banner/pronunciation.webp',
    thumbSrc: '/assets/img/banner/pronunciation.webp',
    thumbLabel: 'Speak',
    cardStart: '#f6faf6',
    cardEnd: '#1f8247',
  },
  {
    id: 'skill-path',
    theme: 'ember',
    badge: 'NEW',
    category: 'PRACTICE',
    titleLines: ['CONVERSATION', 'SKILLS'],
    description: 'Strengthen speaking habits with guided conversation practice built to grow fluency one session at a time.',
    actionHref: '/register',
    actionLabel: 'Join',
    imageSrc: '/assets/img/banner/conversation_skill_banner.webp',
    thumbSrc: '/assets/img/banner/conversation_skill_banner.webp',
    thumbLabel: 'Skills',
    cardStart: '#79b7ff',
    cardEnd: '#1f6dff',
  },
  {
    id: 'group-flow',
    theme: 'ocean',
    badge: 'KIDS',
    category: 'YOUNG LEARNERS',
    titleLines: ['KIDS', 'ZONE'],
    description: 'A playful English space for young learners with guided speaking, games, and confidence-building practice.',
    actionHref: '/young-learners',
    actionLabel: 'Explore',
    imageSrc: '/assets/img/banner/kid_zone_banner.webp',
    thumbSrc: '/assets/img/banner/kid_zone_banner.webp',
    thumbLabel: 'Kids',
    cardStart: '#f28a1f',
    cardEnd: '#ef7a1a',
  },
]

const themePalettes: Record<SlideTheme, ThemePalette> = {
  ember: {
    shellStart: '#090b12',
    shellMid: '#24101f',
    shellEnd: '#260d1b',
    glow: 'rgba(255, 101, 39, 0.24)',
    contour: 'rgba(255, 255, 255, 0.24)',
    rim: 'rgba(255, 255, 255, 0.15)',
    fog: 'rgba(255, 120, 48, 0.18)',
  },
  ocean: {
    shellStart: '#07111a',
    shellMid: '#0c3242',
    shellEnd: '#0d3246',
    glow: 'rgba(112, 214, 255, 0.22)',
    contour: 'rgba(255, 255, 255, 0.22)',
    rim: 'rgba(255, 255, 255, 0.14)',
    fog: 'rgba(133, 221, 255, 0.16)',
  },
  acid: {
    shellStart: '#090d0d',
    shellMid: '#293710',
    shellEnd: '#283610',
    glow: 'rgba(174, 255, 74, 0.2)',
    contour: 'rgba(255, 255, 255, 0.2)',
    rim: 'rgba(255, 255, 255, 0.14)',
    fog: 'rgba(171, 255, 94, 0.16)',
  },
}

const wrapIndex = (index: number) => ((index % slides.length) + slides.length) % slides.length

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount

const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof Element && Boolean(target.closest('a, button, input, textarea, select, [role="button"]'))

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2

const hexToRgb = (value: string) => {
  const normalized = value.replace('#', '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => `${char}${char}`)
          .join('')
      : normalized

  const parsed = Number.parseInt(expanded, 16)

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  }
}

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`

const mixHex = (start: string, end: string, amount: number) => {
  const from = hexToRgb(start)
  const to = hexToRgb(end)

  return rgbToHex(lerp(from.r, to.r, amount), lerp(from.g, to.g, amount), lerp(from.b, to.b, amount))
}

const getLuminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
}

const rgbaFromHex = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const getSlidePalette = (slide: HeroSlide): ThemePalette => {
  const fallback = themePalettes[slide.theme]
  const start = slide.cardStart || fallback.shellStart
  const end = slide.cardEnd || fallback.shellEnd
  const shellMid = mixHex(start, end, 0.52)
  const startLuminance = getLuminance(start)
  const endLuminance = getLuminance(end)
  const accent = endLuminance > 0.8 && startLuminance < endLuminance ? start : end
  const averageLuminance = (startLuminance + endLuminance) / 2

  return {
    shellStart: start,
    shellMid,
    shellEnd: end,
    glow: rgbaFromHex(accent, averageLuminance > 0.62 ? 0.16 : 0.24),
    contour: averageLuminance > 0.62 ? 'rgba(0, 0, 0, 0.14)' : 'rgba(255, 255, 255, 0.22)',
    rim: averageLuminance > 0.62 ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.15)',
    fog: rgbaFromHex(accent, averageLuminance > 0.62 ? 0.12 : 0.18),
  }
}

const sampleOrbitSlot = (relative: number) => {
  const orbitDistance = (relative + ORBIT_DEFAULT_PHASE) * ORBIT_STEP_DISTANCE
  const orbitAngle = distanceToOrbitAngle(orbitDistance)
  const orbitPoint = getOrbitPoint(orbitAngle)
  const depthWeight = (Math.cos(orbitAngle) + 1) / 2
  const backWeight = 1 - depthWeight

  return {
    x: ORBIT_CENTER_X + orbitPoint.x,
    y: ORBIT_CENTER_Y + depthWeight * 0.18 - backWeight * 0.1,
    z: orbitPoint.z,
    scale: 1,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    opacity: lerp(0.94, 1, depthWeight),
    orbitDistance,
    cardDistance: ORBIT_CARD_DISTANCE,
  }
}

const drawRoundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const resolvedRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + resolvedRadius, y)
  context.arcTo(x + width, y, x + width, y + height, resolvedRadius)
  context.arcTo(x + width, y + height, x, y + height, resolvedRadius)
  context.arcTo(x, y + height, x, y, resolvedRadius)
  context.arcTo(x, y, x + width, y, resolvedRadius)
  context.closePath()
}

const drawImageCover = (
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  zoom: number,
  offsetX: number,
  offsetY: number,
) => {
  const sourceWidth = image.naturalWidth || image.width
  const sourceHeight = image.naturalHeight || image.height

  if (!sourceWidth || !sourceHeight) {
    return
  }

  const sourceRatio = sourceWidth / sourceHeight
  const targetRatio = width / height

  let cropWidth = sourceWidth
  let cropHeight = sourceHeight

  if (targetRatio > sourceRatio) {
    cropHeight = sourceWidth / targetRatio
  } else {
    cropWidth = sourceHeight * targetRatio
  }

  cropWidth /= zoom
  cropHeight /= zoom

  const maxOffsetX = (sourceWidth - cropWidth) / 2
  const maxOffsetY = (sourceHeight - cropHeight) / 2
  const sourceX = clamp((sourceWidth - cropWidth) / 2 + offsetX * maxOffsetX, 0, sourceWidth - cropWidth)
  const sourceY = clamp((sourceHeight - cropHeight) / 2 + offsetY * maxOffsetY, 0, sourceHeight - cropHeight)

  context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height)
}

const drawTicketScene = (
  context: CanvasRenderingContext2D,
  slide: HeroSlide,
  imageMap: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  pulse: number,
) => {
  const orbGradient = context.createRadialGradient(width * 0.64, height * 0.3, 0, width * 0.64, height * 0.3, width * 0.44)
  orbGradient.addColorStop(0, 'rgba(217, 255, 160, 0.4)')
  orbGradient.addColorStop(0.52, 'rgba(255, 255, 255, 0.05)')
  orbGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

  context.fillStyle = orbGradient
  context.fillRect(0, 0, width, height)

  context.fillStyle = 'rgba(255, 255, 255, 0.05)'
  context.fillRect(width * 0.12, height * 0.74, width * 0.42, Math.max(8, height * 0.025))
  context.fillRect(width * 0.12, height * 0.8, width * 0.26, Math.max(8, height * 0.025))

  const accentImage = slide.accentImageSrc ? imageMap.get(slide.accentImageSrc) : undefined
  const ticketImage = slide.imageSrc ? imageMap.get(slide.imageSrc) : undefined

  if (accentImage?.complete) {
    context.save()
    context.globalAlpha = 0.7
    context.translate(width * 0.35, height * 0.33)
    context.rotate(-0.18)
    const accentWidth = width * 0.42
    const accentHeight = accentWidth * (accentImage.naturalHeight / accentImage.naturalWidth)
    context.drawImage(accentImage, -accentWidth / 2, -accentHeight / 2, accentWidth, accentHeight)
    context.restore()
  }

  if (ticketImage?.complete) {
    context.save()
    context.translate(width * 0.58, height * 0.54)
    context.rotate(-0.08 + pulse * 0.02)
    const ticketWidth = width * 0.54
    const ticketHeight = ticketWidth * (ticketImage.naturalHeight / ticketImage.naturalWidth)
    context.drawImage(ticketImage, -ticketWidth / 2, -ticketHeight / 2, ticketWidth, ticketHeight)
    context.restore()
  }
}

const drawPosterCard = (
  context: CanvasRenderingContext2D,
  slide: HeroSlide,
  imageMap: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  frontWeight: number,
  sideLean: number,
  time: number,
) => {
  const cornerRadius = 0
  const backgroundGradient = context.createLinearGradient(0, 0, width, height)
  backgroundGradient.addColorStop(0, slide.cardStart)
  backgroundGradient.addColorStop(1, slide.cardEnd)

  drawRoundedRect(context, 0, 0, width, height, cornerRadius)
  context.fillStyle = backgroundGradient
  context.fill()

  context.save()
  drawRoundedRect(context, 0, 0, width, height, cornerRadius)
  context.clip()

  const image = slide.imageSrc ? imageMap.get(slide.imageSrc) : undefined
  const pulse = (Math.sin(time * 0.001 + frontWeight * 2) + 1) / 2

  if (slide.theme === 'acid' && slide.accentImageSrc) {
    drawTicketScene(context, slide, imageMap, width, height, pulse)
  } else if (image?.complete) {
    drawImageCover(
      context,
      image,
      0,
      0,
      width,
      height,
      1.08 + frontWeight * 0.04,
      sideLean * 0.22,
      0,
    )
  }

  const overlay = context.createLinearGradient(0, 0, 0, height)
  overlay.addColorStop(0, 'rgba(6, 10, 18, 0)')
  overlay.addColorStop(0.58, 'rgba(6, 10, 18, 0.015)')
  overlay.addColorStop(1, 'rgba(6, 10, 18, 0.06)')
  context.fillStyle = overlay
  context.fillRect(0, 0, width, height)

  context.restore()

  context.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  context.lineWidth = 1.2
  drawRoundedRect(context, 0, 0, width, height, cornerRadius)
  context.stroke()
}

const drawBentPosterCard = (
  context: CanvasRenderingContext2D,
  slide: HeroSlide,
  imageMap: Map<string, HTMLImageElement>,
  width: number,
  height: number,
  frontWeight: number,
  sideLean: number,
  time: number,
  bendAmount: number,
) => {
  if (typeof document === 'undefined') {
    drawPosterCard(context, slide, imageMap, width, height, frontWeight, sideLean, time)
    return
  }

  const surface = document.createElement('canvas')
  surface.width = Math.max(1, Math.round(width))
  surface.height = Math.max(1, Math.round(height))

  const surfaceContext = surface.getContext('2d')

  if (!surfaceContext) {
    drawPosterCard(context, slide, imageMap, width, height, frontWeight, sideLean, time)
    return
  }

  drawPosterCard(surfaceContext, slide, imageMap, surface.width, surface.height, frontWeight, sideLean, time)

  const slices = 30
  const sourceSliceWidth = surface.width / slices
  const widthFactors: number[] = []
  let factorSum = 0

  for (let index = 0; index < slices; index += 1) {
    const normalized = slices <= 1 ? 0 : index / (slices - 1)
    const centered = normalized * 2 - 1
    const edgeWeight = Math.abs(centered)
    const widthFactor = 1 - bendAmount * 0.34 * Math.pow(edgeWeight, 1.35)
    widthFactors.push(widthFactor)
    factorSum += widthFactor
  }

  let drawX = 0

  for (let index = 0; index < slices; index += 1) {
    const normalized = slices <= 1 ? 0 : index / (slices - 1)
    const centered = normalized * 2 - 1
    const edgeWeight = Math.abs(centered)
    const destSliceWidth = (widthFactors[index] / factorSum) * width
    const edgeDrop = bendAmount * height * 0.035 * Math.pow(edgeWeight, 1.6)
    const centerLift = bendAmount * height * 0.018 * (1 - Math.pow(edgeWeight, 1.4))
    const destY = edgeDrop - centerLift
    const destHeight = height - edgeDrop * 2 + centerLift * 2

    context.drawImage(
      surface,
      index * sourceSliceWidth,
      0,
      sourceSliceWidth + 1,
      surface.height,
      drawX,
      destY,
      destSliceWidth + 0.6,
      destHeight,
    )

    drawX += destSliceWidth
  }

  const foldShade = context.createLinearGradient(0, 0, width, 0)
  foldShade.addColorStop(0, `rgba(0, 0, 0, ${0.08 + bendAmount * 0.12})`)
  foldShade.addColorStop(0.16, 'rgba(255, 255, 255, 0.035)')
  foldShade.addColorStop(0.5, 'rgba(255, 255, 255, 0)')
  foldShade.addColorStop(0.84, 'rgba(255, 255, 255, 0.03)')
  foldShade.addColorStop(1, `rgba(0, 0, 0, ${0.06 + bendAmount * 0.1})`)
  context.fillStyle = foldShade
  context.fillRect(0, 0, width, height)
}

const createPosterSurface = (
  slide: HeroSlide,
  imageMap: Map<string, HTMLImageElement>,
  width = 1600,
) => {
  const height = Math.round(width / CARD_ASPECT_RATIO)
  const surface = document.createElement('canvas')
  surface.width = width
  surface.height = height

  const surfaceContext = surface.getContext('2d')

  if (surfaceContext) {
    surfaceContext.clearRect(0, 0, width, height)
    drawPosterCard(surfaceContext, slide, imageMap, width, height, 1, 0, 0)
  }

  return surface
}

const Banner = () => {
  const [rotationOffset, setRotationOffset] = useState(0)
  const [activeSequence, setActiveSequence] = useState(0)
  const stageRef = useRef<HTMLElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rotationOffsetRef = useRef(0)
  const activeSequenceRef = useRef(0)
  const autoStartTimeRef = useRef<number | null>(null)
  const autoCycleIndexRef = useRef(0)
  const autoCycleCarryRef = useRef(0)
  const dragRef = useRef<DragState>({
    active: false,
    pointerId: null,
    startX: 0,
    startRotation: 0,
  })
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const reducedMotionRef = useRef(false)
  const sceneRef = useRef<CanvasScene>({
    rotation: 0,
    targetRotation: 0,
    pointerX: 0,
    pointerY: 0,
    tiltX: 0,
    tiltY: 0,
    width: 0,
    height: 0,
  })

  const activeIndex = wrapIndex(activeSequence + CENTERED_SLIDE_OFFSET)
  const currentSlide = slides[activeIndex]
  const currentPalette = getSlidePalette(currentSlide)
  const slideAssetSignature = slides
    .map((slide) => [slide.id, slide.imageSrc ?? '', slide.accentImageSrc ?? '', slide.thumbSrc ?? ''].join('|'))
    .join('::')

  useEffect(() => {
    rotationOffsetRef.current = rotationOffset
  }, [rotationOffset])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    root.style.setProperty('--student-hero-sync-bg-start', currentPalette.shellStart)
    root.style.setProperty('--student-hero-sync-bg-mid', currentPalette.shellMid)
    root.style.setProperty('--student-hero-sync-bg-end', currentPalette.shellEnd)
    root.style.setProperty('--student-hero-sync-accent', currentPalette.glow)
    root.style.setProperty('--student-hero-sync-contour', currentPalette.contour)
    root.style.setProperty('--student-section-bridge-color', currentPalette.shellEnd)
    root.style.setProperty('--student-section-surface-color', '#eef8ff')

    return () => {
      root.style.removeProperty('--student-hero-sync-bg-start')
      root.style.removeProperty('--student-hero-sync-bg-mid')
      root.style.removeProperty('--student-hero-sync-bg-end')
      root.style.removeProperty('--student-hero-sync-accent')
      root.style.removeProperty('--student-hero-sync-contour')
      root.style.removeProperty('--student-section-bridge-color')
      root.style.removeProperty('--student-section-surface-color')
    }
  }, [
    currentPalette.shellStart,
    currentPalette.shellMid,
    currentPalette.shellEnd,
    currentPalette.glow,
    currentPalette.contour,
  ])

  const resetAutoCycleClock = () => {
    autoStartTimeRef.current = typeof performance === 'undefined' ? null : performance.now()
    autoCycleIndexRef.current = 0
    autoCycleCarryRef.current = 0
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncReducedMotion = () => {
      reducedMotionRef.current = mediaQuery.matches
    }

    syncReducedMotion()
    mediaQuery.addEventListener('change', syncReducedMotion)

    return () => {
      mediaQuery.removeEventListener('change', syncReducedMotion)
    }
  }, [slideAssetSignature])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const sources = Array.from(
      new Set(
        slides.flatMap((slide) => [slide.imageSrc, slide.accentImageSrc, slide.thumbSrc].filter(Boolean) as string[]),
      ),
    )

    sources.forEach((source) => {
      if (imagesRef.current.has(source)) {
        return
      }

      const image = new Image()
      image.decoding = 'async'
      image.src = source
      imagesRef.current.set(source, image)
    })

    return undefined
  }, [slideAssetSignature])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined
    }

    const stage = stageRef.current
    const canvas = canvasRef.current

    if (!stage || !canvas) {
      return undefined
    }

    const scene = sceneRef.current
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)

    const scene3d = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
    camera.position.set(ORBIT_CAMERA_X, ORBIT_CAMERA_Y, ORBIT_CAMERA_Z)
    camera.lookAt(ORBIT_LOOK_AT_X, ORBIT_LOOK_AT_Y, ORBIT_LOOK_AT_Z)

    const carouselGroup = new THREE.Group()
    carouselGroup.position.set(ORBIT_PRESENTATION_SHIFT_X, ORBIT_PRESENTATION_SHIFT_Y, 0)
    scene3d.add(carouselGroup)

    scene3d.add(new THREE.AmbientLight(0xffffff, 1.28))

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.78)
    keyLight.position.set(-3.5, 4.6, 11)
    scene3d.add(keyLight)

    const rimLight = new THREE.PointLight(0xffffff, 0.55, 36, 2)
    rimLight.position.set(4.8, -1.4, 7)
    scene3d.add(rimLight)

    const glowCanvas = document.createElement('canvas')
    glowCanvas.width = 512
    glowCanvas.height = 192
    const glowContext = glowCanvas.getContext('2d')

    if (glowContext) {
      const glowGradient = glowContext.createRadialGradient(
        glowCanvas.width * 0.5,
        glowCanvas.height * 0.5,
        glowCanvas.width * 0.06,
        glowCanvas.width * 0.5,
        glowCanvas.height * 0.5,
        glowCanvas.width * 0.42,
      )
      glowGradient.addColorStop(0, 'rgba(255,255,255,0.8)')
      glowGradient.addColorStop(0.18, 'rgba(255,255,255,0.34)')
      glowGradient.addColorStop(0.52, 'rgba(255,255,255,0.12)')
      glowGradient.addColorStop(1, 'rgba(255,255,255,0)')
      glowContext.fillStyle = glowGradient
      glowContext.fillRect(0, 0, glowCanvas.width, glowCanvas.height)
    }

    const glowTexture = new THREE.CanvasTexture(glowCanvas)
    glowTexture.colorSpace = THREE.SRGBColorSpace
    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const deckGlow = new THREE.Sprite(glowMaterial)
    deckGlow.position.set(ORBIT_CENTER_X, -4.15, 0)
    deckGlow.scale.set(ORBIT_RADIUS_X * 2.1, 5.4, 1)
    scene3d.add(deckGlow)

    const anisotropy = renderer.capabilities.getMaxAnisotropy()
    const cardEntries = RENDER_SLOT_OFFSETS.map((slotOffset) => {
      const slideIndex = wrapIndex(slotOffset)
      const surface = createPosterSurface(slides[slideIndex], imagesRef.current)
      const texture = new THREE.CanvasTexture(surface)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = anisotropy
      texture.needsUpdate = true

      const planeWidth = CARD_PLANE_WIDTH
      const planeHeight = planeWidth / CARD_ASPECT_RATIO
      const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight, 38, 18)
      const positionAttribute = geometry.attributes.position as THREE.BufferAttribute
      const basePositions = Float32Array.from(positionAttribute.array as ArrayLike<number>)
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.frustumCulled = false
      carouselGroup.add(mesh)

      return {
        slotOffset,
        slideIndex,
        mesh,
        geometry,
        texture,
        surface,
        basePositions,
      }
    })

    const redrawCardSurfaces = () => {
      cardEntries.forEach((entry) => {
        const surfaceContext = entry.surface.getContext('2d')

        if (!surfaceContext) {
          return
        }

        const slide = slides[entry.slideIndex]
        surfaceContext.clearRect(0, 0, entry.surface.width, entry.surface.height)
        drawPosterCard(surfaceContext, slide, imagesRef.current, entry.surface.width, entry.surface.height, 1, 0, 0)
        entry.texture.needsUpdate = true
      })
    }

    redrawCardSurfaces()

    const imageCleanupHandlers: Array<() => void> = []
    imagesRef.current.forEach((image) => {
      const handleLoad = () => redrawCardSurfaces()

      if (image.complete && image.naturalWidth > 0) {
        window.requestAnimationFrame(handleLoad)
        return
      }

      image.addEventListener('load', handleLoad, { once: true })
      imageCleanupHandlers.push(() => image.removeEventListener('load', handleLoad))
    })

    const updateCardGeometry = (
      entry: (typeof cardEntries)[number],
      orbitDistance: number,
      cardDistance: number,
    ) => {
      const positionAttribute = entry.geometry.attributes.position as THREE.BufferAttribute
      const width = entry.geometry.parameters.width
      const halfWidth = width / 2
      const centerPoint = getOrbitPoint(distanceToOrbitAngle(orbitDistance))

      for (let index = 0; index < positionAttribute.count; index += 1) {
        const offset = index * 3
        const baseX = entry.basePositions[offset]
        const baseY = entry.basePositions[offset + 1]
        const normalizedX = baseX / halfWidth
        const orbitPoint = getOrbitPoint(distanceToOrbitAngle(orbitDistance + normalizedX * (cardDistance / 2)))

        positionAttribute.setXYZ(index, orbitPoint.x - centerPoint.x, baseY, orbitPoint.z - centerPoint.z)
      }

      positionAttribute.needsUpdate = true
      entry.geometry.computeVertexNormals()
    }

    const resize = () => {
      const bounds = stage.getBoundingClientRect()
      const width = Math.max(320, Math.round(bounds.width))
      const height = Math.max(420, Math.round(bounds.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      scene.width = width
      scene.height = height

      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      renderer.setPixelRatio(dpr)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(stage)
    resize()

    let frame = 0

    const render = (time: number) => {
      if (autoStartTimeRef.current === null) {
        autoStartTimeRef.current = time
      }

      const autoCycleMs = AUTO_SLOW_MS + AUTO_FAST_MS
      let elapsedMs = Math.max(0, time - autoStartTimeRef.current)
      let completedCycles = Math.floor(elapsedMs / autoCycleMs)

      if (completedCycles > autoCycleIndexRef.current) {
        const missedCycles = completedCycles - autoCycleIndexRef.current
        autoCycleCarryRef.current += Math.min(missedCycles, 1)

        if (missedCycles > 1) {
          autoStartTimeRef.current = time
          autoCycleIndexRef.current = 0
          elapsedMs = 0
          completedCycles = 0
        } else {
          autoCycleIndexRef.current = completedCycles
        }
      }

      const cycleProgressMs = elapsedMs % autoCycleMs
      const slowProgress = clamp(cycleProgressMs / AUTO_SLOW_MS, 0, 1)
      const fastProgress =
        cycleProgressMs <= AUTO_SLOW_MS ? 0 : clamp((cycleProgressMs - AUTO_SLOW_MS) / AUTO_FAST_MS, 0, 1)
      const autoRotation = reducedMotionRef.current
        ? autoCycleCarryRef.current
        : autoCycleCarryRef.current +
          (cycleProgressMs <= AUTO_SLOW_MS
            ? slowProgress * AUTO_SLOW_PROGRESS
            : AUTO_SLOW_PROGRESS + easeInOutCubic(fastProgress) * (1 - AUTO_SLOW_PROGRESS))
      scene.targetRotation = rotationOffsetRef.current + autoRotation

      scene.rotation += (scene.targetRotation - scene.rotation) * (reducedMotionRef.current ? 0.18 : 0.085)
      scene.tiltX += (scene.pointerX - scene.tiltX) * (reducedMotionRef.current ? 0.18 : 0.08)
      scene.tiltY += (scene.pointerY - scene.tiltY) * (reducedMotionRef.current ? 0.18 : 0.08)

      const nextActiveSequence = Math.round(scene.rotation)

      if (nextActiveSequence !== activeSequenceRef.current) {
        activeSequenceRef.current = nextActiveSequence
        setActiveSequence(nextActiveSequence)
      }

      stage.style.setProperty('--hero-tilt-x', scene.tiltX.toFixed(3))
      stage.style.setProperty('--hero-tilt-y', scene.tiltY.toFixed(3))

      const focusSlide = slides[wrapIndex(Math.round(scene.rotation) + CENTERED_SLIDE_OFFSET)]
      const palette = getSlidePalette(focusSlide)
      glowMaterial.color.set(new THREE.Color(palette.shellEnd))
      glowMaterial.opacity = 0.36 + (reducedMotionRef.current ? 0 : 0.08)
      deckGlow.position.x = ORBIT_CENTER_X + scene.tiltX * 0.18
      deckGlow.position.y = -4.15 - scene.tiltY * 0.12

      carouselGroup.rotation.x = ORBIT_PRESENTATION_TILT_X + scene.tiltY * -0.045
      carouselGroup.rotation.y = ORBIT_PRESENTATION_TILT_Y + scene.tiltX * 0.035
      carouselGroup.rotation.z = ORBIT_PRESENTATION_TILT_Z + scene.tiltX * -0.012

      cardEntries.forEach((entry) => {
        const relative = entry.slotOffset - scene.rotation

        entry.mesh.visible = true

        const slot = sampleOrbitSlot(relative)

        updateCardGeometry(entry, slot.orbitDistance, slot.cardDistance)

        entry.mesh.position.set(slot.x + scene.tiltX * 0.16, slot.y + scene.tiltY * 0.1, slot.z)
        entry.mesh.rotation.x = slot.rotateX
        entry.mesh.rotation.y = slot.rotateY
        entry.mesh.rotation.z = slot.rotateZ
        entry.mesh.scale.setScalar(slot.scale)
        entry.mesh.renderOrder = Math.round((slot.z + ORBIT_RADIUS_Z) * 100)

        const material = entry.mesh.material as THREE.MeshBasicMaterial
        material.opacity = slot.opacity
      })

      renderer.render(scene3d, camera)

      frame = window.requestAnimationFrame(render)
    }

    frame = window.requestAnimationFrame(render)

    return () => {
      imageCleanupHandlers.forEach((cleanup) => cleanup())
      resizeObserver.disconnect()
      window.cancelAnimationFrame(frame)
      glowMaterial.dispose()
      glowTexture.dispose()
      cardEntries.forEach((entry) => {
        entry.geometry.dispose()
        entry.texture.dispose()
        ;(entry.mesh.material as THREE.Material).dispose()
      })
      renderer.dispose()
    }
  }, [])

  const handlePointerMove = (event: PointerEvent) => {
    const stage = stageRef.current

    if (!stage) {
      return
    }

    const bounds = stage.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2

    sceneRef.current.pointerX = clamp(x, -1, 1)
    sceneRef.current.pointerY = clamp(y, -1, 1)

    const drag = dragRef.current

    if (!drag.active || drag.pointerId !== event.pointerId) {
      return
    }

    const dragDistance = (event.clientX - drag.startX) / Math.max(bounds.width, 1)
    const nextRotation = drag.startRotation - dragDistance * DRAG_ROTATION_SENSITIVITY

    rotationOffsetRef.current = nextRotation
    setRotationOffset(nextRotation)
  }

  const handlePointerDown = (event: PointerEvent) => {
    const stage = stageRef.current

    if (!stage || event.button !== 0 || isInteractiveTarget(event.target)) {
      return
    }

    resetAutoCycleClock()

    dragRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startRotation: rotationOffsetRef.current,
    }

    stage.setPointerCapture(event.pointerId)
  }

  const handlePointerUp = (event: PointerEvent) => {
    const drag = dragRef.current

    if (!drag.active || drag.pointerId !== event.pointerId) {
      return
    }

    dragRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startRotation: rotationOffsetRef.current,
    }

    stageRef.current?.releasePointerCapture(event.pointerId)
    resetAutoCycleClock()

    const snappedRotation = Math.round(rotationOffsetRef.current)
    rotationOffsetRef.current = snappedRotation
    setRotationOffset(snappedRotation)
  }

  const handlePointerLeave = () => {
    sceneRef.current.pointerX = 0
    sceneRef.current.pointerY = 0
  }

  const shiftSlide = (direction: 'next' | 'prev') => {
    resetAutoCycleClock()
    setRotationOffset((current) => current + (direction === 'next' ? 1 : -1))
  }

  const jumpToSlide = (targetIndex: number) => {
    resetAutoCycleClock()
    setRotationOffset((current) => {
      const currentIndex = wrapIndex(activeSequenceRef.current + CENTERED_SLIDE_OFFSET)

      if (currentIndex === targetIndex) {
        return current
      }

      const forwardDistance = (targetIndex - currentIndex + slides.length) % slides.length
      const backwardDistance = forwardDistance - slides.length

      return current + (Math.abs(backwardDistance) < Math.abs(forwardDistance) ? backwardDistance : forwardDistance)
    })
  }

  return (
    <section
      className="hero-section"
      style={
        {
          '--hero-bg-start': currentPalette.shellStart,
          '--hero-bg-mid': currentPalette.shellMid,
          '--hero-bg-end': currentPalette.shellEnd,
          '--hero-accent': currentPalette.glow,
          '--hero-contour': currentPalette.contour,
        } as any
      }
    >
      <div
        className="hero-stage"
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        <canvas ref={canvasRef} className="hero-stage__canvas" aria-hidden="true" />
        <div className="hero-stage__vignette" aria-hidden="true" />
        <div className="hero-stage__contours" aria-hidden="true" />
        <div className="hero-stage__bottom-blur" aria-hidden="true" />
        <div className="hero-stage__lower-left-fog" aria-hidden="true" />
        <div className="hero-stage__foreground-wash" aria-hidden="true" />

        <div className="hero-stage__copy">
          <div className="hero-stage__meta">
            <span className="hero-stage__badge">
              <span aria-hidden="true">🔥</span>
              {currentSlide.badge}
            </span>
            <span className="hero-stage__category">{currentSlide.category}</span>
          </div>

          <h1 className="hero-stage__title">
            <span>{currentSlide.titleLines[0]}</span>
            <span>{currentSlide.titleLines[1]}</span>
          </h1>

          <p className="hero-stage__description">{currentSlide.description}</p>

          <a href={currentSlide.actionHref} className="hero-stage__action">
            {currentSlide.actionLabel}
          </a>
        </div>

        <div className="hero-stage__controls" aria-label="Banner slide controls">
          <button
            type="button"
            className="hero-stage__control"
            aria-label="Previous banner slide"
            onClick={() => shiftSlide('prev')}
          >
            <i className="fas fa-chevron-up" />
          </button>
          <button
            type="button"
            className="hero-stage__control"
            aria-label="Next banner slide"
            onClick={() => shiftSlide('next')}
          >
            <i className="fas fa-chevron-down" />
          </button>
        </div>

        <div className="hero-stage__thumbs">
          <span className="hero-stage__thumb-caption">See all tracks</span>
          <div className="hero-stage__thumb-row">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={`hero-stage__thumb hero-stage__thumb--${slide.theme}${index === activeIndex ? ' is-active' : ''}`}
                aria-label={`Show ${slide.titleLines.join(' ')}`}
                onClick={() => jumpToSlide(index)}
              >
                {slide.thumbSrc ? (
                  <span
                    className="hero-stage__thumb-image"
                    style={{ '--thumb-image': `url(${slide.thumbSrc})` } as any}
                  />
                ) : (
                  <span className="hero-stage__thumb-fallback">{slide.thumbLabel}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Banner
