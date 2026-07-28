export type AquariumCreatureAsset = {
  name: string
  scientificName: string
  image: string
  speed: number
  size: number
  food: string
  zone: 'upper' | 'open' | 'reef' | 'bottom'
}

export type AquariumManifest = {
  background: string
  creatures: Record<string, AquariumCreatureAsset>
}

export type AquariumCreature = {
  id: string
  speciesKey: string
  nickname: string
  hunger: number
  health: number
  x: number
  y: number
  acquiredAt: string
}

export type AquariumPlayer = {
  level: number
  experience: number
  shells: number
  food: number
}

export type AquariumImages = Record<string, HTMLImageElement>
