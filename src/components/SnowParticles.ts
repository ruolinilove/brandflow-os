import * as THREE from 'three'

type SnowLayer = {
  points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
  positions: Float32Array
  speeds: Float32Array
  phase: Float32Array
  spread: number
  minY: number
  maxY: number
}

function makeSnowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(32, 32, 1, 32, 32, 30)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(.28, 'rgba(221,248,255,.95)')
  gradient.addColorStop(1, 'rgba(202,239,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 64, 64)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export class SnowParticles {
  group = new THREE.Group()
  private texture = makeSnowTexture()
  private layers: SnowLayer[] = []

  constructor(isMobile: boolean) {
    const settings = [
      { count: isMobile ? 180 : 420, size: .2, speed: 2.25, opacity: .8, zMin: 3, zMax: 12, spread: 22 },
      { count: isMobile ? 360 : 820, size: .1, speed: 1.15, opacity: .72, zMin: -9, zMax: 4, spread: 28 },
      { count: isMobile ? 520 : 1250, size: .045, speed: .48, opacity: .48, zMin: -28, zMax: -8, spread: 38 },
    ]

    settings.forEach((setting, layerIndex) => {
      const positions = new Float32Array(setting.count * 3)
      const speeds = new Float32Array(setting.count)
      const phase = new Float32Array(setting.count)
      for (let index = 0; index < setting.count; index += 1) {
        const offset = index * 3
        positions[offset] = (Math.random() - .5) * setting.spread
        positions[offset + 1] = Math.random() * 22 - 6
        positions[offset + 2] = THREE.MathUtils.lerp(setting.zMin, setting.zMax, Math.random())
        speeds[index] = setting.speed * (.62 + Math.random() * .78)
        phase[index] = Math.random() * Math.PI * 2
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.PointsMaterial({
        color: layerIndex === 2 ? 0x9bdcff : 0xffffff,
        map: this.texture,
        size: setting.size,
        opacity: setting.opacity,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      })
      const points = new THREE.Points(geometry, material)
      points.frustumCulled = false
      this.layers.push({ points, positions, speeds, phase, spread: setting.spread, minY: -6, maxY: 16 })
      this.group.add(points)
    })
  }

  update(delta: number, elapsed: number) {
    this.layers.forEach((layer, layerIndex) => {
      for (let index = 0; index < layer.speeds.length; index += 1) {
        const offset = index * 3
        layer.positions[offset + 1] -= layer.speeds[index] * delta
        layer.positions[offset] += Math.sin(elapsed * (.3 + layerIndex * .12) + layer.phase[index]) * delta * (.18 + layerIndex * .04)
        if (layer.positions[offset + 1] < layer.minY) {
          layer.positions[offset + 1] = layer.maxY + Math.random() * 3
          layer.positions[offset] = (Math.random() - .5) * layer.spread
        }
      }
      layer.points.geometry.attributes.position.needsUpdate = true
    })
  }

  dispose() {
    this.layers.forEach(layer => {
      layer.points.geometry.dispose()
      layer.points.material.dispose()
    })
    this.texture.dispose()
  }
}
