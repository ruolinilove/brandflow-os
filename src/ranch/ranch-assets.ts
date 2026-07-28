import { useEffect, useState } from 'react'
import type { RanchImages, RanchManifest } from './ranch-types'

export function useRanchAssets() {
  const [state, setState] = useState<{ manifest: RanchManifest | null; images: RanchImages; loading: boolean; error: string }>({ manifest: null, images: {}, loading: true, error: '' })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const response = await fetch('/assets/ranch-assets.json')
        if (!response.ok) throw new Error('牧场资源清单加载失败。')
        const manifest = await response.json() as RanchManifest
        const paths = Array.from(new Set([
          manifest.background,
          ...Object.values(manifest.animals).flatMap(animal => [animal.image, animal.productImage]),
        ]))
        const entries = await Promise.all(paths.map(path => new Promise<[string, HTMLImageElement]>((resolve, reject) => {
          const image = new Image()
          image.onload = () => resolve([path, image])
          image.onerror = () => reject(new Error(`无法加载牧场素材：${path}`))
          image.src = path
        })))
        if (active) setState({ manifest, images: Object.fromEntries(entries), loading: false, error: '' })
      } catch (error) {
        if (active) setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : '牧场素材加载失败。' }))
      }
    })()
    return () => { active = false }
  }, [])

  return state
}
