import { useEffect, useState } from 'react'
import type { FarmAssetManifest, FarmImages } from './farm-types'

type AssetState = {
  manifest: FarmAssetManifest | null
  images: FarmImages
  loading: boolean
  error: string
}

function collectAssetPaths(manifest: FarmAssetManifest) {
  const paths = [manifest.background, ...Object.values(manifest.animals), ...Object.values(manifest.ui), ...Object.values(manifest.effects)]
  Object.values(manifest.plants).forEach(plant => Object.values(plant.states).forEach(state => paths.push(state.image)))
  return [...new Set(paths)]
}

function loadImage(path: string) {
  return new Promise<[string, HTMLImageElement]>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve([path, image])
    image.onerror = () => reject(new Error(`无法加载农场素材：${path}`))
    image.src = path
  })
}

export function useFarmAssets(): AssetState {
  const [state, setState] = useState<AssetState>({ manifest: null, images: {}, loading: true, error: '' })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const response = await fetch('/assets/farm-assets.json')
        if (!response.ok) throw new Error('农场资源清单加载失败。')
        const manifest = await response.json() as FarmAssetManifest
        const entries = await Promise.all(collectAssetPaths(manifest).map(loadImage))
        if (active) setState({ manifest, images: Object.fromEntries(entries), loading: false, error: '' })
      } catch (error) {
        if (active) setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : '农场素材加载失败。' }))
      }
    })()
    return () => { active = false }
  }, [])

  return state
}
