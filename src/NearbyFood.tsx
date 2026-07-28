import { useMemo, useRef, useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  ChevronDown, ExternalLink, KeyRound, LocateFixed, MapPin, Navigation,
  Search, Star, UtensilsCrossed,
} from 'lucide-react'

type Coordinate = [number, number]
type SortMode = 'recommended' | 'rating' | 'distance'

type Restaurant = {
  id: string
  name: string
  category: string
  rating: number
  distance: number
  cost?: number
  address: string
  coordinate: Coordinate
  preview?: boolean
}

type AMapConfig = {
  key: string
  securityCode: string
}

declare global {
  interface Window {
    AMap?: any
    _AMapSecurityConfig?: { securityJsCode: string }
  }
}

const cardClass = 'rounded-3xl border border-white/90 bg-white shadow-[0_18px_55px_rgba(54,84,72,0.08)]'
const guiYangCenter: Coordinate = [106.630153, 26.647661]
const categories = ['全部', '贵州菜', '火锅', '烧烤', '咖啡', '小吃']

const previewRestaurants: Restaurant[] = [
  { id:'preview-1', name:'酸汤小馆（预览）', category:'贵州菜', rating:4.8, distance:420, cost:68, address:'连接地图后显示真实地址', coordinate:[106.6320,26.6485], preview:true },
  { id:'preview-2', name:'巷子烧烤（预览）', category:'烧烤', rating:4.6, distance:780, cost:52, address:'连接地图后显示真实地址', coordinate:[106.6268,26.6461], preview:true },
  { id:'preview-3', name:'黔味火锅（预览）', category:'火锅', rating:4.7, distance:1200, cost:92, address:'连接地图后显示真实地址', coordinate:[106.6350,26.6445], preview:true },
  { id:'preview-4', name:'街角咖啡（预览）', category:'咖啡', rating:4.5, distance:1650, cost:36, address:'连接地图后显示真实地址', coordinate:[106.6240,26.6510], preview:true },
]

let amapLoader: Promise<any> | null = null

function loadAMap(config: AMapConfig) {
  if (window.AMap) return Promise.resolve(window.AMap)
  if (amapLoader) return amapLoader
  window._AMapSecurityConfig = { securityJsCode: config.securityCode }
  amapLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(config.key)}&plugin=AMap.PlaceSearch,AMap.ToolBar`
    script.async = true
    script.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error('高德地图加载失败'))
    script.onerror = () => reject(new Error('无法连接高德地图，请检查密钥或网络'))
    document.head.appendChild(script)
  })
  return amapLoader
}

function parseCoordinate(location: any): Coordinate {
  const lng = typeof location?.getLng === 'function' ? location.getLng() : Number(location?.lng)
  const lat = typeof location?.getLat === 'function' ? location.getLat() : Number(location?.lat)
  return [Number.isFinite(lng) ? lng : guiYangCenter[0], Number.isFinite(lat) ? lat : guiYangCenter[1]]
}

function parseRating(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value
  const rating = Number(raw)
  return Number.isFinite(rating) && rating > 0 ? rating : 0
}

function mapPoi(poi: any, index: number): Restaurant {
  const coordinate = parseCoordinate(poi.location)
  const rawCost = Array.isArray(poi.biz_ext?.cost) ? poi.biz_ext.cost[0] : poi.biz_ext?.cost
  const cost = Number(rawCost)
  return {
    id: String(poi.id || `poi-${index}`),
    name: poi.name || '未命名餐厅',
    category: String(poi.type || '餐饮').split(';').pop() || '餐饮',
    rating: parseRating(poi.biz_ext?.rating),
    distance: Number(poi.distance) || 0,
    cost: Number.isFinite(cost) && cost > 0 ? cost : undefined,
    address: Array.isArray(poi.address) ? poi.address.join('') : poi.address || '暂无详细地址',
    coordinate,
  }
}

function readConfig(): AMapConfig {
  const envKey = import.meta.env.VITE_AMAP_JS_KEY || ''
  const envSecurityCode = import.meta.env.VITE_AMAP_SECURITY_CODE || ''
  try {
    return {
      key: envKey || localStorage.getItem('brandflow-amap-key') || '',
      securityCode: envSecurityCode || localStorage.getItem('brandflow-amap-security-code') || '',
    }
  } catch {
    return { key: envKey, securityCode: envSecurityCode }
  }
}

function formatDistance(distance: number) {
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.max(1, Math.round(distance))} m`
}

export function NearbyFood() {
  const mapElement = useRef<HTMLDivElement | null>(null)
  const mapInstance = useRef<any>(null)
  const amapApi = useRef<any>(null)
  const [config,setConfig] = useState<AMapConfig>(readConfig)
  const [configDraft,setConfigDraft] = useState<AMapConfig>(readConfig)
  const [center,setCenter] = useState<Coordinate>(guiYangCenter)
  const [locationName,setLocationName] = useState('贵阳市中心')
  const [query,setQuery] = useState('美食')
  const [category,setCategory] = useState('全部')
  const [radius,setRadius] = useState(3000)
  const [sortMode,setSortMode] = useState<SortMode>('recommended')
  const [restaurants,setRestaurants] = useState<Restaurant[]>(previewRestaurants)
  const [selectedId,setSelectedId] = useState(previewRestaurants[0].id)
  const [loading,setLoading] = useState(false)
  const [status,setStatus] = useState('')
  const connected = Boolean(config.key && config.securityCode)

  const searchNearby = async (keyword = query, point = center, distance = radius) => {
    if (!connected || !amapApi.current || !mapInstance.current) return
    setLoading(true)
    setStatus('')
    try {
      const result = await new Promise<any[]>((resolve,reject) => {
        const search = new amapApi.current.PlaceSearch({
          pageSize: 20,
          pageIndex: 1,
          extensions: 'all',
          map: mapInstance.current,
        })
        search.searchNearBy(keyword || '美食', point, distance, (state: string, response: any) => {
          if (state === 'complete') resolve(response?.poiList?.pois || [])
          else if (state === 'no_data') resolve([])
          else reject(new Error(response?.info || '附近餐厅查询失败'))
        })
      })
      const next = result.map(mapPoi)
      setRestaurants(next)
      setSelectedId(next[0]?.id || '')
      setStatus(next.length ? `找到 ${next.length} 家附近餐厅` : '附近暂未找到符合条件的餐厅')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '附近餐厅查询失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!connected || !mapElement.current) return
    let active = true
    setLoading(true)
    loadAMap(config).then((AMap) => {
      if (!active || !mapElement.current) return
      amapApi.current = AMap
      mapInstance.current?.destroy?.()
      mapInstance.current = new AMap.Map(mapElement.current, {
        center,
        zoom: 14,
        mapStyle: 'amap://styles/whitesmoke',
        viewMode: '2D',
      })
      mapInstance.current.addControl(new AMap.ToolBar({ position:{ top:'16px', right:'16px' } }))
      searchNearby('美食', center, radius)
    }).catch((error) => {
      if (active) {
        setStatus(error instanceof Error ? error.message : '高德地图加载失败')
        setLoading(false)
      }
    })
    return () => {
      active = false
      mapInstance.current?.destroy?.()
      mapInstance.current = null
    }
  }, [connected, config.key, config.securityCode])

  const visibleRestaurants = useMemo(() => {
    const filtered = category === '全部'
      ? restaurants
      : restaurants.filter(item => item.category.includes(category) || item.name.includes(category))
    return [...filtered].sort((a,b) => {
      if (sortMode === 'rating') return b.rating - a.rating
      if (sortMode === 'distance') return a.distance - b.distance
      return (b.rating * 100 - b.distance / 100) - (a.rating * 100 - a.distance / 100)
    })
  }, [restaurants,category,sortMode])

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    if (connected) searchNearby(query || '美食')
  }

  const chooseCategory = (nextCategory: string) => {
    setCategory(nextCategory)
    if (connected) searchNearby(nextCategory === '全部' ? '美食' : nextCategory)
  }

  const chooseRadius = (nextRadius: number) => {
    setRadius(nextRadius)
    if (connected) searchNearby(query || '美食', center, nextRadius)
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus('当前浏览器不支持定位')
      return
    }
    setLoading(true)
    setStatus('正在获取当前位置...')
    navigator.geolocation.getCurrentPosition(
      ({coords}) => {
        const nextCenter: Coordinate = [coords.longitude,coords.latitude]
        setCenter(nextCenter)
        setLocationName('我的当前位置')
        mapInstance.current?.setCenter(nextCenter)
        mapInstance.current?.setZoom(15)
        if (connected) searchNearby(query || '美食',nextCenter,radius)
        else setLoading(false)
      },
      () => {
        setStatus('定位未开启，当前展示贵阳市中心')
        setLoading(false)
      },
      { enableHighAccuracy:true,timeout:10000,maximumAge:300000 },
    )
  }

  const selectRestaurant = (restaurant: Restaurant) => {
    setSelectedId(restaurant.id)
    if (connected) {
      mapInstance.current?.setCenter(restaurant.coordinate)
      mapInstance.current?.setZoom(17)
    }
  }

  const saveConfig = (event: FormEvent) => {
    event.preventDefault()
    const clean = { key:configDraft.key.trim(),securityCode:configDraft.securityCode.trim() }
    if (!clean.key || !clean.securityCode) {
      setStatus('请填写 Web 端 JS API Key 和安全密钥')
      return
    }
    localStorage.setItem('brandflow-amap-key',clean.key)
    localStorage.setItem('brandflow-amap-security-code',clean.securityCode)
    amapLoader = null
    setConfig(clean)
    setStatus('正在连接高德地图...')
  }

  const selected = visibleRestaurants.find(item => item.id === selectedId) || visibleRestaurants[0]

  return <>
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#67a756]">Nearby Food</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950 sm:text-4xl">附近美食</h1>
        <p className="mt-2 text-sm text-slate-500">按当前位置查看餐厅评分、距离和人均消费。</p>
      </div>
      <motion.button onClick={locate} whileHover={{y:-2}} whileTap={{scale:.97}} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#8dcc65] px-5 text-sm font-semibold text-white shadow-lg shadow-lime-200">
        <LocateFixed size={17}/>定位附近
      </motion.button>
    </div>

    {!connected&&<motion.form onSubmit={saveConfig} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className={`${cardClass} mb-4 grid gap-4 p-5 lg:grid-cols-[auto_1fr_1fr_auto] lg:items-end`}>
      <span className="grid size-11 place-items-center rounded-2xl bg-amber-50 text-amber-600"><KeyRound size={20}/></span>
      <label className="text-xs font-medium text-slate-500">高德 Web 端 JS API Key<input type="password" value={configDraft.key} onChange={event=>setConfigDraft({...configDraft,key:event.target.value})} className="mt-2 h-11 w-full rounded-2xl border border-slate-100 bg-[#f8faf7] px-4 text-sm outline-none focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50" placeholder="填写 Key"/></label>
      <label className="text-xs font-medium text-slate-500">安全密钥<input type="password" value={configDraft.securityCode} onChange={event=>setConfigDraft({...configDraft,securityCode:event.target.value})} className="mt-2 h-11 w-full rounded-2xl border border-slate-100 bg-[#f8faf7] px-4 text-sm outline-none focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50" placeholder="填写安全密钥"/></label>
      <button className="h-11 rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white">连接地图</button>
    </motion.form>}

    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <form onSubmit={submitSearch} className="flex min-w-0 flex-1 gap-2">
        <div className="relative min-w-0 flex-1"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/><input value={query} onChange={event=>setQuery(event.target.value)} className="h-11 w-full rounded-2xl border border-white bg-white pl-11 pr-4 text-sm shadow-sm outline-none focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50" placeholder="搜索餐厅、菜品或品类"/></div>
        <button className="h-11 rounded-2xl border border-white bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm">搜索</button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl bg-white p-1 shadow-sm">{[1000,3000,5000].map(value=><button key={value} onClick={()=>chooseRadius(value)} className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${radius===value?'bg-[#dff2d6] text-[#39713c]':'text-slate-400 hover:text-slate-700'}`}>{value/1000} km</button>)}</div>
        <label className="relative"><select aria-label="美食排序" value={sortMode} onChange={event=>setSortMode(event.target.value as SortMode)} className="h-11 appearance-none rounded-2xl border border-white bg-white pl-4 pr-10 text-xs font-semibold text-slate-600 shadow-sm outline-none"><option value="recommended">综合排序</option><option value="rating">评分最高</option><option value="distance">距离最近</option></select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/></label>
      </div>
    </div>

    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{categories.map(item=><button key={item} onClick={()=>chooseCategory(item)} aria-pressed={category===item} className={`h-9 shrink-0 rounded-2xl px-4 text-xs font-semibold transition ${category===item?'bg-[#dff2d6] text-[#39713c]':'border border-white bg-white text-slate-400 shadow-sm hover:text-slate-700'}`}>{item}</button>)}</div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,.65fr)]">
      <section className={`${cardClass} relative min-h-[560px] overflow-hidden`}>
        <div ref={mapElement} className={`absolute inset-0 ${connected?'':'hidden'}`}/>
        {!connected&&<div className="absolute inset-0 bg-[#e7eee8]">
          <div className="absolute inset-0 opacity-40" style={{backgroundImage:'linear-gradient(#cdd9cf 1px, transparent 1px), linear-gradient(90deg, #cdd9cf 1px, transparent 1px)',backgroundSize:'56px 56px'}}/>
          {previewRestaurants.map((item,index)=><button key={item.id} onClick={()=>selectRestaurant(item)} aria-label={`查看 ${item.name}`} className={`absolute grid size-10 place-items-center rounded-full border-4 border-white text-xs font-bold shadow-lg transition ${selectedId===item.id?'scale-110 bg-[#73b954] text-white':'bg-white text-[#5e9950]'}`} style={{left:`${24+(index%2)*42}%`,top:`${25+Math.floor(index/2)*38}%`}}>{index+1}</button>)}
        </div>}
        <div className="absolute left-4 top-4 max-w-[calc(100%-32px)] rounded-2xl border border-white bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-semibold"><MapPin size={16} className="text-[#72b653]"/>{locationName}</div>
          <p className="mt-1 text-[11px] text-slate-400">{connected?'高德地图实时结果':'当前为界面预览数据'}</p>
        </div>
        {selected&&<div className="absolute bottom-4 left-4 right-4 flex flex-col gap-3 rounded-2xl border border-white bg-white/95 p-4 shadow-xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex items-center gap-2"><b className="truncate text-sm">{selected.name}</b><span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-500"><Star size={13} fill="currentColor"/>{selected.rating?selected.rating.toFixed(1):'暂无'}</span></div><p className="mt-1 truncate text-xs text-slate-400">{selected.address}</p></div>
          {!selected.preview&&<a href={`https://uri.amap.com/marker?position=${selected.coordinate.join(',')}&name=${encodeURIComponent(selected.name)}&src=brandflow&coordinate=gaode&callnative=1`} target="_blank" rel="noreferrer" className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#8dcc65] px-4 text-xs font-semibold text-white"><Navigation size={15}/>去这里</a>}
        </div>}
      </section>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1"><div><h2 className="font-semibold">附近餐厅</h2><p className="mt-1 text-xs text-slate-400">{status||`${visibleRestaurants.length} 个结果 · ${formatDistance(radius)} 内`}</p></div>{loading&&<span className="size-5 animate-spin rounded-full border-2 border-[#8dcc65] border-t-transparent"/>}</div>
        <div className="max-h-[518px] space-y-3 overflow-y-auto pr-1">{visibleRestaurants.map((item,index)=><motion.button key={item.id} onClick={()=>selectRestaurant(item)} whileHover={{y:-2}} className={`${cardClass} flex w-full items-start gap-4 p-4 text-left transition ${selectedId===item.id?'ring-2 ring-[#b9dea8]':'hover:border-emerald-100'}`}>
          <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-sm font-bold ${selectedId===item.id?'bg-[#8dcc65] text-white':'bg-[#edf7e8] text-[#5e9950]'}`}>{index+1}</span>
          <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><b className="truncate text-sm">{item.name}</b><span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-500"><Star size={13} fill="currentColor"/>{item.rating?item.rating.toFixed(1):'暂无'}</span></span><span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400"><span>{item.category}</span><span>{formatDistance(item.distance)}</span>{item.cost&&<span>人均 ¥{Math.round(item.cost)}</span>}</span><span className="mt-2 block truncate text-xs text-slate-500">{item.address}</span></span>
          {!item.preview&&<ExternalLink size={15} className="mt-1 shrink-0 text-slate-300"/>}
        </motion.button>)}</div>
        {!visibleRestaurants.length&&!loading&&<div className={`${cardClass} grid min-h-48 place-items-center p-6 text-center`}><div><UtensilsCrossed size={24} className="mx-auto text-slate-300"/><p className="mt-3 text-sm font-medium text-slate-500">没有找到符合条件的餐厅</p></div></div>}
      </div>
    </div>
  </>
}
