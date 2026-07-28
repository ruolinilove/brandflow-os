export const growthOrder = ['seed', 'sprout', 'small', 'medium', 'large', 'ready'] as const

export type GrowingState = typeof growthOrder[number]
export type PlantState = GrowingState | 'harvest'
export type PlantAnimation = 'blink' | 'sway' | 'grow' | 'ready' | 'harvest'

export type PlantStageAsset = {
  image: string
  durationMs: number
  animation: PlantAnimation
}

export type PlantAsset = {
  name: string
  seedPrice: number
  harvestCoins: number
  harvestExperience: number
  sellPrice: number
  states: Record<PlantState, PlantStageAsset>
}

export type FarmAssetManifest = {
  background: string
  animals: Record<string, string>
  ui: Record<string, string>
  effects: Record<string, string>
  plants: Record<string, PlantAsset>
}

export type FarmPlot = {
  position: number
  plantKey: string | null
  growthState: PlantState | null
  plantedAt: string | null
}

export type FarmPlayerState = {
  level: number
  experience: number
  coins: number
  seeds: Record<string, number>
  inventory: Record<string, number>
  selectedCrop: string
}

export type FarmImages = Record<string, HTMLImageElement>

export function stateAtTime(plant: PlantAsset, plantedAt: string, now = Date.now()): GrowingState {
  let elapsed = Math.max(0, now - new Date(plantedAt).getTime())
  for (const state of growthOrder) {
    if (state === 'ready') return 'ready'
    const duration = plant.states[state].durationMs
    if (elapsed < duration) return state
    elapsed -= duration
  }
  return 'ready'
}

export function timeUntilReady(plant: PlantAsset, plantedAt: string, now = Date.now()) {
  const total = growthOrder.reduce((sum, state) => sum + plant.states[state].durationMs, 0)
  return Math.max(0, total - Math.max(0, now - new Date(plantedAt).getTime()))
}
