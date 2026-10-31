import { useEffect, useState } from 'react'
import type { AquariumImages, AquariumManifest } from './aquarium-types'

export function useAquariumAssets() {
  const [state, setState] = useState<{ manifest: AquariumManifest | null; images: AquariumImages; loading: boolean; error: string }>({ manifest: null, images: {}, loading: true, error: '' })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const response = await fetch('/assets/aquarium-assets.json')
        if (!response.ok) throw new Error('海洋馆资源清单加载失败。')
        const manifest = await response.json() as AquariumManifest
        if (active) setState({ manifest, images: {}, loading: false, error: '' })
      } catch (error) {
        if (active) setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : '海洋馆素材加载失败。' }))
      }
    })()
    return () => { active = false }
  }, [])

  return state
}
