import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { AquariumCreature, AquariumManifest } from './aquarium-types'

type Props = {
  creatures: AquariumCreature[]
  manifest: AquariumManifest
  selectedId: string | null
  feedPulse: { id: string; nonce: number } | null
  onSelect: (id: string) => void
}

type Rig = {
  id: string
  root: THREE.Group
  visual: THREE.Object3D
  tail: THREE.Object3D | null
  fins: THREE.Object3D[]
  mixer: THREE.AnimationMixer | null
  base: THREE.Vector3
  phase: number
  speed: number
  range: number
  bottom: boolean
  size: number
}

const physical = (color: THREE.ColorRepresentation, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: .38, metalness: .03, clearcoat: .55, clearcoatRoughness: .22, ...options })

function addMesh(geometry: THREE.BufferGeometry, surface: THREE.Material, parent: THREE.Object3D) {
  const value = new THREE.Mesh(geometry, surface)
  value.castShadow = true
  value.receiveShadow = true
  parent.add(value)
  return value
}

function shapeGeometry(points: Array<[number, number]>, depth = .08) {
  const shape = new THREE.Shape()
  points.forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y))
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 2 })
  geometry.translate(0, 0, -depth / 2)
  return geometry
}

function addTube(points: THREE.Vector3[], radius: number, surface: THREE.Material, parent: THREE.Object3D) {
  return addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 18, radius, 7, false), surface, parent)
}

function addEyes(parent: THREE.Group, x: number, y: number, z: number, radius = .07) {
  const white = physical(0xf4f8f2, { roughness: .12, clearcoat: 1 })
  const black = physical(0x02080b, { roughness: .08, clearcoat: 1 })
  for (const side of [-1, 1]) {
    const eye = addMesh(new THREE.SphereGeometry(radius, 14, 10), white, parent)
    eye.position.set(x, y, side * z)
    const pupil = addMesh(new THREE.SphereGeometry(radius * .5, 12, 8), black, parent)
    pupil.position.set(x + radius * .8, y, side * (z + radius * .28))
  }
}

function standardFish(species: string) {
  const root = new THREE.Group()
  const colors: Record<string, [number, number]> = {
    clownfish: [0xef6f26, 0xf8eee0], blueTang: [0x1a55ad, 0xf1c93c], angelfish: [0x789ac4, 0x18243b],
    butterflyfish: [0xe9bd3f, 0x252c34], pufferfish: [0xb2a170, 0x554a32], reefShark: [0x718592, 0x26343d], dolphin: [0x5f8196, 0xc7d8df],
  }
  const [bodyColor, accentColor] = colors[species] || [0x4f91a7, 0xe9d179]
  const bodySurface = physical(bodyColor, { roughness: species === 'dolphin' ? .22 : .34, clearcoat: .78 })
  const accent = physical(accentColor, { clearcoat: .65 })
  const dark = physical(0x172128, { roughness: .5 })
  const longBody = species === 'reefShark' || species === 'dolphin'
  const puffer = species === 'pufferfish'
  const body = addMesh(new THREE.SphereGeometry(1, 32, 20), bodySurface, root)
  body.scale.set(longBody ? 1.5 : puffer ? .87 : 1.15, puffer ? .77 : .52, puffer ? .72 : .42)
  const tail = addMesh(shapeGeometry([[-1, 0], [-1.72, .55], [-1.58, 0], [-1.72, -.55]], .1), species === 'blueTang' ? accent : bodySurface, root)
  tail.position.x = -.15
  const dorsal = addMesh(shapeGeometry([[-.28, .34], [.08, .98], [.38, .31]], .07), species === 'reefShark' ? dark : bodySurface, root)
  const lower = addMesh(shapeGeometry([[-.18, -.28], [.16, -.7], [.42, -.27]], .06), bodySurface, root)
  const sideFin = addMesh(shapeGeometry([[-.08, .04], [-.48, -.42], [.5, -.08]], .06), bodySurface, root)
  sideFin.rotation.x = -.65
  sideFin.position.z = .35
  if (species === 'clownfish') for (const x of [-.52, .05, .58]) {
    const band = addMesh(new THREE.TorusGeometry(.42, .072, 10, 28), accent, root)
    band.position.x = x; band.rotation.y = Math.PI / 2; band.scale.y = 1.2
  }
  if (species === 'blueTang') {
    const mark = addMesh(shapeGeometry([[-.65, .18], [.14, .46], [.72, .08], [.05, -.18]], .025), dark, root)
    mark.position.z = .43
  }
  if (species === 'angelfish') { body.scale.set(.78, .92, .34); dorsal.scale.set(1.15, 1.45, 1); lower.scale.set(1.1, 1.45, 1) }
  if (species === 'butterflyfish') { const spot = addMesh(new THREE.CircleGeometry(.16, 24), dark, root); spot.position.set(-.42, .08, .435) }
  if (puffer) for (let index = 0; index < 22; index++) {
    const angle = index / 22 * Math.PI * 2
    const spike = addMesh(new THREE.ConeGeometry(.04, .2, 7), accent, root)
    spike.position.set(Math.cos(angle) * .75, ((index % 5) - 2) * .24, Math.sin(angle) * .63)
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), spike.position.clone().normalize())
  }
  if (species === 'reefShark') {
    const snout = addMesh(new THREE.ConeGeometry(.34, .78, 20), bodySurface, root)
    snout.rotation.z = -Math.PI / 2; snout.position.x = 1.35; dorsal.scale.set(1.35, 1.45, 1)
  }
  if (species === 'dolphin') {
    const snout = addMesh(new THREE.CylinderGeometry(.12, .2, .72, 18), accent, root)
    snout.rotation.z = -Math.PI / 2; snout.position.set(1.52, -.08, 0)
  }
  addEyes(root, longBody ? 1.05 : .72, .14, longBody ? .35 : .36, longBody ? .055 : .075)
  return { root, tail, fins: [sideFin] }
}

function jellyfish() {
  const root = new THREE.Group()
  const skin = physical(0xa9e7ed, { transparent: true, opacity: .56, transmission: .3, roughness: .06, clearcoat: 1, side: THREE.DoubleSide })
  const glow = physical(0xd7f8ff, { emissive: 0x4dc7d9, emissiveIntensity: .42, transparent: true, opacity: .7 })
  const dome = addMesh(new THREE.SphereGeometry(.68, 32, 18, 0, Math.PI * 2, 0, Math.PI / 2), skin, root); dome.scale.y = .72
  const rim = addMesh(new THREE.TorusGeometry(.64, .05, 10, 40), glow, root); rim.rotation.x = Math.PI / 2
  for (let index = 0; index < 9; index++) {
    const angle = index / 9 * Math.PI * 2
    addTube([new THREE.Vector3(Math.cos(angle) * .42, 0, Math.sin(angle) * .42), new THREE.Vector3(Math.cos(angle) * .3, -.65, Math.sin(angle) * .3), new THREE.Vector3(Math.cos(angle + .5) * .18, -1.25 - index % 3 * .12, Math.sin(angle + .5) * .18)], .018, glow, root)
  }
  return { root, tail: null, fins: [dome, rim] }
}

function turtle() {
  const root = new THREE.Group(), shell = physical(0x526b3e, { roughness: .55 }), skin = physical(0x71936b, { roughness: .5 }), pattern = physical(0x283d2f, { roughness: .7 })
  const body = addMesh(new THREE.SphereGeometry(1, 32, 20), shell, root); body.scale.set(1.08, .32, .72)
  const top = addMesh(new THREE.SphereGeometry(.83, 24, 14), pattern, root); top.scale.set(1, .37, .68); top.position.y = .12
  const head = addMesh(new THREE.SphereGeometry(.28, 20, 14), skin, root); head.position.x = 1.18; head.scale.set(1.2, .8, .8)
  addEyes(root, 1.37, .08, .18, .045)
  const fins: THREE.Object3D[] = []
  for (const [x, z, rotation] of [[.42, .67, -.45], [.42, -.67, .45], [-.55, .62, .55], [-.55, -.62, -.55]] as const) {
    const fin = addMesh(new THREE.SphereGeometry(.38, 18, 10), skin, root); fin.scale.set(1.05, .13, .45); fin.position.set(x, -.05, z); fin.rotation.y = rotation; fins.push(fin)
  }
  return { root, tail: null, fins }
}

function ray() {
  const root = new THREE.Group(), top = physical(0x36535b, { roughness: .44 }), underside = physical(0x9eb7b2, { roughness: .52 })
  const wing = addMesh(shapeGeometry([[-1.2, 0], [-.05, .92], [1.08, 0], [-.05, -.92]], .12), top, root)
  const belly = addMesh(new THREE.SphereGeometry(.55, 22, 12), underside, root); belly.scale.set(1.35, .28, .48); belly.position.z = -.08
  const tail = addTube([new THREE.Vector3(-1.15, 0, 0), new THREE.Vector3(-2, -.05, 0), new THREE.Vector3(-2.8, .08, 0)], .035, top, root)
  addEyes(root, .62, .18, .12, .045)
  return { root, tail, fins: [wing] }
}

function starfish() {
  const root = new THREE.Group(), star = new THREE.Shape()
  for (let index = 0; index < 10; index++) { const angle = Math.PI / 2 + index * Math.PI / 5, radius = index % 2 ? .34 : .88, x = Math.cos(angle) * radius, y = Math.sin(angle) * radius; index ? star.lineTo(x, y) : star.moveTo(x, y) }
  star.closePath(); addMesh(new THREE.ExtrudeGeometry(star, { depth: .16, bevelEnabled: true, bevelSize: .09, bevelThickness: .08, bevelSegments: 3 }), physical(0xc86a45, { roughness: .72, clearcoat: .18 }), root).position.z = -.08
  return { root, tail: null, fins: [] }
}

function octopus() {
  const root = new THREE.Group(), skin = physical(0x8e465f, { roughness: .42, clearcoat: .62 }), fins: THREE.Object3D[] = []
  const head = addMesh(new THREE.SphereGeometry(.62, 28, 20), skin, root); head.scale.set(.82, 1.12, .86); head.position.y = .42; addEyes(root, .45, .52, .35, .075)
  for (let index = 0; index < 8; index++) { const angle = index / 8 * Math.PI * 2; fins.push(addTube([new THREE.Vector3(Math.cos(angle) * .34, 0, Math.sin(angle) * .34), new THREE.Vector3(Math.cos(angle) * .65, -.55, Math.sin(angle) * .65), new THREE.Vector3(Math.cos(angle + .75) * .82, -1.12, Math.sin(angle + .75) * .82)], .07, skin, root)) }
  return { root, tail: null, fins }
}

function crustacean(species: 'crab' | 'lobster') {
  const root = new THREE.Group(), shell = physical(species === 'crab' ? 0x337b91 : 0xb34f2c, { roughness: .5, clearcoat: .65 }), fins: THREE.Object3D[] = []
  const body = addMesh(new THREE.SphereGeometry(.62, 24, 14), shell, root); body.scale.set(species === 'crab' ? 1.15 : 1.5, .42, species === 'crab' ? .72 : .5)
  for (const side of [-1, 1]) for (let index = 0; index < 4; index++) fins.push(addTube([new THREE.Vector3(-.35 + index * .2, -.1, side * (.32 + index * .12)), new THREE.Vector3(-.42 + index * .2, -.42, side * (.72 + index * .08))], .035, shell, root))
  const claw = addMesh(new THREE.SphereGeometry(.25, 16, 10), shell, root); claw.scale.set(1.2, .5, .8); claw.position.set(.74, .05, .55); const other = claw.clone(); other.position.z = -.55; root.add(other)
  if (species === 'lobster') for (const side of [-1, 1]) addTube([new THREE.Vector3(.72, .15, side * .2), new THREE.Vector3(1.4, .5, side * .55), new THREE.Vector3(2.1, .32, side * .78)], .018, shell, root)
  addEyes(root, .55, .22, .28, .05)
  return { root, tail: null, fins }
}

function seahorse() {
  const root = new THREE.Group(), skin = physical(0xd6a13e, { roughness: .52 }), fins: THREE.Object3D[] = []
  for (let index = 0; index < 7; index++) { const part = addMesh(new THREE.SphereGeometry(.26 - index * .018, 16, 12), skin, root); part.position.set(-Math.sin(index * .45) * .18, .65 - index * .25, 0); fins.push(part) }
  const head = addMesh(new THREE.SphereGeometry(.34, 20, 14), skin, root); head.position.set(.12, .9, 0); head.scale.set(.9, 1.1, .78)
  const snout = addMesh(new THREE.CylinderGeometry(.055, .1, .55, 12), skin, root); snout.rotation.z = -Math.PI / 2; snout.position.set(.48, .92, 0)
  addTube([new THREE.Vector3(-.1, -.85, 0), new THREE.Vector3(-.5, -1.05, 0), new THREE.Vector3(-.42, -1.42, 0), new THREE.Vector3(-.1, -1.45, 0)], .055, skin, root); addEyes(root, .34, 1.02, .2, .05)
  return { root, tail: null, fins }
}

function modelFor(species: string) {
  if (species === 'jellyfish') return jellyfish()
  if (species === 'greenTurtle') return turtle()
  if (species === 'starfish') return starfish()
  if (species === 'mantaRay') return ray()
  if (species === 'octopus') return octopus()
  if (species === 'crab' || species === 'lobster') return crustacean(species)
  if (species === 'seahorse') return seahorse()
  return standardFish(species)
}

function sandTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256
  const context = canvas.getContext('2d')!; context.fillStyle = '#9d8965'; context.fillRect(0, 0, 256, 256)
  for (let index = 0; index < 4200; index++) { const tone = 105 + Math.floor(Math.random() * 85); context.fillStyle = `rgba(${tone + 22},${tone + 10},${tone - 18},${.15 + Math.random() * .28})`; const size = Math.random() * 2.2; context.fillRect(Math.random() * 256, Math.random() * 256, size, size) }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(8, 5); texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function environment(scene: THREE.Scene) {
  const plants: THREE.Object3D[] = []
  const water = new THREE.ShaderMaterial({ uniforms: { time: { value: 0 }, deep: { value: new THREE.Color(0x032a3f) }, light: { value: new THREE.Color(0x0b7793) } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: 'uniform float time;uniform vec3 deep;uniform vec3 light;varying vec2 vUv;void main(){float rays=pow(max(0.,sin(vUv.x*19.+time*.34)*sin(vUv.y*12.-time*.21)),8.);float haze=smoothstep(0.,1.,vUv.y);vec3 color=mix(deep,light,haze*.85)+rays*vec3(.05,.22,.25);gl_FragColor=vec4(color,1.);}' })
  const backdrop = addMesh(new THREE.PlaneGeometry(24, 14), water, scene); backdrop.position.z = -5.2
  const floor = addMesh(new THREE.PlaneGeometry(20, 12), new THREE.MeshStandardMaterial({ map: sandTexture(), color: 0xb7a47d, roughness: .92 }), scene); floor.rotation.x = -Math.PI / 2; floor.position.set(0, -3.15, -.2)
  const rockSurface = physical(0x4b5d52, { roughness: .92, clearcoat: .05 })
  for (let index = 0; index < 14; index++) { const rock = addMesh(new THREE.DodecahedronGeometry(.45 + Math.random() * .55, 1), rockSurface, scene); rock.position.set(-6 + Math.random() * 12, -2.82, -3.1 + Math.random() * 4.8); rock.scale.set(1 + Math.random() * .8, .45 + Math.random() * .6, .7 + Math.random() * .6); rock.rotation.set(Math.random(), Math.random(), Math.random()) }
  const plantColors = [0x1d7a5b, 0x39854e, 0x267071, 0x7c6e39]
  for (let index = 0; index < 25; index++) { const group = new THREE.Group(); group.position.set(-5.8 + Math.random() * 11.6, -3.03, -3.4 + Math.random() * 4.5); scene.add(group); const height = .7 + Math.random() * 1.8; for (let leaf = 0; leaf < 2 + index % 3; leaf++) addTube([new THREE.Vector3(), new THREE.Vector3((leaf - 1) * .12, height * .48, .04), new THREE.Vector3(Math.sin(index + leaf) * .28, height, 0)], .025 + Math.random() * .025, physical(plantColors[index % plantColors.length], { roughness: .76 }), group); plants.push(group) }
  const coralColors = [0xc86e55, 0xd79b58, 0x9d657d, 0x5c9b91]
  for (let index = 0; index < 9; index++) { const group = new THREE.Group(); group.position.set(-5 + index * 1.25, -2.95, -3 + index % 3 * .55); scene.add(group); const surface = physical(coralColors[index % coralColors.length], { roughness: .66 }); for (let branch = 0; branch < 4; branch++) { const stem = addMesh(new THREE.CylinderGeometry(.07, .12, .55 + branch * .12, 10), surface, group); stem.position.set((branch - 1.5) * .16, (.55 + branch * .12) / 2, 0); stem.rotation.z = (branch - 1.5) * .16; const tip = addMesh(new THREE.SphereGeometry(.13, 12, 8), surface, group); tip.position.set((branch - 1.5) * .23, .58 + branch * .1, 0) } }
  const positions = new Float32Array(130 * 3)
  for (let index = 0; index < 130; index++) { positions[index * 3] = -6 + Math.random() * 12; positions[index * 3 + 1] = -3 + Math.random() * 7; positions[index * 3 + 2] = -3 + Math.random() * 5 }
  const bubbleGeometry = new THREE.BufferGeometry(); bubbleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const bubbles = new THREE.Points(bubbleGeometry, new THREE.PointsMaterial({ color: 0xc8f5ff, size: .045, transparent: true, opacity: .62, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(bubbles)
  const shafts = new THREE.MeshBasicMaterial({ color: 0x73d8e7, transparent: true, opacity: .045, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
  for (let index = 0; index < 5; index++) { const shaft = addMesh(new THREE.ConeGeometry(.85, 8, 18, 1, true), shafts, scene); shaft.position.set(-4 + index * 2.1, 1.5, -2.8); shaft.rotation.z = .18 + (index - 2) * .04 }
  return { water, plants, bubbles, basePositions: positions.slice() }
}

function disposeObject(root: THREE.Object3D) {
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.geometry?.dispose()
    ;(Array.isArray(object.material) ? object.material : [object.material]).forEach(surface => surface?.dispose())
  })
}

function prepareRealModel(source: THREE.Object3D, targetSize: number) {
  const model = cloneSkeleton(source)
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.castShadow = true
    object.receiveShadow = true
    const surfaces = Array.isArray(object.material) ? object.material : [object.material]
    surfaces.forEach(surface => {
      if ('roughness' in surface) (surface as THREE.MeshStandardMaterial).roughness = Math.max(.28, (surface as THREE.MeshStandardMaterial).roughness ?? .45)
      if ('envMapIntensity' in surface) (surface as THREE.MeshStandardMaterial).envMapIntensity = .7
    })
  })
  let box = new THREE.Box3().setFromObject(model), size = new THREE.Vector3()
  box.getSize(size)
  if (size.z > size.x * 1.25) model.rotation.y = Math.PI / 2
  box = new THREE.Box3().setFromObject(model); box.getSize(size)
  const longest = Math.max(size.x, size.y, size.z) || 1
  model.scale.multiplyScalar(targetSize / longest)
  box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())
  model.position.sub(center)
  return model
}

export function AquariumScene3D({ creatures, manifest, selectedId, feedPulse, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null), selectedRef = useRef(selectedId), selectRef = useRef(onSelect), feedRef = useRef<{ id: string; time: number } | null>(null)
  const signature = useMemo(() => creatures.map(creature => `${creature.id}:${creature.speciesKey}`).join('|'), [creatures])
  useEffect(() => { selectedRef.current = selectedId }, [selectedId])
  useEffect(() => { selectRef.current = onSelect }, [onSelect])
  useEffect(() => { if (feedPulse) feedRef.current = { id: feedPulse.id, time: performance.now() } }, [feedPulse])
  useEffect(() => {
    const host = hostRef.current; if (!host) return
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x032a3f); scene.fog = new THREE.FogExp2(0x062e42, .047)
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 60); camera.position.set(0, .6, 11.8)
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.8)); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.className = 'block h-full w-full cursor-grab active:cursor-grabbing'; host.appendChild(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .055; controls.enablePan = false; controls.minDistance = 8.5; controls.maxDistance = 15; controls.minPolarAngle = Math.PI * .35; controls.maxPolarAngle = Math.PI * .66; controls.minAzimuthAngle = -.36; controls.maxAzimuthAngle = .36; controls.target.set(0, -.2, -.4)
    scene.add(new THREE.HemisphereLight(0x8de9f4, 0x173624, 2.05)); const sun = new THREE.DirectionalLight(0xd8fbff, 3.15); sun.position.set(-4, 7, 7); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); scene.add(sun); const fill = new THREE.PointLight(0x4bd2dc, 18, 18, 2); fill.position.set(4, 1, 3); scene.add(fill)
    const world = environment(scene), rigs: Rig[] = [], byId = new Map<string, Rig>()
    const creatureById = new Map(creatures.map(creature => [creature.id, creature]))
    creatures.forEach((creature, index) => {
      const asset = manifest.creatures[creature.speciesKey]; if (!asset) return
      const model = modelFor(creature.speciesKey), container = new THREE.Group(), bottom = asset.zone === 'bottom'
      const size = THREE.MathUtils.clamp(asset.size / 110, .54, 1.16) * (creature.speciesKey === 'starfish' ? .62 : creature.speciesKey === 'jellyfish' ? .72 : .72)
      model.root.scale.setScalar(size); model.root.traverse(child => { child.userData.creatureId = creature.id }); container.userData.creatureId = creature.id; container.add(model.root)
      const base = new THREE.Vector3((creature.x - .5) * 10, bottom ? -2.55 : (.5 - creature.y) * 5.15, -2.15 + index % 6 * .62)
      container.position.copy(base); scene.add(container)
      const rig: Rig = { id: creature.id, root: container, visual: model.root, tail: model.tail, fins: model.fins, mixer: null, base, phase: index * 1.47, speed: .16 + asset.speed / 95, range: bottom ? .12 : .55 + asset.speed / 100, bottom, size }
      rigs.push(rig); byId.set(creature.id, rig)
    })
    let stopped = false
    const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder)
    const modelBase = `${import.meta.env.BASE_URL}assets/aquarium/models/`
    Promise.all([
      loader.loadAsync(`${modelBase}grey-snapper-meshopt.glb`),
      loader.loadAsync(`${modelBase}shark-meshopt.glb`),
      loader.loadAsync(`${modelBase}octopus-meshopt.glb`),
    ]).then(([fishModel, sharkModel, octopusModel]) => {
      if (stopped) return
      rigs.forEach(rig => {
        const species = creatureById.get(rig.id)?.speciesKey
        const source = species === 'reefShark' ? sharkModel : species === 'octopus' ? octopusModel : ['clownfish', 'blueTang', 'angelfish', 'butterflyfish'].includes(species || '') ? fishModel : null
        if (!source) return
        const real = prepareRealModel(source.scene, species === 'reefShark' ? 3.2 : species === 'octopus' ? 2.15 : 1.72)
        real.traverse(child => { child.userData.creatureId = rig.id })
        rig.root.remove(rig.visual); disposeObject(rig.visual); rig.visual = real; rig.root.add(real); rig.tail = null; rig.fins = []
        if (source.animations.length) { rig.mixer = new THREE.AnimationMixer(real); source.animations.forEach(clip => rig.mixer?.clipAction(clip).play()) }
      })
    }).catch(error => console.warn('真实海洋生物模型加载失败，已保留轻量模型。', error))
    const halo = addMesh(new THREE.RingGeometry(.82, .9, 64), new THREE.MeshBasicMaterial({ color: 0xffdf78, transparent: true, opacity: .82, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), scene); halo.visible = false
    const feedGlow = addMesh(new THREE.RingGeometry(.55, .68, 48), new THREE.MeshBasicMaterial({ color: 0x71ffd1, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }), scene); feedGlow.visible = false
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(); let start = { x: 0, y: 0 }
    const down = (event: PointerEvent) => { start = { x: event.clientX, y: event.clientY } }
    const up = (event: PointerEvent) => { if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return; const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); raycaster.setFromCamera(pointer, camera); const hit = raycaster.intersectObjects(rigs.map(rig => rig.root), true)[0]; if (!hit) return; let object: THREE.Object3D | null = hit.object; while (object && !object.userData.creatureId) object = object.parent; if (object?.userData.creatureId) selectRef.current(object.userData.creatureId) }
    renderer.domElement.addEventListener('pointerdown', down); renderer.domElement.addEventListener('pointerup', up)
    const resize = () => { const rect = host.getBoundingClientRect(); renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false); camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height); camera.updateProjectionMatrix() }
    const observer = new ResizeObserver(resize); observer.observe(host); resize(); const startedAt = performance.now(); let previousTime = 0, frame = 0
    const animate = () => { const time = (performance.now() - startedAt) / 1000, delta = Math.min(.05, time - previousTime); previousTime = time; world.water.uniforms.time.value = time
      rigs.forEach(rig => { rig.mixer?.update(delta); const travel = time * rig.speed + rig.phase, direction = Math.cos(travel) >= 0 ? 1 : -1; rig.root.position.x = rig.base.x + Math.sin(travel) * rig.range; rig.root.position.y = rig.base.y + (rig.bottom ? Math.sin(travel * .7) * .025 : Math.sin(travel * 1.33) * (.14 + rig.range * .08)); rig.root.position.z = rig.base.z + Math.cos(travel * .62) * .34; rig.root.rotation.y = direction > 0 ? 0 : Math.PI; rig.root.rotation.z = rig.bottom ? 0 : Math.cos(travel * 1.25) * .035; if (rig.tail) rig.tail.rotation.y = Math.sin(time * 4.8 + rig.phase) * .22; rig.fins.forEach((fin, index) => { fin.rotation.z += Math.sin(time * 2.1 + rig.phase + index) * .0018 }) })
      world.plants.forEach((plant, index) => { plant.rotation.z = Math.sin(time * .72 + index) * .055 }); const attribute = world.bubbles.geometry.getAttribute('position') as THREE.BufferAttribute; for (let index = 0; index < attribute.count; index++) { let y = attribute.getY(index) + .006 + index % 5 * .0012; if (y > 4) y = -3; attribute.setY(index, y); attribute.setX(index, world.basePositions[index * 3] + Math.sin(time * .5 + index) * .035) } attribute.needsUpdate = true
      const selected = selectedRef.current ? byId.get(selectedRef.current) : null; if (selected) { halo.visible = true; halo.position.copy(selected.root.position); halo.quaternion.copy(camera.quaternion); halo.scale.setScalar(selected.size * 1.35 * (1 + Math.sin(time * 3.4) * .08)) } else halo.visible = false
      const effect = feedRef.current; if (effect && performance.now() - effect.time < 1250) { const rig = byId.get(effect.id); if (rig) { const progress = (performance.now() - effect.time) / 1250; feedGlow.visible = true; feedGlow.position.copy(rig.root.position); feedGlow.quaternion.copy(camera.quaternion); feedGlow.scale.setScalar(.8 + progress * 2.5); (feedGlow.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * .8 } } else feedGlow.visible = false
      controls.update(); renderer.render(scene, camera); frame = requestAnimationFrame(animate) }
    frame = requestAnimationFrame(animate)
    return () => { stopped = true; cancelAnimationFrame(frame); observer.disconnect(); renderer.domElement.removeEventListener('pointerdown', down); renderer.domElement.removeEventListener('pointerup', up); controls.dispose(); scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points) { object.geometry?.dispose(); (Array.isArray(object.material) ? object.material : [object.material]).forEach(surface => surface?.dispose()) } }); renderer.dispose(); renderer.domElement.remove() }
  }, [manifest, signature])
  return <div ref={hostRef} className="relative h-[420px] w-full touch-none select-none overflow-hidden bg-[#032a3f] sm:aspect-[5/3] sm:h-auto" role="application" aria-label="可旋转查看的三维海洋馆，点击生物可以查看名称、状态并喂食"><div className="pointer-events-none absolute bottom-3 right-3 z-10 rounded-full border border-white/20 bg-slate-950/30 px-3 py-1.5 text-[10px] font-medium text-white/75 backdrop-blur">拖动旋转 · 滚轮缩放 · 点击生物</div></div>
}
