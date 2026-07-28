import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Clock3, Coins, HandCoins, HeartPulse, PackageOpen, PawPrint, ShoppingBag, Sparkles, Utensils, Wheat, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { loadRanch, saveRanch } from '../lib/brandflow-db'
import { isSupabaseConfigured } from '../lib/supabase'
import { useRanchAssets } from './ranch-assets'
import { RanchCanvas } from './RanchCanvas'
import type { RanchAnimal, RanchAnimalAsset, RanchManifest, RanchPlayer } from './ranch-types'

type RanchGameProps = { profile: { displayName: string; avatarUrl: string | null } }
type SidePanel = 'warehouse' | 'catalog' | 'shop' | null

const defaultPlayer: RanchPlayer = { level: 1, experience: 28, coins: 1280, feed: 24, inventory: {} }

function makeDefaultAnimals(): RanchAnimal[] {
  const now = Date.now()
  const definitions: Array<[string, number, number, number, number]> = [
    ['cow', .42, .67, 86, 520], ['sheep', .57, .56, 72, 260], ['pig', .29, .70, 81, 170],
    ['chicken', .68, .75, 90, 370], ['duck', .82, .72, 76, 410], ['rabbit', .51, .79, 68, 190],
  ]
  return definitions.map(([speciesKey, x, y, hunger, elapsedSeconds]) => ({
    id: crypto.randomUUID(), speciesKey, nickname: '', hunger, health: 100, x, y,
    productionStartedAt: new Date(now - elapsedSeconds * 1000).toISOString(), acquiredAt: new Date(now - 86400000).toISOString(),
  }))
}

function readLocalRanch() {
  try {
    const value = JSON.parse(localStorage.getItem('brandflow-ranch-v1') || 'null')
    return value && Array.isArray(value.animals) ? value as { player: RanchPlayer; animals: RanchAnimal[]; notice: string } : null
  } catch { return null }
}

function animalStatus(hunger: number, health: number) {
  if (health < 50) return { label: '需要照顾', color: 'text-rose-600', bar: 'bg-rose-500' }
  if (hunger >= 75) return { label: '精神饱满', color: 'text-emerald-700', bar: 'bg-emerald-500' }
  if (hunger >= 40) return { label: '状态良好', color: 'text-sky-700', bar: 'bg-sky-500' }
  return { label: '肚子饿了', color: 'text-amber-700', bar: 'bg-amber-500' }
}

function remainingSeconds(animal: RanchAnimal, asset: RanchAnimalAsset, now: number) {
  if (animal.hunger <= 15) return Number.POSITIVE_INFINITY
  return Math.max(0, asset.productionSeconds - Math.floor((now - Date.parse(animal.productionStartedAt)) / 1000))
}

function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds)) return '等待喂食'
  if (seconds <= 0) return '可以收取'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function RanchGame({ profile }: RanchGameProps) {
  const assets = useRanchAssets()
  const local = useMemo(readLocalRanch, [])
  const [player, setPlayer] = useState<RanchPlayer>(local?.player ?? defaultPlayer)
  const [animals, setAnimals] = useState<RanchAnimal[]>(local?.animals ?? makeDefaultAnimals)
  const [notice, setNotice] = useState(local?.notice ?? '动物们正在牧场里悠闲活动')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panel, setPanel] = useState<SidePanel>(null)
  const [clock, setClock] = useState(Date.now())
  const [actionPulse, setActionPulse] = useState<{ id: string; kind: 'feed' | 'collect'; nonce: number } | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    loadRanch().then((data: any) => {
      if (!active) return
      if (data.state) setPlayer({
        level: Number(data.state.level), experience: Number(data.state.experience), coins: Number(data.state.coins),
        feed: Number(data.state.feed), inventory: data.state.inventory || {},
      })
      if (data.state?.notice) setNotice(data.state.notice)
      if (data.animals.length) setAnimals(data.animals.map((animal: any) => ({
        id: animal.id, speciesKey: animal.species_key, nickname: animal.nickname, hunger: Number(animal.hunger),
        health: Number(animal.health), x: Number(animal.position_x), y: Number(animal.position_y),
        productionStartedAt: animal.production_started_at, acquiredAt: animal.acquired_at,
      })))
      setReady(true)
    }).catch(error => { setNotice(error instanceof Error ? `牧场读取失败：${error.message}` : '牧场读取失败'); setSaveStatus('error'); setReady(true) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setAnimals(current => current.map(animal => ({
        ...animal, hunger: Math.max(0, animal.hunger - 1), health: animal.hunger <= 10 ? Math.max(0, animal.health - 1) : animal.health,
      })))
    }, 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(async () => {
      if (!isSupabaseConfigured) {
        localStorage.setItem('brandflow-ranch-v1', JSON.stringify({ player, animals, notice }))
        setSaveStatus('saved')
        return
      }
      setSaveStatus('saving')
      try {
        await saveRanch({ ...player, notice }, animals.map(animal => ({
          id: animal.id, species_key: animal.speciesKey, nickname: animal.nickname, hunger: animal.hunger,
          health: animal.health, position_x: animal.x, position_y: animal.y,
          production_started_at: animal.productionStartedAt, acquired_at: animal.acquiredAt,
        })))
        setSaveStatus('saved')
      } catch (error) {
        setSaveStatus('error')
        setNotice(error instanceof Error ? `保存失败：${error.message}` : '牧场保存失败')
      }
    }, 650)
    return () => window.clearTimeout(timer)
  }, [player, animals, notice, ready])

  const addExperience = (amount: number) => setPlayer(current => {
    const threshold = current.level * 80
    const experience = current.experience + amount
    return experience >= threshold ? { ...current, level: current.level + 1, experience: experience - threshold } : { ...current, experience }
  })

  const feedAnimal = (id: string) => {
    if (player.feed <= 0) { setNotice('饲料已经用完，请到商店购买'); return }
    const animal = animals.find(item => item.id === id)
    const asset = animal && assets.manifest?.animals[animal.speciesKey]
    if (!animal || !asset) return
    if (animal.hunger >= 100) { setNotice(`${animal.nickname || asset.name}现在还不饿`); return }
    setPlayer(current => ({ ...current, feed: current.feed - 1 }))
    addExperience(2)
    setAnimals(current => current.map(item => item.id === id ? { ...item, hunger: Math.min(100, item.hunger + 25), health: Math.min(100, item.health + 4) } : item))
    setActionPulse({ id, kind: 'feed', nonce: Date.now() })
    setNotice(`喂给${animal.nickname || asset.name}${asset.feed}，+2 经验`)
  }

  const feedAll = () => {
    const hungry = animals.filter(animal => animal.hunger < 100)
    const count = Math.min(player.feed, hungry.length)
    if (!hungry.length) { setNotice('动物们都已经吃饱了'); return }
    if (!count) { setNotice('饲料已经用完，请到商店购买'); return }
    const ids = new Set(hungry.slice(0, count).map(animal => animal.id))
    setPlayer(current => ({ ...current, feed: current.feed - count }))
    addExperience(count * 2)
    setAnimals(current => current.map(animal => ids.has(animal.id) ? { ...animal, hunger: Math.min(100, animal.hunger + 25), health: Math.min(100, animal.health + 4) } : animal))
    setNotice(`已照料 ${count} 只动物，+${count * 2} 经验`)
  }

  const collectAnimal = (id: string, silent = false) => {
    const animal = animals.find(item => item.id === id)
    const asset = animal && assets.manifest?.animals[animal.speciesKey]
    if (!animal || !asset) return false
    if (remainingSeconds(animal, asset, Date.now()) > 0) { if (!silent) setNotice(`${asset.name}的${asset.productName}还没有准备好`); return false }
    setAnimals(current => current.map(item => item.id === id ? { ...item, productionStartedAt: new Date().toISOString() } : item))
    setPlayer(current => ({ ...current, inventory: { ...current.inventory, [asset.productKey]: (current.inventory[asset.productKey] || 0) + 1 } }))
    addExperience(5)
    setActionPulse({ id, kind: 'collect', nonce: Date.now() })
    if (!silent) setNotice(`收取 1 份${asset.productName}，已放入仓库，+5 经验`)
    return true
  }

  const collectAll = () => {
    if (!assets.manifest) return
    const collectable = animals.filter(animal => {
      const asset = assets.manifest!.animals[animal.speciesKey]
      return remainingSeconds(animal, asset, clock) <= 0
    })
    if (!collectable.length) { setNotice('暂时没有可以收取的产物'); return }
    const now = new Date().toISOString()
    const ids = new Set(collectable.map(animal => animal.id))
    const additions: Record<string, number> = {}
    collectable.forEach(animal => {
      const productKey = assets.manifest!.animals[animal.speciesKey].productKey
      additions[productKey] = (additions[productKey] || 0) + 1
    })
    setAnimals(current => current.map(animal => ids.has(animal.id) ? { ...animal, productionStartedAt: now } : animal))
    setPlayer(current => ({ ...current, inventory: Object.entries(additions).reduce((result, [key, amount]) => ({ ...result, [key]: (result[key] || 0) + amount }), current.inventory) }))
    addExperience(collectable.length * 5)
    setActionPulse({ id: collectable[0].id, kind: 'collect', nonce: Date.now() })
    setNotice(`一键收取 ${collectable.length} 份产物，+${collectable.length * 5} 经验`)
  }

  const buyFeed = () => {
    if (player.coins < 120) { setNotice('金币不足，无法购买饲料'); return }
    setPlayer(current => ({ ...current, coins: current.coins - 120, feed: current.feed + 10 }))
    setNotice('购买 10 份综合饲料，消耗 120 金币')
  }

  const sellAll = () => {
    if (!assets.manifest) return
    const products = Object.values(assets.manifest.animals)
    const total = Object.entries(player.inventory).reduce((sum, [key, amount]) => sum + (products.find(product => product.productKey === key)?.productValue || 0) * amount, 0)
    if (!total) { setNotice('仓库里还没有可以出售的产物'); return }
    setPlayer(current => ({ ...current, coins: current.coins + total, inventory: {} }))
    setNotice(`产物出售完成，+${total} 金币`)
  }

  const selected = animals.find(animal => animal.id === selectedId) ?? null
  const selectedAsset = selected && assets.manifest?.animals[selected.speciesKey]
  const collectableCount = assets.manifest ? animals.filter(animal => remainingSeconds(animal, assets.manifest!.animals[animal.speciesKey], clock) <= 0).length : 0
  const inventoryCount = Object.values(player.inventory).reduce((sum, count) => sum + count, 0)
  const averageHunger = Math.round(animals.reduce((sum, animal) => sum + animal.hunger, 0) / Math.max(1, animals.length))
  const experienceTarget = player.level * 80

  if (assets.error) return <div className="rounded-3xl bg-rose-50 p-8 text-sm text-rose-600">{assets.error}</div>

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1"><div><p className="text-xs font-semibold uppercase text-[#b46d29]">My Ranch</p><h1 className="mt-1 text-2xl font-semibold">我的牧场</h1></div><div className="flex items-center gap-2 text-xs text-slate-400"><span>{animals.length} 只动物</span><i className="size-1 rounded-full bg-slate-300"/><span className="font-semibold text-emerald-700">平均饱食度 {averageHunger}%</span></div></div>

    <section className="relative overflow-hidden rounded-[28px] border-[5px] border-white bg-[#68b94d] shadow-[0_24px_70px_rgba(69,111,55,.24)]">
      {assets.manifest && !assets.loading ? <RanchCanvas animals={animals} manifest={assets.manifest} images={assets.images} selectedId={selectedId} actionPulse={actionPulse} onSelect={setSelectedId}/> : <div className="aspect-[5/3] animate-pulse bg-emerald-200"/>}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 sm:p-4">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl border-2 border-white/80 bg-[#fff8d7]/94 p-2 shadow-[0_7px_0_rgba(94,76,31,.25)] backdrop-blur sm:gap-3 sm:p-3">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="牧场主头像" className="size-10 rounded-xl object-cover ring-2 ring-white sm:size-12"/> : <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#df9c43] font-black text-white ring-2 ring-white sm:size-12">{profile.displayName.charAt(0) || '牧'}</span>}
          <div className="min-w-0"><div className="flex items-center gap-2"><b className="max-w-28 truncate text-xs text-[#684923] sm:max-w-none sm:text-sm">{profile.displayName}</b><span className="rounded-full bg-[#e9a546] px-2 py-0.5 text-[9px] font-black text-white">牧场主 Lv.{player.level}</span></div><div className="mt-1.5 h-2 w-28 overflow-hidden rounded-full border border-[#d8ae59] bg-white/80 sm:w-44"><motion.div animate={{ width: `${Math.min(100, player.experience / experienceTarget * 100)}%` }} className="h-full rounded-full bg-[#6abe4c]"/></div><p className="mt-0.5 text-[9px] text-[#927245]">经验 {player.experience}/{experienceTarget}</p></div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2"><div className="flex gap-2"><ResourcePill icon={<Coins size={17}/>} value={player.coins}/><ResourcePill icon={<Wheat size={17}/>} value={player.feed}/></div><span className="rounded-xl bg-[#455226]/75 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur">{saveStatus === 'saving' ? '保存中' : saveStatus === 'error' ? '保存异常' : '已同步'}</span></div>
      </div>

      <div className="absolute right-2.5 top-[94px] flex gap-2 sm:right-4 sm:top-[108px] sm:flex-col">
        <RanchTool label="全部喂食" icon={<Utensils size={20}/>} onClick={feedAll}/>
        <RanchTool label={`收取产物${collectableCount ? ` (${collectableCount})` : ''}`} icon={<HandCoins size={20}/>} badge={collectableCount} onClick={collectAll}/>
        <RanchTool label="仓库" icon={<PackageOpen size={20}/>} badge={inventoryCount} active={panel === 'warehouse'} onClick={() => setPanel(current => current === 'warehouse' ? null : 'warehouse')}/>
        <RanchTool label="商店" icon={<ShoppingBag size={20}/>} active={panel === 'shop'} onClick={() => setPanel(current => current === 'shop' ? null : 'shop')}/>
        <RanchTool label="动物图鉴" icon={<BookOpen size={20}/>} active={panel === 'catalog'} onClick={() => setPanel(current => current === 'catalog' ? null : 'catalog')}/>
      </div>

      <AnimatePresence>{selected && selectedAsset && <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="absolute bottom-14 left-2.5 w-[min(330px,calc(100%-20px))] rounded-2xl border-2 border-white/85 bg-[#fffbed]/96 p-3 shadow-xl backdrop-blur sm:bottom-5 sm:left-4 sm:p-4"><button onClick={() => setSelectedId(null)} aria-label="关闭动物详情" className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-amber-900 hover:bg-amber-100"><X size={14}/></button><div className="flex items-center gap-3"><img src={selectedAsset.image} alt={selectedAsset.name} className="size-14 object-contain"/><div><b className="text-sm text-[#614523]">{selected.nickname || selectedAsset.name}</b><p className="mt-0.5 text-[10px] text-[#9a7549]">{selectedAsset.speciesName} · 爱吃{selectedAsset.feed}</p><p className={`mt-1 text-[11px] font-semibold ${animalStatus(selected.hunger, selected.health).color}`}>{animalStatus(selected.hunger, selected.health).label}</p></div></div><div className="mt-3 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-amber-100"><div className={`h-full rounded-full ${animalStatus(selected.hunger, selected.health).bar}`} style={{ width: `${selected.hunger}%` }}/></div><b className="text-[11px] text-amber-900">{selected.hunger}%</b></div><div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-[#f6efcf] px-3 py-2"><span className="flex items-center gap-1.5 text-[10px] text-[#856438]"><Clock3 size={13}/>{selectedAsset.productName} · {timeLabel(remainingSeconds(selected, selectedAsset, clock))}</span><div className="flex gap-1.5"><button onClick={() => feedAnimal(selected.id)} className="rounded-lg bg-[#75b94e] px-2.5 py-1.5 text-[10px] font-bold text-white">喂食</button><button disabled={remainingSeconds(selected, selectedAsset, clock) > 0} onClick={() => collectAnimal(selected.id)} className="rounded-lg bg-[#e5a140] px-2.5 py-1.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">收取</button></div></div></motion.div>}</AnimatePresence>

      <AnimatePresence>{panel && assets.manifest && <RanchSidePanel panel={panel} close={() => setPanel(null)} animals={animals} player={player} manifest={assets.manifest} onSelect={id => { setSelectedId(id); setPanel(null) }} onSell={sellAll} onBuyFeed={buyFeed}/>}</AnimatePresence>

      <div className="absolute bottom-3 left-1/2 max-w-[calc(100%-24px)] -translate-x-1/2 sm:bottom-5"><AnimatePresence mode="wait"><motion.div key={notice} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="whitespace-nowrap rounded-2xl border-2 border-white/70 bg-[#3c4b25]/88 px-4 py-2 text-[11px] font-semibold text-white shadow-lg backdrop-blur sm:text-xs">{notice}</motion.div></AnimatePresence></div>
    </section>

    <div className="mt-4 grid gap-3 sm:grid-cols-3"><RanchInfo icon={<PawPrint size={19}/>} title="牧场动物" value={`${animals.length} 只正在饲养`} color="bg-amber-50 text-amber-700"/><RanchInfo icon={<HeartPulse size={19}/>} title="健康状态" value={`${animals.filter(item => item.health >= 80).length}/${animals.length} 状态健康`} color="bg-emerald-50 text-emerald-700"/><RanchInfo icon={<Sparkles size={19}/>} title="待收产物" value={collectableCount ? `${collectableCount} 份可以收取` : '动物正在生产中'} color="bg-sky-50 text-sky-700"/></div>
  </div>
}

function RanchSidePanel({ panel, close, animals, player, manifest, onSelect, onSell, onBuyFeed }: { panel: Exclude<SidePanel, null>; close: () => void; animals: RanchAnimal[]; player: RanchPlayer; manifest: RanchManifest; onSelect: (id: string) => void; onSell: () => void; onBuyFeed: () => void }) {
  const products = Array.from(new Map(Object.values(manifest.animals).map(asset => [asset.productKey, asset])).values())
  const title = panel === 'warehouse' ? '牧场仓库' : panel === 'shop' ? '饲料商店' : '动物图鉴'
  return <motion.aside initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="absolute bottom-2.5 right-2.5 top-2.5 z-10 w-[min(370px,calc(100%-20px))] overflow-auto rounded-3xl border-[3px] border-white/90 bg-[#fffbed]/97 p-4 shadow-2xl backdrop-blur sm:bottom-5 sm:right-20 sm:top-[108px] sm:p-5"><div className="flex items-center justify-between"><div><h2 className="font-black text-[#624622]">{title}</h2><p className="mt-1 text-[10px] text-[#9b7444]">{panel === 'warehouse' ? `库存共 ${Object.values(player.inventory).reduce((sum, value) => sum + value, 0)} 件` : panel === 'shop' ? `当前饲料 ${player.feed} 份` : `已饲养 ${animals.length}/${Object.keys(manifest.animals).length} 种`}</p></div><button onClick={close} aria-label={`关闭${title}`} className="grid size-8 place-items-center rounded-xl bg-amber-100 text-amber-900"><X size={16}/></button></div>
    {panel === 'warehouse' && <><div className="mt-4 grid grid-cols-2 gap-2">{products.map(product => <div key={product.productKey} className="rounded-2xl border border-amber-100 bg-white p-3"><img src={product.productImage} alt={product.productName} className="mx-auto size-12 object-contain"/><div className="mt-2 flex items-center justify-between"><div><b className="block text-[11px] text-[#674923]">{product.productName}</b><span className="text-[9px] text-slate-400">售价 {product.productValue}</span></div><b className="text-sm text-amber-700">×{player.inventory[product.productKey] || 0}</b></div></div>)}</div><button onClick={onSell} className="mt-4 h-11 w-full rounded-2xl bg-[#df9b3e] text-xs font-black text-white shadow-[0_5px_0_#aa6e29]">全部出售</button></>}
    {panel === 'shop' && <div className="mt-4 rounded-2xl border border-amber-100 bg-white p-4"><div className="flex items-center gap-3"><span className="grid size-14 place-items-center rounded-2xl bg-[#eef6d8] text-[#68a642]"><Wheat size={27}/></span><div><b className="text-sm text-[#624622]">综合动物饲料</b><p className="mt-1 text-[10px] text-slate-400">适合牧场内所有动物</p></div></div><div className="mt-4 flex items-center justify-between"><span className="text-xs font-black text-amber-700">120 金币 / 10 份</span><button onClick={onBuyFeed} className="rounded-xl bg-[#75b94e] px-4 py-2 text-[11px] font-black text-white">购买</button></div></div>}
    {panel === 'catalog' && <div className="mt-4 space-y-2">{animals.map(animal => { const asset = manifest.animals[animal.speciesKey]; return <button key={animal.id} onClick={() => onSelect(animal.id)} className="flex w-full items-center gap-3 rounded-2xl border border-amber-100 bg-white p-3 text-left"><img src={asset.image} alt="" className="size-12 object-contain"/><div className="min-w-0 flex-1"><b className="text-xs text-[#614523]">{asset.name}</b><p className="mt-0.5 text-[9px] text-slate-400">{asset.speciesName} · 产出{asset.productName}</p><p className={`mt-1 text-[10px] font-semibold ${animalStatus(animal.hunger, animal.health).color}`}>{animalStatus(animal.hunger, animal.health).label} · {animal.hunger}%</p></div></button>})}</div>}
  </motion.aside>
}

function ResourcePill({ icon, value }: { icon: React.ReactNode; value: number }) { return <span className="flex h-10 items-center gap-1.5 rounded-2xl border-2 border-white/80 bg-[#fff8d7]/94 px-3 text-xs font-black text-[#704d20] shadow-[0_5px_0_rgba(94,76,31,.22)] sm:h-12 sm:text-sm">{icon}{value}</span> }

function RanchTool({ label, icon, active = false, badge = 0, onClick }: { label: string; icon: React.ReactNode; active?: boolean; badge?: number; onClick: () => void }) { return <motion.button whileHover={{ x: -3 }} whileTap={{ scale: .94 }} title={label} aria-label={label} onClick={onClick} className={`relative grid size-11 place-items-center rounded-2xl border-2 shadow-[0_5px_0_rgba(74,78,35,.3)] sm:size-12 ${active ? 'border-[#ffe47b] bg-[#ffd85b] text-[#65461e]' : 'border-white/90 bg-[#fff8d7]/96 text-[#755021]'}`}>{icon}{badge > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full border-2 border-white bg-rose-500 px-1 text-[9px] font-black leading-4 text-white">{badge}</span>}</motion.button> }

function RanchInfo({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: string; color: string }) { return <motion.div whileHover={{ y: -2 }} className="flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-[0_12px_35px_rgba(54,84,72,.07)]"><span className={`grid size-10 place-items-center rounded-xl ${color}`}>{icon}</span><div><p className="text-[11px] text-slate-400">{title}</p><b className="mt-0.5 block text-sm text-slate-700">{value}</b></div></motion.div> }
