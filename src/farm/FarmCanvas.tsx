import { useEffect, useRef } from 'react'
import type { FarmAssetManifest, FarmImages, FarmPlot, PlantState } from './farm-types'

const WORLD_WIDTH = 1200
const WORLD_HEIGHT = 720
const PLOT_WIDTH = 174
const PLOT_HEIGHT = 78

type FarmCanvasProps = {
  plots: FarmPlot[]
  manifest: FarmAssetManifest
  images: FarmImages
  onPlotClick: (position: number) => void
}

type PlotEffect = { position: number; type: 'shake' | 'sow' | 'harvest'; startedAt: number }

function plotCenter(position: number) {
  const row = Math.floor(position / 4)
  const column = position % 4
  return { x: 390 + column * 145 + (row % 2) * 18, y: 405 + row * 101 }
}

function diamondPath(context: CanvasRenderingContext2D, x: number, y: number) {
  context.beginPath()
  context.moveTo(x, y - PLOT_HEIGHT / 2)
  context.lineTo(x + PLOT_WIDTH / 2, y)
  context.lineTo(x, y + PLOT_HEIGHT / 2)
  context.lineTo(x - PLOT_WIDTH / 2, y)
  context.closePath()
}

function isPointInPlot(x: number, y: number, position: number) {
  const center = plotCenter(position)
  return Math.abs(x - center.x) / (PLOT_WIDTH / 2) + Math.abs(y - center.y) / (PLOT_HEIGHT / 2) <= 1
}

function plantSize(state: PlantState) {
  return ({ seed: 54, sprout: 68, small: 88, medium: 110, large: 128, ready: 138, harvest: 124 })[state]
}

export function FarmCanvas({ plots, manifest, images, onPlotClick }: FarmCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const plotsRef = useRef(plots)
  const hoverRef = useRef<number | null>(null)
  const effectsRef = useRef<PlotEffect[]>([])

  useEffect(() => { plotsRef.current = plots }, [plots])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    let frame = 0
    let resizeObserver: ResizeObserver | null = null

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
    }
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    resize()

    const draw = (now: number) => {
      const scaleX = canvas.width / WORLD_WIDTH
      const scaleY = canvas.height / WORLD_HEIGHT
      context.setTransform(scaleX, 0, 0, scaleY, 0, 0)
      context.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      context.drawImage(images[manifest.background], 0, 0, WORLD_WIDTH, WORLD_HEIGHT)

      effectsRef.current = effectsRef.current.filter(effect => now - effect.startedAt < (effect.type === 'harvest' ? 1150 : 750))

      plotsRef.current.forEach(plot => {
        const center = plotCenter(plot.position)
        const effect = effectsRef.current.find(item => item.position === plot.position)
        const age = effect ? now - effect.startedAt : 0
        const shake = effect && age < 280 ? Math.sin(age * .14) * (1 - age / 280) * 7 : 0
        const x = center.x + shake
        const hovered = hoverRef.current === plot.position

        context.save()
        context.shadowColor = 'rgba(52, 50, 24, .25)'
        context.shadowBlur = hovered ? 18 : 11
        context.shadowOffsetY = 9
        diamondPath(context, x, center.y)
        context.fillStyle = hovered ? '#a36a38' : '#8a572f'
        context.fill()
        context.shadowColor = 'transparent'
        context.lineWidth = hovered ? 5 : 4
        context.strokeStyle = hovered ? '#ffe49a' : '#d6a267'
        context.stroke()
        context.clip()
        context.strokeStyle = 'rgba(67, 37, 22, .42)'
        context.lineWidth = 3
        for (let offset = -65; offset <= 65; offset += 25) {
          context.beginPath()
          context.moveTo(x + offset - 44, center.y + 25)
          context.lineTo(x + offset + 44, center.y - 25)
          context.stroke()
        }
        context.restore()

        if (effect?.type === 'sow' && age < 600) {
          for (let seed = 0; seed < 7; seed += 1) {
            const progress = Math.min(1, age / 500)
            const angle = seed * .9
            const seedX = x + Math.cos(angle) * 48 * progress
            const seedY = center.y - 50 + progress * (35 + seed * 2) + Math.sin(angle) * 11
            context.beginPath()
            context.arc(seedX, seedY, 4, 0, Math.PI * 2)
            context.fillStyle = '#33251d'
            context.fill()
          }
        }

        if (plot.plantKey && plot.growthState) {
          const plant = manifest.plants[plot.plantKey]
          const stage = plant?.states[plot.growthState]
          const image = stage ? images[stage.image] : null
          if (image) {
            const phase = now / 1000 + plot.position
            const size = plantSize(plot.growthState)
            let rotation = 0
            let plantScale = 1
            let alpha = 1
            if (stage.animation === 'blink') alpha = .72 + Math.sin(phase * 6) * .18
            if (stage.animation === 'sway') rotation = Math.sin(phase * 2.4) * .055
            if (stage.animation === 'grow') plantScale = 1 + Math.sin(phase * 1.6) * .018
            if (stage.animation === 'ready') plantScale = 1 + Math.sin(phase * 3.2) * .035
            if (stage.animation === 'harvest') {
              plantScale = Math.max(.1, 1 - age / 700)
              rotation = age / 370
              alpha = Math.max(0, 1 - age / 700)
            }
            context.save()
            context.translate(x, center.y + 28)
            context.rotate(rotation)
            context.scale(plantScale, plantScale)
            context.globalAlpha = alpha
            context.drawImage(image, -size / 2, -size + 12, size, size)
            context.restore()

            if (plot.growthState === 'ready') {
              const sparkle = images[manifest.effects.sparkle]
              if (sparkle) {
                const sparkleSize = 31 + Math.sin(phase * 4) * 5
                context.globalAlpha = .7 + Math.sin(phase * 4) * .2
                context.drawImage(sparkle, x + 42, center.y - 92, sparkleSize, sparkleSize)
                context.globalAlpha = 1
              }
              context.fillStyle = '#fff7d2'
              context.strokeStyle = '#8b5c28'
              context.lineWidth = 3
              context.beginPath()
              context.roundRect(x - 34, center.y - 112, 68, 27, 13)
              context.fill()
              context.stroke()
              context.fillStyle = '#70451f'
              context.font = '700 13px "Microsoft YaHei", sans-serif'
              context.textAlign = 'center'
              context.fillText('点击收获', x, center.y - 94)
            }
          }
        }

        if (effect?.type === 'harvest') {
          const progress = Math.min(1, age / 900)
          const startX = center.x
          const startY = center.y - 36
          const coinX = startX + (365 - startX) * progress
          const coinY = startY + (46 - startY) * progress - Math.sin(progress * Math.PI) * 110
          const coin = images[manifest.ui.coin]
          if (coin) context.drawImage(coin, coinX - 14, coinY - 14, 28, 28)
          context.globalAlpha = Math.max(0, 1 - progress)
          context.fillStyle = '#fff8d5'
          context.strokeStyle = '#744b25'
          context.lineWidth = 4
          context.font = '800 22px "Microsoft YaHei", sans-serif'
          context.textAlign = 'center'
          context.strokeText('+20金币  +5经验', startX, startY - age * .045)
          context.fillText('+20金币  +5经验', startX, startY - age * .045)
          context.globalAlpha = 1
        }
      })

      const chicken = images[manifest.animals.chicken]
      if (chicken) {
        const chickenX = 965 + Math.sin(now / 2200) * 38
        const bounce = Math.abs(Math.sin(now / 310)) * 4
        context.drawImage(chicken, chickenX, 520 - bounce, 86, 86)
      }

      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
    }
  }, [images, manifest])

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / rect.width * WORLD_WIDTH, y: (event.clientY - rect.top) / rect.height * WORLD_HEIGHT }
  }

  const findPlot = (x: number, y: number) => [...plotsRef.current].reverse().find(plot => isPointInPlot(x, y, plot.position))

  return <canvas
    ref={canvasRef}
    width={WORLD_WIDTH}
    height={WORLD_HEIGHT}
    className="block aspect-[5/3] w-full touch-manipulation select-none"
    role="application"
    aria-label="可交互农场，点击空土地播种，点击成熟植物收获"
    tabIndex={0}
    onPointerMove={event => {
      const point = pointFromEvent(event)
      hoverRef.current = findPlot(point.x, point.y)?.position ?? null
      event.currentTarget.style.cursor = hoverRef.current === null ? 'default' : 'pointer'
    }}
    onPointerLeave={() => { hoverRef.current = null }}
    onPointerDown={event => {
      const point = pointFromEvent(event)
      const plot = findPlot(point.x, point.y)
      if (!plot) return
      const type = !plot.plantKey ? 'sow' : plot.growthState === 'ready' ? 'harvest' : 'shake'
      effectsRef.current = [...effectsRef.current.filter(effect => effect.position !== plot.position), { position: plot.position, type, startedAt: performance.now() }]
      onPlotClick(plot.position)
    }}
  />
}
