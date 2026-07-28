import { useEffect, useRef } from 'react'
import type { RanchAnimal, RanchImages, RanchManifest } from './ranch-types'

const WIDTH = 1200
const HEIGHT = 720

type RanchCanvasProps = {
  animals: RanchAnimal[]
  manifest: RanchManifest
  images: RanchImages
  selectedId: string | null
  actionPulse: { id: string; kind: 'feed' | 'collect'; nonce: number } | null
  onSelect: (id: string) => void
}

type RenderedAnimal = { id: string; x: number; y: number; radius: number }
type ActionEffect = { id: string; kind: 'feed' | 'collect'; startedAt: number }

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

export function RanchCanvas({ animals, manifest, images, selectedId, actionPulse, onSelect }: RanchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animalsRef = useRef(animals)
  const selectedRef = useRef(selectedId)
  const renderedRef = useRef<RenderedAnimal[]>([])
  const effectsRef = useRef<ActionEffect[]>([])

  useEffect(() => { animalsRef.current = animals }, [animals])
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])
  useEffect(() => {
    if (actionPulse) effectsRef.current.push({ id: actionPulse.id, kind: actionPulse.kind, startedAt: performance.now() })
  }, [actionPulse])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    let animationFrame = 0
    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    const draw = (now: number) => {
      const compact = canvas.getBoundingClientRect().width < 640
      context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0)
      context.clearRect(0, 0, WIDTH, HEIGHT)
      context.drawImage(images[manifest.background], 0, 0, WIDTH, HEIGHT)

      effectsRef.current = effectsRef.current.filter(effect => now - effect.startedAt < 1300)
      const rendered: RenderedAnimal[] = []
      animalsRef.current.forEach((animal, index) => {
        const asset = manifest.animals[animal.speciesKey]
        const image = asset && images[asset.image]
        if (!asset || !image) return
        const phase = index * 1.73
        const rangeX = asset.zone === 'pond' ? 80 : asset.zone === 'barn' ? 42 : 72
        const rangeY = asset.zone === 'pond' ? 10 : 6
        let x = animal.x * WIDTH + Math.sin(now / (2400 / Math.max(.4, asset.speed / 18)) + phase) * rangeX
        let y = animal.y * HEIGHT + Math.sin(now / 1100 + phase) * rangeY
        if (compact) {
          x = 245 + Math.min(1, Math.max(0, (x - 30) / 1120)) * 890
          y = 355 + Math.min(1, Math.max(0, (y - 280) / 360)) * 280
        }
        const direction = Math.cos(now / (2400 / Math.max(.4, asset.speed / 18)) + phase) >= 0 ? 1 : -1
        const selected = selectedRef.current === animal.id
        const bounce = selected ? 1 + Math.sin(now / 170) * .035 : 1
        const drawWidth = asset.size
        const drawHeight = asset.size * image.height / image.width
        rendered.push({ id: animal.id, x, y, radius: Math.max(38, asset.size * .58) })

        if (selected) {
          context.beginPath()
          context.ellipse(x, y + drawHeight * .36, asset.size * .64, asset.size * .22, 0, 0, Math.PI * 2)
          context.fillStyle = 'rgba(255,239,113,.32)'
          context.fill()
          context.strokeStyle = '#fff087'
          context.lineWidth = 5
          context.setLineDash([10, 7])
          context.stroke()
          context.setLineDash([])
        }

        context.save()
        context.translate(x, y)
        context.scale(direction * bounce, bounce)
        context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
        context.restore()

        const ready = animal.hunger > 15 && Date.now() - Date.parse(animal.productionStartedAt) >= asset.productionSeconds * 1000
        if (ready) {
          const product = images[asset.productImage]
          const iconY = y - drawHeight * .62 - 70 + Math.sin(now / 240) * 5
          context.beginPath()
          context.arc(x + asset.size * .32, iconY, 29, 0, Math.PI * 2)
          context.fillStyle = '#fff8c9'
          context.fill()
          context.strokeStyle = '#d89a36'
          context.lineWidth = 4
          context.stroke()
          context.drawImage(product, x + asset.size * .32 - 19, iconY - 19, 38, 38)
        }

        const labelWidth = Math.max(112, asset.speciesName.length * 16 + 30)
        const labelY = y - drawHeight * .58 - 43
        roundRect(context, x - labelWidth / 2, labelY, labelWidth, 37, 12)
        context.fillStyle = selected ? 'rgba(255,248,196,.97)' : 'rgba(70,73,42,.83)'
        context.fill()
        context.strokeStyle = selected ? '#c48835' : 'rgba(255,255,255,.65)'
        context.lineWidth = 2
        context.stroke()
        context.textAlign = 'center'
        context.fillStyle = selected ? '#6a4826' : '#fff'
        context.font = '800 14px "Microsoft YaHei", sans-serif'
        context.fillText(animal.nickname || asset.name, x, labelY + 16)
        context.fillStyle = selected ? '#8c6c43' : '#e8f4cd'
        context.font = '10px "Microsoft YaHei", sans-serif'
        context.fillText(asset.speciesName, x, labelY + 30)

        const effect = effectsRef.current.find(item => item.id === animal.id)
        if (effect) {
          const progress = Math.min(1, (now - effect.startedAt) / 1100)
          context.globalAlpha = 1 - progress
          context.textAlign = 'center'
          context.font = '900 24px "Microsoft YaHei", sans-serif'
          context.fillStyle = effect.kind === 'feed' ? '#ff7395' : '#fff36f'
          context.strokeStyle = 'rgba(67,67,36,.6)'
          context.lineWidth = 4
          const effectText = effect.kind === 'feed' ? '♥  饱食 +25' : `+1 ${asset.productName}`
          context.strokeText(effectText, x, y - 80 - progress * 75)
          context.fillText(effectText, x, y - 80 - progress * 75)
          context.globalAlpha = 1
        }
      })
      renderedRef.current = rendered
      animationFrame = requestAnimationFrame(draw)
    }
    animationFrame = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(animationFrame); observer.disconnect() }
  }, [images, manifest])

  return <canvas
    ref={canvasRef}
    width={WIDTH}
    height={HEIGHT}
    className="block h-[390px] w-full touch-manipulation select-none sm:h-auto sm:aspect-[5/3]"
    role="application"
    aria-label="可互动牧场，点击动物可查看、喂养和收取产物"
    tabIndex={0}
    onPointerMove={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width * WIDTH
      const y = (event.clientY - rect.top) / rect.height * HEIGHT
      event.currentTarget.style.cursor = renderedRef.current.some(item => Math.hypot(item.x - x, item.y - y) <= item.radius) ? 'pointer' : 'default'
    }}
    onPointerDown={event => {
      const rect = event.currentTarget.getBoundingClientRect()
      const x = (event.clientX - rect.left) / rect.width * WIDTH
      const y = (event.clientY - rect.top) / rect.height * HEIGHT
      const selected = [...renderedRef.current].reverse().find(item => Math.hypot(item.x - x, item.y - y) <= item.radius)
      if (selected) onSelect(selected.id)
    }}
  />
}
