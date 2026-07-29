import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SnowParticles } from './SnowParticles'

type FloatingObject = { object: THREE.Object3D; baseY: number; phase: number; amplitude: number; speed: number }
type DataStream = { curve: THREE.CatmullRomCurve3; node: THREE.Mesh; speed: number; offset: number }

const iceMaterial = (color: number, opacity = .72) => new THREE.MeshPhysicalMaterial({
  color,
  emissive: new THREE.Color(color).multiplyScalar(.08),
  metalness: .08,
  roughness: .16,
  transmission: .3,
  thickness: 1.4,
  transparent: true,
  opacity,
  flatShading: true,
  side: THREE.DoubleSide,
})

function addGlacier(scene: THREE.Scene, x: number, z: number, scale: number, mirrored = false) {
  const group = new THREE.Group()
  const material = iceMaterial(0x5ac9ec, .68)
  const paleMaterial = iceMaterial(0xbceeff, .52)
  const peaks = [
    { x: 0, y: 2.2, z: 0, radius: 2.8, height: 7.2, sides: 6 },
    { x: mirrored ? -2.25 : 2.25, y: 1.35, z: .8, radius: 2.1, height: 5.1, sides: 5 },
    { x: mirrored ? 1.9 : -1.9, y: .8, z: 1.1, radius: 1.7, height: 4.1, sides: 5 },
  ]
  peaks.forEach((peak, index) => {
    const geometry = new THREE.ConeGeometry(peak.radius, peak.height, peak.sides, 2)
    const mesh = new THREE.Mesh(geometry, index === 1 ? paleMaterial : material)
    mesh.position.set(peak.x, peak.y, peak.z)
    mesh.rotation.y = index * .7 + (mirrored ? .35 : 0)
    mesh.castShadow = true
    mesh.receiveShadow = true
    group.add(mesh)
  })
  const base = new THREE.Mesh(new THREE.DodecahedronGeometry(3.9, 0), material)
  base.scale.set(1.55, .34, 1.05)
  base.position.y = -.45
  group.add(base)
  group.position.set(x, -.25, z)
  group.scale.setScalar(scale)
  scene.add(group)
  return group
}

function createCrystalCluster(scene: THREE.Scene, x: number, z: number, color: number, scale: number) {
  const group = new THREE.Group()
  const material = iceMaterial(color, .72)
  ;[
    { x: 0, y: .8, scale: 1 },
    { x: -.7, y: .35, scale: .62 },
    { x: .65, y: .3, scale: .52 },
  ].forEach((item, index) => {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.8, 0), material)
    crystal.scale.set(.56 * item.scale, 2.3 * item.scale, .56 * item.scale)
    crystal.position.set(item.x, item.y, index * .15)
    crystal.rotation.z = (index - 1) * .24
    group.add(crystal)
  })
  group.position.set(x, .1, z)
  group.scale.setScalar(scale)
  scene.add(group)
  return group
}

function createDataStreams(scene: THREE.Scene) {
  const streams: DataStream[] = []
  const endpoints = [
    new THREE.Vector3(-12, .25, -7), new THREE.Vector3(12, .3, -8),
    new THREE.Vector3(-10, .18, 3), new THREE.Vector3(10, .22, 2),
    new THREE.Vector3(-7, 4.3, -15), new THREE.Vector3(8, 3.6, -17),
  ]
  endpoints.forEach((endpoint, index) => {
    const start = new THREE.Vector3(0, 1.7, -7)
    const curve = new THREE.CatmullRomCurve3([
      start,
      new THREE.Vector3(endpoint.x * .28, .35 + index % 2 * 1.3, -6 - index * 1.2),
      new THREE.Vector3(endpoint.x * .65, .65 + (index % 3) * .4, endpoint.z * .55),
      endpoint,
    ])
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80))
    const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: index % 2 ? 0x34e9ff : 0x7fffd6, transparent: true, opacity: .36 }))
    scene.add(line)
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, .018, 5, false),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0x53e5ff : 0x70ffd0, transparent: true, opacity: .5, blending: THREE.AdditiveBlending }),
    )
    scene.add(tube)
    const node = new THREE.Mesh(
      new THREE.SphereGeometry(.09, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xd9ffff, blending: THREE.AdditiveBlending }),
    )
    node.add(new THREE.PointLight(index % 2 ? 0x38dfff : 0x4effc4, 1.1, 2.6))
    scene.add(node)
    streams.push({ curve, node, speed: .055 + index * .004, offset: index / endpoints.length })
  })
  return streams
}

export function IceScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const isMobile = window.matchMedia('(max-width: 700px)').matches
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false, powerPreference: 'high-performance' })
    } catch {
      setFailed(true)
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.35 : 1.8))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    renderer.shadowMap.enabled = !isMobile
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.setAttribute('aria-label', '沉浸式未来冰雪数据世界')
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.className = 'block h-full w-full'
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x061426)
    scene.fog = new THREE.FogExp2(0x071a31, isMobile ? .024 : .019)
    const camera = new THREE.PerspectiveCamera(isMobile ? 64 : 54, container.clientWidth / container.clientHeight, .1, 110)
    camera.position.set(0, 3.6, isMobile ? 14.5 : 13)

    const ambient = new THREE.HemisphereLight(0xbcefff, 0x06213d, 2.3)
    scene.add(ambient)
    const moon = new THREE.DirectionalLight(0xdff8ff, 3.2)
    moon.position.set(-8, 12, 5)
    moon.castShadow = !isMobile
    moon.shadow.mapSize.set(1024, 1024)
    scene.add(moon)
    const rim = new THREE.DirectionalLight(0x36bfff, 1.8)
    rim.position.set(10, 4, -12)
    scene.add(rim)

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(70, 70, 1, 1),
      new THREE.MeshPhysicalMaterial({ color: 0x1a6c8f, metalness: .35, roughness: .18, transparent: true, opacity: .72, clearcoat: 1, clearcoatRoughness: .08 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -1.05
    floor.receiveShadow = true
    scene.add(floor)
    const grid = new THREE.GridHelper(56, 56, 0x3af2ff, 0x1b6786)
    grid.position.y = -1.01
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]
    gridMaterials.forEach(material => { material.transparent = true; material.opacity = .16 })
    scene.add(grid)

    addGlacier(scene, -10.2, -10, 1.35)
    addGlacier(scene, 10.4, -12.5, 1.55, true)
    addGlacier(scene, -14, 1.5, .9, true)
    addGlacier(scene, 14, 2.5, .86)

    const floaters: FloatingObject[] = []
    ;[
      { x: -5.6, y: 2.2, z: -5, scale: 1.15, color: 0x7edcff },
      { x: 6.4, y: 2.8, z: -3.2, scale: .86, color: 0x4dffd1 },
      { x: -3.4, y: 4.7, z: -14, scale: .7, color: 0xb2efff },
      { x: 4.1, y: 5.1, z: -16, scale: .78, color: 0x70bfff },
    ].forEach((item, index) => {
      const block = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), iceMaterial(item.color, .62))
      block.position.set(item.x, item.y, item.z)
      block.scale.set(item.scale * 1.35, item.scale * .62, item.scale)
      block.rotation.set(index * .2, index * .7, index * .12)
      block.castShadow = true
      scene.add(block)
      floaters.push({ object: block, baseY: item.y, phase: index * 1.7, amplitude: .18 + index * .035, speed: .35 + index * .05 })
    })

    const crystals = [
      createCrystalCluster(scene, -5.8, -1.7, 0x74dfff, 1),
      createCrystalCluster(scene, 6.3, -2.2, 0x71ffd2, .82),
      createCrystalCluster(scene, -8.2, -10.5, 0xa7edff, 1.2),
      createCrystalCluster(scene, 8.5, -12.3, 0x4fc9ff, 1.1),
    ]

    const core = new THREE.Group()
    const coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.05, 2),
      new THREE.MeshStandardMaterial({ color: 0xbaffff, emissive: 0x25d9ff, emissiveIntensity: 3.4, roughness: .18, metalness: .2, transparent: true, opacity: .92 }),
    )
    core.add(coreMesh)
    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.45, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x20d5ff, transparent: true, opacity: .09, blending: THREE.AdditiveBlending, side: THREE.BackSide }),
    )
    core.add(coreGlow)
    const rings: THREE.Mesh[] = []
    ;[1.75, 2.18, 2.62].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, .025 + index * .008, 8, 100),
        new THREE.MeshBasicMaterial({ color: index === 1 ? 0x68ffd0 : 0x5ddfff, transparent: true, opacity: .62, blending: THREE.AdditiveBlending }),
      )
      ring.rotation.set(index === 0 ? Math.PI / 2 : .7 + index * .45, index * .6, index * .8)
      rings.push(ring)
      core.add(ring)
    })
    core.position.set(0, 1.65, -7)
    const coreLight = new THREE.PointLight(0x35dcff, 7.5, 14, 1.8)
    core.add(coreLight)
    scene.add(core)

    const coreReflection = core.clone(true)
    coreReflection.position.y = -3.65
    coreReflection.scale.y = -.65
    coreReflection.traverse(child => {
      if (child instanceof THREE.Mesh) {
        const materials = (Array.isArray(child.material) ? child.material : [child.material]).map(material => material.clone())
        child.material = Array.isArray(child.material) ? materials : materials[0]
        materials.forEach(material => {
          const reflectedMaterial = material as THREE.Material & { opacity?: number; transparent?: boolean }
          reflectedMaterial.transparent = true
          reflectedMaterial.opacity = Math.min(reflectedMaterial.opacity ?? 1, .11)
        })
      }
      if (child instanceof THREE.Light) child.intensity = 0
    })
    scene.add(coreReflection)

    const dataStreams = createDataStreams(scene)
    const snow = new SnowParticles(isMobile)
    scene.add(snow.group)

    const pointer = new THREE.Vector2()
    const targetPointer = new THREE.Vector2()
    let scrollProgress = 0
    let animationFrame = 0
    let contextLost = false
    let startTime = performance.now()
    let previousTime = startTime

    const onPointerMove = (event: PointerEvent) => {
      targetPointer.x = event.clientX / window.innerWidth * 2 - 1
      targetPointer.y = -(event.clientY / window.innerHeight * 2 - 1)
    }
    const onScroll = () => {
      const distance = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      scrollProgress = Math.min(1, window.scrollY / distance)
    }
    const resize = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.fov = width < 700 ? 64 : 54
      camera.updateProjectionMatrix()
    }
    const onContextLost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      setFailed(true)
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    renderer.domElement.addEventListener('webglcontextlost', onContextLost)
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    onScroll()

    const render = (now: number) => {
      if (contextLost) return
      const delta = Math.min((now - previousTime) / 1000, .05)
      const elapsed = (now - startTime) / 1000
      previousTime = now
      pointer.lerp(targetPointer, reduceMotion ? .025 : .055)
      const travel = scrollProgress * (isMobile ? 6.5 : 8.5)
      camera.position.x += (pointer.x * (isMobile ? .65 : 1.55) - camera.position.x) * .035
      camera.position.y += ((isMobile ? 3.4 : 3.7) + pointer.y * .62 - scrollProgress * 1.15 - camera.position.y) * .035
      camera.position.z += ((isMobile ? 14.5 : 13) - travel - camera.position.z) * .028
      camera.lookAt(pointer.x * .45, .85 - scrollProgress * .45, -7 - travel * .7)

      if (!reduceMotion) {
        floaters.forEach((floater, index) => {
          floater.object.position.y = floater.baseY + Math.sin(elapsed * floater.speed + floater.phase) * floater.amplitude
          floater.object.rotation.y += delta * (.08 + index * .018)
          floater.object.rotation.z += delta * .025
        })
        crystals.forEach((crystal, index) => { crystal.rotation.y = Math.sin(elapsed * .16 + index) * .12 })
        core.rotation.y += delta * .22
        coreMesh.rotation.x -= delta * .16
        coreMesh.rotation.z += delta * .12
        rings.forEach((ring, index) => { ring.rotation.z += delta * (.18 + index * .09); ring.rotation.y -= delta * (.08 + index * .03) })
        const pulse = 1 + Math.sin(elapsed * 1.8) * .045
        coreGlow.scale.setScalar(pulse)
        coreLight.intensity = 7.2 + Math.sin(elapsed * 2.1) * 1.2
        dataStreams.forEach(stream => {
          const progress = (Math.max(0, elapsed) * stream.speed + stream.offset) % .999
          stream.node.position.copy(stream.curve.getPoint(progress))
        })
        snow.update(delta, elapsed)
      }
      grid.position.z = (scrollProgress * 4) % 1
      renderer.render(scene, camera)
      animationFrame = requestAnimationFrame(render)
    }
    animationFrame = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost)
      snow.dispose()
      scene.traverse(child => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points)) return
        child.geometry?.dispose()
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach(material => material.dispose())
      })
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden bg-[#061426]">
    {failed && <div className="absolute inset-0 bg-[#071a31]"><div className="absolute left-1/2 top-1/2 size-60 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-cyan-200/20 bg-cyan-100/5"/></div>}
  </div>
}
