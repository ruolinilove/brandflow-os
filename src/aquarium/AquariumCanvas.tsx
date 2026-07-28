import { useEffect, useRef } from 'react'
import type { AquariumCreature, AquariumImages, AquariumManifest } from './aquarium-types'

const WIDTH = 1200
const HEIGHT = 720

type AquariumCanvasProps = {
  creatures: AquariumCreature[]
  manifest: AquariumManifest
  images: AquariumImages
  selectedId: string | null
  feedPulse: { id: string; nonce: number } | null
  onSelect: (id: string) => void
}

type RenderedCreature = { id: string; x: number; y: number; radius: number }
type FeedEffect = { id: string; startedAt: number }

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
}

export function AquariumCanvas({ creatures, manifest, images, selectedId, feedPulse, onSelect }: AquariumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const creaturesRef = useRef(creatures)
  const selectedRef = useRef(selectedId)
  const renderedRef = useRef<RenderedCreature[]>([])
  const effectsRef = useRef<FeedEffect[]>([])

  useEffect(() => { creaturesRef.current = creatures }, [creatures])
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])
  useEffect(() => { if (feedPulse) effectsRef.current.push({ id: feedPulse.id, startedAt: performance.now() }) }, [feedPulse])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
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
      const compact = canvas.getBoundingClientRect().width < 600
      context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0)
      context.clearRect(0, 0, WIDTH, HEIGHT)
      context.drawImage(images[manifest.background], 0, 0, WIDTH, HEIGHT)

      for (let bubble = 0; bubble < 24; bubble += 1) {
        const lane = (bubble * 83) % 1130 + 35
        const y = HEIGHT - ((now * (.014 + bubble % 4 * .003) + bubble * 71) % 720)
        const radius = 3 + bubble % 5
        context.beginPath()
        context.arc(lane + Math.sin(now / 700 + bubble) * 10, y, radius, 0, Math.PI * 2)
        context.fillStyle = 'rgba(220,250,255,.28)'
        context.fill()
        context.strokeStyle = 'rgba(255,255,255,.46)'
        context.lineWidth = 1.5
        context.stroke()
      }

      effectsRef.current = effectsRef.current.filter(effect => now - effect.startedAt < 1150)
      const rendered: RenderedCreature[] = []
      creaturesRef.current.forEach((creature, index) => {
        const asset = manifest.creatures[creature.speciesKey]
        const image = asset && images[asset.image]
        if (!asset || !image) return
        const phase = index * 1.37
        const speedFactor = asset.speed / 35
        const range = asset.zone === 'bottom' ? 8 : asset.zone === 'reef' ? 38 : 72
        let x = creature.x * WIDTH + Math.sin(now / 2200 * speedFactor + phase) * range
        let y = creature.y * HEIGHT + Math.sin(now / (asset.zone === 'upper' ? 1150 : 1650) + phase) * (asset.zone === 'bottom' ? 3 : 18)
        if (asset.zone === 'bottom') y = Math.max(598, y)
        if (compact) y = 320 + Math.min(1, Math.max(0, (y - 100) / 550)) * 300
        const direction = Math.cos(now / 2200 * speedFactor + phase) >= 0 ? 1 : -1
        const selected = selectedRef.current === creature.id
        const pulse = selected ? 1 + Math.sin(now / 190) * .025 : 1
        rendered.push({ id: creature.id, x, y, radius: asset.size * .55 })

        if (selected) {
          context.beginPath()
          context.ellipse(x, y + asset.size * .18, asset.size * .72, asset.size * .46, 0, 0, Math.PI * 2)
          context.fillStyle = 'rgba(255,224,112,.18)'
          context.fill()
          context.strokeStyle = '#ffe47b'
          context.lineWidth = 4
          context.setLineDash([9, 7])
          context.stroke()
          context.setLineDash([])
        }

        context.save()
        context.translate(x, y)
        context.scale(direction * pulse, pulse)
        const drawWidth = asset.size
        const drawHeight = asset.size * (image.height / image.width)
        context.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
        context.restore()

        const labelWidth = Math.max(116, asset.name.length * 20 + 36)
        const labelY = y - asset.size * .57 - 47
        roundedRect(context, x - labelWidth / 2, labelY, labelWidth, 39, 12)
        context.fillStyle = selected ? 'rgba(255,242,177,.96)' : 'rgba(8,47,75,.82)'
        context.fill()
        context.strokeStyle = selected ? '#d69d32' : 'rgba(202,245,255,.6)'
        context.lineWidth = 2
        context.stroke()
        context.textAlign = 'center'
        context.fillStyle = selected ? '#5c3b20' : '#fff'
        context.font = '700 14px "Microsoft YaHei", sans-serif'
        context.fillText(creature.nickname || asset.name, x, labelY + 16)
        context.fillStyle = selected ? '#87633e' : '#bceaf1'
        context.font = '10px Arial, sans-serif'
        context.fillText(asset.scientificName, x, labelY + 30)

        const effect = effectsRef.current.find(item => item.id === creature.id)
        if (effect) {
          const progress = Math.min(1, (now - effect.startedAt) / 1000)
          for (let heart = 0; heart < 5; heart += 1) {
            const angle = heart / 5 * Math.PI * 2
            const hx = x + Math.cos(angle) * (25 + progress * 38)
            const hy = y - progress * 75 + Math.sin(angle) * 18
            context.globalAlpha = 1 - progress
            context.fillStyle = '#ff89a5'
            context.font = '700 22px Arial'
            context.fillText('♥', hx, hy)
          }
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
    className="block h-[340px] w-full touch-manipulation select-none sm:h-auto sm:aspect-[5/3]"
    role="application"
    aria-label="可互动海洋馆，所有生物均有名称和学名标注"
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
