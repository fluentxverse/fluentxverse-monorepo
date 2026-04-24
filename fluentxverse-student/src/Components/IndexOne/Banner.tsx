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

type PosterPoseAnchor = {
  relative: number
  centerX: number
  centerY: number
  width: number
  aspect: number
  rotate: number
  skewX: number
  squashY: number
  opacity: number
  depth: number
}

type OrbitSlotAnchor = {
  relative: number
  x: number
  y: number
  z: number
  scale: number
  rotateX: number
  rotateY: number
  rotateZ: number
  opacity: number
  bendDepth: number
  foldDrop: number
}

const AUTO_SLOW_MS = 5000
const AUTO_FAST_MS = 900
const AUTO_SLOW_PROGRESS = 0.22
const SLOT_RANGE = 2.2
const RENDER_SLOT_OFFSETS = [-2, -1, 0, 1, 2] as const
const CARD_ASPECT_RATIO = 1.86

const posterPoseAnchors: PosterPoseAnchor[] = [
  {
    relative: -2.3,
    centerX: -0.24,
    centerY: 0.56,
    width: 0.22,
    aspect: 1.58,
    rotate: -15,
    skewX: -0.1,
    squashY: 0.96,
    opacity: 0.12,
    depth: 0.04,
  },
  {
    relative: -1,
    centerX: -0.01,
    centerY: 0.54,
    width: 0.29,
    aspect: 1.58,
    rotate: -13,
    skewX: -0.08,
    squashY: 0.97,
    opacity: 0.52,
    depth: 0.24,
  },
  {
    relative: 0,
    centerX: 0.41,
    centerY: 0.46,
    width: 0.64,
    aspect: 1.57,
    rotate: -6.5,
    skewX: -0.035,
    squashY: 1,
    opacity: 1,
    depth: 1,
  },
  {
    relative: 1,
    centerX: 0.96,
    centerY: 0.46,
    width: 0.35,
    aspect: 1.58,
    rotate: 5,
    skewX: 0.075,
    squashY: 0.98,
    opacity: 0.66,
    depth: 0.38,
  },
  {
    relative: 2.3,
    centerX: 1.16,
    centerY: 0.45,
    width: 0.24,
    aspect: 1.58,
    rotate: 12,
    skewX: 0.1,
    squashY: 0.97,
    opacity: 0.18,
    depth: 0.08,
  },
]

const orbitSlotAnchors: OrbitSlotAnchor[] = [
  {
    relative: -2.2,
    x: -16.2,
    y: -0.34,
    z: -2.8,
    scale: 0.60,
    rotateX: 0,
    rotateY: 1.2,
    rotateZ: -0.22,
    opacity: 0.72,
    bendDepth: 0.78,
    foldDrop: 0.18,
  },
  {
    relative: -1,
    x: -11.2,
    y: -0.54,
    z: -1.42,
    scale: 0.7,
    rotateX: 0,
    rotateY: 1.02,
    rotateZ: -0.18,
    opacity: 0.8,
    bendDepth: 0.54,
    foldDrop: 0.12,
  },
  {
    relative: 0,
    x: -0.05,
    y: 0.42,
    z: 1.14,
    scale: 1.08,
    rotateX: -0.04,
    rotateY: 0,
    rotateZ: 0.15,
    opacity: 1,
    bendDepth: 0.48,
    foldDrop: 0.055,
  },
  {
    relative: 1,
    x: 5.05,
    y: -0.48,
    z: -1.52,
    scale: 0.73,
    rotateX: 0,
    rotateY: -0.8,
    rotateZ: -0.06,
    opacity: 0.82,
    bendDepth: 0.62,
    foldDrop: 0.13,
  },
  {
    relative: 2.2,
    x: 10.9,
    y: -0.28,
    z: 0.14,
    scale: 0.78,
    rotateX: 0,
    rotateY: -0.88,
    rotateZ: 0.04,
    opacity: 0.96,
    bendDepth: 0.84,
    foldDrop: 0.18,
  },
]

const slides: HeroSlide[] = [
  {
    id: 'speak-ready',
    theme: 'ember',
    badge: 'HOT',
    category: 'LESSONS',
    titleLines: ['SPEAK', 'READY'],
    description: 'Private English sessions that feel personal, focused, and easy to start from day one.',
    actionHref: '/browse-tutors',
    actionLabel: 'Launch',
    imageSrc: '/assets/img/banner/banner_woman.png',
    thumbSrc: '/assets/img/banner/banner_woman.png',
    thumbLabel: 'Speak',
    cardStart: '#120914',
    cardEnd: '#6b2417',
  },
  {
    id: 'flex-pass',
    theme: 'acid',
    badge: 'FLEX',
    category: 'TICKETS',
    titleLines: ['FLEX', 'PASS'],
    description: 'Keep trial and premium tickets on hand so you can jump into lessons whenever time opens up.',
    actionHref: '/register',
    actionLabel: 'Start',
    imageSrc: '/assets/img/icons/premium_ticket2.png',
    accentImageSrc: '/assets/img/icons/trial_ticket.png',
    thumbSrc: '/assets/img/icons/basic_ticket2.png',
    thumbLabel: 'Pass',
    cardStart: '#0d130f',
    cardEnd: '#516a19',
  },
  {
    id: 'tutor-match',
    theme: 'ocean',
    badge: 'LIVE',
    category: 'TUTORS',
    titleLines: ['TUTOR', 'MATCH'],
    description: 'Browse tutor styles, compare vibes, and book the teacher that fits your week best.',
    actionHref: '/browse-tutors',
    actionLabel: 'Explore',
    imageSrc: '/assets/img/banner/group_banner.png',
    thumbSrc: '/assets/img/banner/group_banner.png',
    thumbLabel: 'Match',
    cardStart: '#08111a',
    cardEnd: '#1c5e7b',
  },
]

const themePalettes: Record<SlideTheme, ThemePalette> = {
  ember: {
    shellStart: '#090b12',
    shellEnd: '#260d1b',
    glow: 'rgba(255, 101, 39, 0.24)',
    contour: 'rgba(255, 255, 255, 0.24)',
    rim: 'rgba(255, 255, 255, 0.15)',
    fog: 'rgba(255, 120, 48, 0.18)',
  },
  ocean: {
    shellStart: '#07111a',
    shellEnd: '#0d3246',
    glow: 'rgba(112, 214, 255, 0.22)',
    contour: 'rgba(255, 255, 255, 0.22)',
    rim: 'rgba(255, 255, 255, 0.14)',
    fog: 'rgba(133, 221, 255, 0.16)',
  },
  acid: {
    shellStart: '#090d0d',
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

const easeInOutCubic = (value: number) =>
  value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2

const sampleOrbitSlot = (relative: number) => {
  const minRelative = orbitSlotAnchors[0].relative
  const maxRelative = orbitSlotAnchors[orbitSlotAnchors.length - 1].relative
  const clampedRelative = clamp(relative, minRelative, maxRelative)
  const center = orbitSlotAnchors[2]
  const progressFromCenter = Math.min(1, Math.abs(clampedRelative) / SLOT_RANGE)
  const easedDepth = easeInOutCubic(progressFromCenter)
  const angle = clampedRelative * 0.62
  const sinAngle = Math.sin(angle)
  const cosAngle = Math.cos(angle)
  const sideWeight = Math.abs(sinAngle)
  const depthWeight = 1 - cosAngle
  const side = Math.sign(clampedRelative)

  return {
    x: center.x + sinAngle * 11.35,
    y: center.y - sideWeight * sideWeight * 0.92 - progressFromCenter * 0.12,
    z: center.z - depthWeight * 8.15 - progressFromCenter * 0.35,
    scale: clamp(center.scale - depthWeight * 1.7 - progressFromCenter * 0.08, 0.46, center.scale),
    rotateX: lerp(center.rotateX, 0, easedDepth),
    rotateY: clamp(angle * 1.45, -1.18, 1.18),
    rotateZ: center.rotateZ - side * sideWeight * 0.19 - easedDepth * 0.04,
    opacity: lerp(center.opacity, 0.72, easedDepth),
    bendDepth: lerp(center.bendDepth, 0.76, easedDepth),
    foldDrop: lerp(center.foldDrop, 0.16, easedDepth),
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
    context.shadowColor = 'rgba(0, 0, 0, 0.32)'
    context.shadowBlur = 24
    context.shadowOffsetY = 18
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
  const cornerRadius = Math.max(12, Math.min(width, height) * 0.02)
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

  if (slide.theme === 'acid') {
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
  overlay.addColorStop(0, 'rgba(6, 10, 18, 0.08)')
  overlay.addColorStop(0.48, 'rgba(6, 10, 18, 0.14)')
  overlay.addColorStop(1, 'rgba(6, 10, 18, 0.64)')
  context.fillStyle = overlay
  context.fillRect(0, 0, width, height)

  const sheen = context.createLinearGradient(0, 0, width, height)
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.11)')
  sheen.addColorStop(0.36, 'rgba(255, 255, 255, 0.02)')
  sheen.addColorStop(1, 'rgba(255, 255, 255, 0.08)')
  context.fillStyle = sheen
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

  const activeIndex = wrapIndex(activeSequence)
  const currentSlide = slides[activeIndex]

  useEffect(() => {
    rotationOffsetRef.current = rotationOffset
  }, [rotationOffset])

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
  }, [])

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
  }, [])

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
    const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100)
    camera.position.set(0, 0.18, 13.7)

    const carouselGroup = new THREE.Group()
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
    deckGlow.position.set(-0.85, -4.15, -0.8)
    deckGlow.scale.set(17.2, 5.4, 1)
    scene3d.add(deckGlow)

    const anisotropy = renderer.capabilities.getMaxAnisotropy()
    const cardEntries = RENDER_SLOT_OFFSETS.map((slotOffset) => {
      const slideIndex = wrapIndex(slotOffset)
      const surface = createPosterSurface(slides[slideIndex], imagesRef.current)
      const texture = new THREE.CanvasTexture(surface)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = anisotropy
      texture.needsUpdate = true

      const planeWidth = 8.15
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
      if (image.complete) {
        return
      }

      const handleLoad = () => redrawCardSurfaces()
      image.addEventListener('load', handleLoad)
      imageCleanupHandlers.push(() => image.removeEventListener('load', handleLoad))
    })

    const updateCardGeometry = (entry: (typeof cardEntries)[number], bendDepth: number, foldDrop: number) => {
      const positionAttribute = entry.geometry.attributes.position as THREE.BufferAttribute
      const width = entry.geometry.parameters.width
      const height = entry.geometry.parameters.height
      const halfWidth = width / 2
      const halfHeight = height / 2

      for (let index = 0; index < positionAttribute.count; index += 1) {
        const offset = index * 3
        const baseX = entry.basePositions[offset]
        const baseY = entry.basePositions[offset + 1]
        const normalizedX = baseX / halfWidth
        const normalizedY = baseY / halfHeight
        const edgeWeight = Math.abs(normalizedX)
        const roundedBend = Math.pow(edgeWeight, 1.9)
        const foldedZ = -bendDepth * roundedBend * 0.54
        const verticalDrop = foldDrop * Math.pow(edgeWeight, 2.2) * 0.34 * (0.92 + Math.abs(normalizedY) * 0.08)
        const liftedY = baseY - verticalDrop

        positionAttribute.setXYZ(index, baseX, liftedY, foldedZ)
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

      const width = scene.width
      const height = scene.height
      const elapsedMs = time - autoStartTimeRef.current
      const autoCycleMs = AUTO_SLOW_MS + AUTO_FAST_MS
      const completedCycles = Math.floor(elapsedMs / autoCycleMs)
      const cycleProgressMs = elapsedMs % autoCycleMs
      const slowProgress = clamp(cycleProgressMs / AUTO_SLOW_MS, 0, 1)
      const fastProgress =
        cycleProgressMs <= AUTO_SLOW_MS ? 0 : clamp((cycleProgressMs - AUTO_SLOW_MS) / AUTO_FAST_MS, 0, 1)
      const autoRotation = reducedMotionRef.current
        ? completedCycles
        : completedCycles +
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

      const focusSlide = slides[wrapIndex(Math.round(scene.rotation))]
      const palette = themePalettes[focusSlide.theme]
      glowMaterial.color.set(new THREE.Color(palette.shellEnd))
      glowMaterial.opacity = 0.36 + (reducedMotionRef.current ? 0 : 0.08)
      deckGlow.position.x = -0.92 + scene.tiltX * 0.18
      deckGlow.position.y = -4.15 - scene.tiltY * 0.12

      carouselGroup.rotation.x = -0.045 + scene.tiltY * -0.08
      carouselGroup.rotation.y = scene.tiltX * 0.1
      carouselGroup.rotation.z = -0.03 + scene.tiltX * -0.02

      const centerSequence = Math.round(scene.rotation)

      cardEntries.forEach((entry) => {
        const sequence = centerSequence + entry.slotOffset
        const slideIndex = wrapIndex(sequence)
        const relative = sequence - scene.rotation

        if (entry.slideIndex !== slideIndex) {
          entry.slideIndex = slideIndex

          const surfaceContext = entry.surface.getContext('2d')

          if (surfaceContext) {
            surfaceContext.clearRect(0, 0, entry.surface.width, entry.surface.height)
            drawPosterCard(
              surfaceContext,
              slides[slideIndex],
              imagesRef.current,
              entry.surface.width,
              entry.surface.height,
              1,
              0,
              time,
            )
            entry.texture.needsUpdate = true
          }
        }

        if (relative < -SLOT_RANGE || relative > SLOT_RANGE) {
          entry.mesh.visible = false
          return
        }

        entry.mesh.visible = true

        const slot = sampleOrbitSlot(relative)

        updateCardGeometry(entry, slot.bendDepth, slot.foldDrop)

        entry.mesh.position.set(slot.x + scene.tiltX * 0.16, slot.y + scene.tiltY * 0.1, slot.z)
        entry.mesh.rotation.x = slot.rotateX + scene.tiltY * -0.05
        entry.mesh.rotation.y = slot.rotateY + scene.tiltX * 0.06
        entry.mesh.rotation.z = slot.rotateZ + scene.tiltX * -0.02
        entry.mesh.scale.setScalar(slot.scale)
        entry.mesh.renderOrder = Math.round((slot.z + 5) * 100)

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

  const handlePointerMove = (event: any) => {
    const stage = stageRef.current

    if (!stage) {
      return
    }

    const bounds = stage.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2

    sceneRef.current.pointerX = clamp(x, -1, 1)
    sceneRef.current.pointerY = clamp(y, -1, 1)
  }

  const handlePointerLeave = () => {
    sceneRef.current.pointerX = 0
    sceneRef.current.pointerY = 0
  }

  const shiftSlide = (direction: 'next' | 'prev') => {
    setRotationOffset((current) => current + (direction === 'next' ? 1 : -1))
  }

  const jumpToSlide = (targetIndex: number) => {
    setRotationOffset((current) => {
      const currentIndex = wrapIndex(activeSequenceRef.current)

      if (currentIndex === targetIndex) {
        return current
      }

      const forwardDistance = (targetIndex - currentIndex + slides.length) % slides.length
      const backwardDistance = forwardDistance - slides.length

      return current + (Math.abs(backwardDistance) < Math.abs(forwardDistance) ? backwardDistance : forwardDistance)
    })
  }

  return (
    <section className={`hero-section hero-section--${currentSlide.theme}`}>
      <div
        className="hero-stage"
        ref={stageRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <canvas ref={canvasRef} className="hero-stage__canvas" aria-hidden="true" />
        <div className="hero-stage__vignette" aria-hidden="true" />
        <div className="hero-stage__contours" aria-hidden="true" />

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
