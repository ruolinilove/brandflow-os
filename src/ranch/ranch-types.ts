export type RanchZone = 'pasture' | 'barn' | 'pond'

export type RanchAnimalAsset = {
  name: string
  speciesName: string
  image: string
  speed: number
  size: number
  feed: string
  zone: RanchZone
  productKey: string
  productName: string
  productImage: string
  productValue: number
  productionSeconds: number
}

export type RanchManifest = {
  background: string
  animals: Record<string, RanchAnimalAsset>
}

export type RanchAnimal = {
  id: string
  speciesKey: string
  nickname: string
  hunger: number
  health: number
  x: number
  y: number
  productionStartedAt: string
  acquiredAt: string
}

export type RanchPlayer = {
  level: number
  experience: number
  coins: number
  feed: number
  inventory: Record<string, number>
}

export type RanchImages = Record<string, HTMLImageElement>
