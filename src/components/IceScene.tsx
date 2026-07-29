import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { ImprovedNoise } from 'three/examples/jsm/math/ImprovedNoise.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { SnowParticles } from './SnowParticles'

type DataStream = { curve: THREE.CatmullRomCurve3; node: THREE.Mesh; speed: number; offset: number }
type FogSprite = { sprite: THREE.Sprite; baseX: number; baseZ: number; phase: number }
type SnowMaps = { diffuse: THREE.Texture; normal: THREE.Texture; roughness: THREE.Texture }

function createFogTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(128, 64, 4, 128, 64, 126)
  gradient.addColorStop(0, 'rgba(215,247,255,.42)')
  gradient.addColorStop(.42, 'rgba(125,205,226,.18)')
  gradient.addColorStop(1, 'rgba(70,150,180,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 128)
  return new THREE.CanvasTexture(canvas)
}

function loadSnowMaps(renderer: THREE.WebGLRenderer): SnowMaps {
  const loader = new THREE.TextureLoader()
  const diffuse = loader.load('/assets/background/snow/snow_02_diff_1k.jpg')
  const normal = loader.load('/assets/background/snow/snow_02_nor_gl_1k.jpg')
  const roughness = loader.load('/assets/background/snow/snow_02_rough_1k.jpg')
  diffuse.colorSpace = THREE.SRGBColorSpace
  ;[diffuse, normal, roughness].forEach(texture => {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(7, 7)
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  })
  return { diffuse, normal, roughness }
}

function createMountainGeometry(width: number, depth: number, height: number, seed: number) {
  const geometry = new THREE.PlaneGeometry(width, depth, 96, 64)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const noise = new ImprovedNoise()
  const normalizedHeights = new Float32Array(position.count)
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const z = position.getY(index)
    const normalizedX = x / width
    const normalizedZ = z / depth
    const broad = noise.noise(x * .018 + seed, z * .022, seed * .7) * .5 + .5
    const depthFalloff = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(normalizedZ) * 2, 3)), .42)
    const widthFalloff = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(normalizedX) * 2, 6)), .34)
    let ridgedTerrain = 0
    let normalization = 0
    let amplitude = .56
    let frequency = .024
    for (let octave = 0; octave < 5; octave += 1) {
      const sample = noise.noise(x * frequency + seed * (1.4 + octave), z * frequency, seed * (2.1 + octave * .7))
      const ridge = Math.pow(1 - Math.abs(sample), 2)
      ridgedTerrain += ridge * amplitude
      normalization += amplitude
      amplitude *= .48
      frequency *= 2.03
    }
    ridgedTerrain /= normalization
    const mountainMass = THREE.MathUtils.smoothstep(ridgedTerrain, .28, .88)
    const erosion = .82 + (1 - Math.abs(noise.noise(x * .085, z * .078, seed * 4.2))) * .22
    const elevation = Math.max(0, Math.pow(mountainMass, 1.52) * (.78 + broad * .28) * erosion * depthFalloff * widthFalloff)
    const y = elevation * height
    position.setZ(index, y)
    normalizedHeights[index] = THREE.MathUtils.clamp(y / height, 0, 1)
  }
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  const normal = geometry.attributes.normal as THREE.BufferAttribute
  const rotatedPosition = geometry.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(position.count * 3)
  const rock = new THREE.Color()
  const snow = new THREE.Color(0xd9e8ec)
  for (let index = 0; index < rotatedPosition.count; index += 1) {
    const normalizedHeight = normalizedHeights[index]
    const slopeSnow = THREE.MathUtils.smoothstep(normal.getY(index), .38, .78)
    const snowCover = THREE.MathUtils.clamp(slopeSnow + normalizedHeight * .28 - .08, 0, 1)
    rock.set(normalizedHeight > .62 ? 0x78939e : 0x405d69)
    rock.lerp(snow, snowCover)
    colors[index * 3] = rock.r
    colors[index * 3 + 1] = rock.g
    colors[index * 3 + 2] = rock.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

function addMountainRange(scene: THREE.Scene, maps: SnowMaps, x: number, z: number, width: number, depth: number, height: number, seed: number, rotation = 0) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: .93,
    metalness: 0,
    envMapIntensity: .7,
    map: maps.diffuse,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(.72, .72),
    roughnessMap: maps.roughness,
  })
  const mountain = new THREE.Mesh(createMountainGeometry(width, depth, height, seed), material)
  mountain.position.set(x, -1.18, z)
  mountain.rotation.y = rotation
  mountain.castShadow = true
  mountain.receiveShadow = true
  scene.add(mountain)
  return mountain
}

function createSnowfieldGeometry(width: number, depth: number, seed: number) {
  const geometry = new THREE.PlaneGeometry(width, depth, 100, 100)
  const position = geometry.attributes.position as THREE.BufferAttribute
  const noise = new ImprovedNoise()
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index)
    const z = position.getY(index)
    const broad = noise.noise(x * .045 + seed, z * .042, seed) * .18
    const drift = noise.noise(x * .12, z * .1, seed * 2.3) * .055
    const elevation = broad + drift + .08
    position.setZ(index, elevation)
    color.set(elevation > .14 ? 0xd8e7eb : elevation > 0 ? 0xb9cdd3 : 0x91aab3)
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.rotateX(-Math.PI / 2)
  geometry.computeVertexNormals()
  return geometry
}

function createDataStreams(scene: THREE.Scene) {
  const streams: DataStream[] = []
  const endpoints = [
    new THREE.Vector3(-12, .25, -7), new THREE.Vector3(12, .3, -8),
    new THREE.Vector3(-10, .18, 3), new THREE.Vector3(10, .22, 2),
    new THREE.Vector3(-7, 4.3, -15), new THREE.Vector3(8, 3.6, -17),
  ]
  endpoints.forEach((endpoint, index) => {
    const start = new THREE.Vector3(0, 5.2, -26)
    const curve = new THREE.CatmullRomCurve3([
      start,
      new THREE.Vector3(endpoint.x * .28, .35 + index % 2 * 1.3, -6 - index * 1.2),
      new THREE.Vector3(endpoint.x * .65, .65 + (index % 3) * .4, endpoint.z * .55),
      endpoint,
    ])
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80))
    const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: index % 2 ? 0x34e9ff : 0x7fffd6, transparent: true, opacity: .18 }))
    scene.add(line)
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, .018, 5, false),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0x53e5ff : 0x70ffd0, transparent: true, opacity: .26, blending: THREE.AdditiveBlending }),
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
    renderer.setSize(container.clientWidth, container.clientHeight, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = .62
    renderer.shadowMap.enabled = !isMobile
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.setAttribute('aria-label', '沉浸式未来冰雪数据世界')
    renderer.domElement.setAttribute('role', 'img')
    renderer.domElement.className = 'block h-full w-full'
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x7fa6b6, isMobile ? 25 : 32, isMobile ? 72 : 88)
    const camera = new THREE.PerspectiveCamera(isMobile ? 64 : 54, container.clientWidth / container.clientHeight, .1, 110)
    camera.position.set(0, isMobile ? 3.1 : 2.8, isMobile ? 14.5 : 13)

    const sky = new Sky()
    sky.scale.setScalar(450)
    const skyUniforms = sky.material.uniforms
    skyUniforms.turbidity.value = 3.2
    skyUniforms.rayleigh.value = .55
    skyUniforms.mieCoefficient.value = .0015
    skyUniforms.mieDirectionalG.value = .78
    const sunPosition = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(68), THREE.MathUtils.degToRad(214))
    skyUniforms.sunPosition.value.copy(sunPosition)
    scene.add(sky)

    const snowMaps = loadSnowMaps(renderer)
    const fogTexture = createFogTexture()
    const pmrem = new THREE.PMREMGenerator(renderer)
    pmrem.compileEquirectangularShader()
    const roomEnvironment = new RoomEnvironment()
    const environmentTexture = pmrem.fromScene(roomEnvironment, .04).texture
    scene.environment = environmentTexture

    const ambient = new THREE.HemisphereLight(0xdaf4ff, 0x183447, .72)
    scene.add(ambient)
    const sun = new THREE.DirectionalLight(0xf1fbff, 1.25)
    sun.position.set(-16, 22, 7)
    sun.castShadow = !isMobile
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -24
    sun.shadow.camera.right = 24
    sun.shadow.camera.top = 20
    sun.shadow.camera.bottom = -12
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0x7fdcff, .34)
    rim.position.set(12, 6, -20)
    scene.add(rim)

    const snowfield = new THREE.Mesh(
      createSnowfieldGeometry(70, 70, 4.7),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: .96,
        metalness: 0,
        envMapIntensity: .45,
        map: snowMaps.diffuse,
        normalMap: snowMaps.normal,
        normalScale: new THREE.Vector2(.88, .88),
        roughnessMap: snowMaps.roughness,
      }),
    )
    snowfield.position.y = -1.08
    snowfield.receiveShadow = true
    scene.add(snowfield)

    addMountainRange(scene, snowMaps, 0, -29, 58, 18, 12, 1.15)
    addMountainRange(scene, snowMaps, -17, -17, 32, 15, 8.2, 3.45, .14)
    addMountainRange(scene, snowMaps, 18, -18, 34, 16, 9.4, 6.8, -.16)
    addMountainRange(scene, snowMaps, -8, -23, 28, 12, 7.2, 8.6, .05)

    const core = new THREE.Group()
    const coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(.72, 3),
      new THREE.MeshStandardMaterial({ color: 0xbaffff, emissive: 0x25d9ff, emissiveIntensity: 1.7, roughness: .2, metalness: .15, transparent: true, opacity: .84 }),
    )
    core.add(coreMesh)
    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1.02, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x20d5ff, transparent: true, opacity: .055, blending: THREE.AdditiveBlending, side: THREE.BackSide }),
    )
    core.add(coreGlow)
    const rings: THREE.Mesh[] = []
    ;[1.15, 1.46, 1.78].forEach((radius, index) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, .025 + index * .008, 8, 100),
        new THREE.MeshBasicMaterial({ color: index === 1 ? 0x68ffd0 : 0x5ddfff, transparent: true, opacity: .62, blending: THREE.AdditiveBlending }),
      )
      ring.rotation.set(index === 0 ? Math.PI / 2 : .7 + index * .45, index * .6, index * .8)
      rings.push(ring)
      core.add(ring)
    })
    core.position.set(0, 5.2, -26)
    core.scale.setScalar(.34)
    const coreLight = new THREE.PointLight(0x35dcff, 3.2, 9, 1.8)
    core.add(coreLight)
    scene.add(core)

    const dataStreams = createDataStreams(scene)
    const snow = new SnowParticles(isMobile)
    scene.add(snow.group)

    const fogSprites: FogSprite[] = []
    const fogMaterial = new THREE.SpriteMaterial({
      map: fogTexture,
      color: 0xb9edfa,
      transparent: true,
      opacity: isMobile ? .022 : .032,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    const fogCount = isMobile ? 5 : 9
    for (let index = 0; index < fogCount; index += 1) {
      const sprite = new THREE.Sprite(fogMaterial.clone())
      const x = THREE.MathUtils.randFloatSpread(28)
      const z = THREE.MathUtils.randFloat(-20, 4)
      sprite.position.set(x, -.62 + Math.random() * .42, z)
      sprite.scale.set(7 + Math.random() * 8, 1.45 + Math.random() * 1.3, 1)
      scene.add(sprite)
      fogSprites.push({ sprite, baseX: x, baseZ: z, phase: index * 1.37 })
    }

    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      isMobile ? .06 : .11,
      isMobile ? .18 : .24,
      1.25,
    )
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

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
      composer.setSize(width, height)
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
      camera.position.y += ((isMobile ? 3.05 : 2.75) + pointer.y * .46 - scrollProgress * .72 - camera.position.y) * .035
      camera.position.z += ((isMobile ? 14.5 : 13) - travel - camera.position.z) * .028
      camera.lookAt(pointer.x * .45, 2.2 - scrollProgress * .35, -10.5 - travel * .7)

      if (!reduceMotion) {
        core.rotation.y += delta * .22
        coreMesh.rotation.x -= delta * .16
        coreMesh.rotation.z += delta * .12
        rings.forEach((ring, index) => { ring.rotation.z += delta * (.18 + index * .09); ring.rotation.y -= delta * (.08 + index * .03) })
        const pulse = 1 + Math.sin(elapsed * 1.8) * .045
        coreGlow.scale.setScalar(pulse)
        coreLight.intensity = 3 + Math.sin(elapsed * 2.1) * .45
        dataStreams.forEach(stream => {
          const progress = (Math.max(0, elapsed) * stream.speed + stream.offset) % .999
          stream.node.position.copy(stream.curve.getPoint(progress))
        })
        snow.update(delta, elapsed)
      }
      fogSprites.forEach((fog, index) => {
        fog.sprite.position.x = fog.baseX + Math.sin(elapsed * (.035 + index * .002) + fog.phase) * 2.1
        fog.sprite.position.z = fog.baseZ + Math.cos(elapsed * .025 + fog.phase) * .8
        const material = fog.sprite.material as THREE.SpriteMaterial
        material.opacity = (isMobile ? .016 : .022) + (Math.sin(elapsed * .18 + fog.phase) + 1) * .007
      })
      composer.render()
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
      composer.dispose()
      environmentTexture.dispose()
      roomEnvironment.dispose()
      pmrem.dispose()
      snowMaps.diffuse.dispose()
      snowMaps.normal.dispose()
      snowMaps.roughness.dispose()
      fogTexture.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden bg-[#061426]">
    {failed && <div className="absolute inset-0 bg-[#071a31]"><div className="absolute left-1/2 top-1/2 size-60 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-cyan-200/20 bg-cyan-100/5"/></div>}
  </div>
}
