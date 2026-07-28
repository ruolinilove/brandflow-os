import { AnimatePresence, motion } from 'framer-motion'
import { BookOpen, Fish, HeartPulse, Shell, Utensils, Waves, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { loadAquarium, saveAquarium } from '../lib/brandflow-db'
import { isSupabaseConfigured } from '../lib/supabase'
import { useAquariumAssets } from './aquarium-assets'
import { AquariumCanvas } from './AquariumCanvas'
import type { AquariumCreature, AquariumPlayer } from './aquarium-types'

type AquariumGameProps = { profile: { displayName: string; avatarUrl: string | null } }

const defaultPlayer: AquariumPlayer = { level: 1, experience: 18, shells: 880, food: 20 }

function makeDefaultCreatures(): AquariumCreature[] {
  const acquiredAt = new Date().toISOString()
  return [
    ['clownfish', .28, .43, 88], ['blueTang', .56, .34, 76], ['jellyfish', .79, .25, 92],
    ['seahorse', .18, .67, 64], ['greenTurtle', .73, .65, 82], ['starfish', .48, .86, 70],
  ].map(([speciesKey, x, y, hunger]) => ({ id: crypto.randomUUID(), speciesKey, nickname: '', hunger, health: 100, x, y, acquiredAt } as AquariumCreature))
}

function readLocalAquarium() {
  try {
    const value = JSON.parse(localStorage.getItem('brandflow-aquarium-v1') || 'null')
    return value && Array.isArray(value.creatures) ? value as { player: AquariumPlayer; creatures: AquariumCreature[]; notice: string } : null
  } catch { return null }
}

function hungerStatus(hunger: number) {
  if (hunger >= 80) return { label: '活力充沛', color: 'text-emerald-600', bar: 'bg-emerald-500' }
  if (hunger >= 50) return { label: '状态良好', color: 'text-sky-600', bar: 'bg-sky-500' }
  if (hunger >= 25) return { label: '有点饿了', color: 'text-amber-600', bar: 'bg-amber-500' }
  return { label: '需要喂食', color: 'text-rose-600', bar: 'bg-rose-500' }
}

export function AquariumGame({ profile }: AquariumGameProps) {
  const assets = useAquariumAssets()
  const local = useMemo(readLocalAquarium, [])
  const [player, setPlayer] = useState<AquariumPlayer>(local?.player ?? defaultPlayer)
  const [creatures, setCreatures] = useState<AquariumCreature[]>(local?.creatures ?? makeDefaultCreatures)
  const [notice, setNotice] = useState(local?.notice ?? '水质清澈，所有生物状态正常')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [feedPulse, setFeedPulse] = useState<{ id: string; nonce: number } | null>(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    loadAquarium().then((data: any) => {
      if (!active) return
      if (data.state) setPlayer({ level: Number(data.state.level), experience: Number(data.state.experience), shells: Number(data.state.shells), food: Number(data.state.food) })
      if (data.state?.notice) setNotice(data.state.notice)
      if (data.creatures.length) setCreatures(data.creatures.map((creature: any) => ({
        id: creature.id,
        speciesKey: creature.species_key,
        nickname: creature.nickname,
        hunger: Number(creature.hunger),
        health: Number(creature.health),
        x: Number(creature.position_x),
        y: Number(creature.position_y),
        acquiredAt: creature.acquired_at,
      })))
      setReady(true)
    }).catch(error => { setNotice(error instanceof Error ? `海洋馆读取失败：${error.message}` : '海洋馆读取失败'); setSaveStatus('error') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCreatures(current => current.map(creature => ({ ...creature, hunger: Math.max(0, creature.hunger - 1), health: creature.hunger <= 10 ? Math.max(0, creature.health - 1) : creature.health })))
    }, 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(async () => {
      if (!isSupabaseConfigured) {
        localStorage.setItem('brandflow-aquarium-v1', JSON.stringify({ player, creatures, notice }))
        setSaveStatus('saved')
        return
      }
      setSaveStatus('saving')
      try {
        await saveAquarium({ ...player, notice }, creatures.map(creature => ({
          id: creature.id,
          species_key: creature.speciesKey,
          nickname: creature.nickname,
          hunger: creature.hunger,
          health: creature.health,
          position_x: creature.x,
          position_y: creature.y,
          acquired_at: creature.acquiredAt,
        })))
        setSaveStatus('saved')
      } catch (error) {
        setSaveStatus('error')
        setNotice(error instanceof Error ? `保存失败：${error.message}` : '海洋馆保存失败')
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [player, creatures, notice, ready])

  const feedCreature = (id: string) => {
    if (player.food <= 0) { setNotice('饲料已经用完了'); return }
    const creature = creatures.find(item => item.id === id)
    const asset = creature && assets.manifest?.creatures[creature.speciesKey]
    if (!creature || !asset) return
    if (creature.hunger >= 100) { setNotice(`${creature.nickname || asset.name}现在还不饿`); return }
    setPlayer(current => ({ ...current, food: current.food - 1, experience: current.experience + 2 }))
    setCreatures(current => current.map(item => item.id === id ? { ...item, hunger: Math.min(100, item.hunger + 24), health: Math.min(100, item.health + 3) } : item))
    setFeedPulse({ id, nonce: Date.now() })
    setNotice(`喂给${creature.nickname || asset.name}${asset.food}，+2 经验`)
  }

  const feedAll = () => {
    const hungry = creatures.filter(creature => creature.hunger < 100)
    if (!hungry.length) { setNotice('大家都已经吃饱了'); return }
    const feedCount = Math.min(player.food, hungry.length)
    if (!feedCount) { setNotice('饲料已经用完了'); return }
    const fedIds = new Set(hungry.slice(0, feedCount).map(creature => creature.id))
    setPlayer(current => ({ ...current, food: current.food - feedCount, experience: current.experience + feedCount * 2 }))
    setCreatures(current => current.map(creature => fedIds.has(creature.id) ? { ...creature, hunger: Math.min(100, creature.hunger + 24), health: Math.min(100, creature.health + 3) } : creature))
    setNotice(`已照料 ${feedCount} 只海洋生物，+${feedCount * 2} 经验`)
  }

  const selected = creatures.find(creature => creature.id === selectedId) ?? null
  const selectedAsset = selected && assets.manifest?.creatures[selected.speciesKey]
  const averageHunger = Math.round(creatures.reduce((sum, creature) => sum + creature.hunger, 0) / Math.max(1, creatures.length))

  if (assets.error) return <div className="rounded-3xl bg-rose-50 p-8 text-sm text-rose-600">{assets.error}</div>

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1"><div><p className="text-xs font-semibold uppercase text-[#2383a1]">My Aquarium</p><h1 className="mt-1 text-2xl font-semibold">我的海洋馆</h1></div><div className="flex items-center gap-2 text-xs text-slate-400"><span>{creatures.length} 种生物</span><i className="size-1 rounded-full bg-slate-300"/><span className="font-semibold text-cyan-700">平均饱食度 {averageHunger}%</span></div></div>

    <section className="relative overflow-hidden rounded-[28px] border-[5px] border-white bg-[#0879a8] shadow-[0_24px_70px_rgba(16,94,126,.23)]">
      {assets.manifest && !assets.loading ? <AquariumCanvas creatures={creatures} manifest={assets.manifest} images={assets.images} selectedId={selectedId} feedPulse={feedPulse} onSelect={id => setSelectedId(id)}/> : <div className="aspect-[5/3] animate-pulse bg-cyan-200"/>}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 sm:p-4">
        <div className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl border-2 border-white/70 bg-[#eafcff]/92 p-2 shadow-[0_7px_0_rgba(8,64,91,.25)] backdrop-blur sm:gap-3 sm:p-3">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="馆长头像" className="size-10 rounded-xl object-cover ring-2 ring-white sm:size-12"/> : <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#2e9fbb] font-black text-white ring-2 ring-white sm:size-12">{profile.displayName.charAt(0) || '海'}</span>}
          <div className="min-w-0"><div className="flex items-center gap-2"><b className="max-w-28 truncate text-xs text-[#174b5e] sm:max-w-none sm:text-sm">{profile.displayName}</b><span className="rounded-full bg-[#35a9c4] px-2 py-0.5 text-[9px] font-black text-white">馆长 Lv.{player.level}</span></div><div className="mt-1.5 h-2 w-28 overflow-hidden rounded-full border border-[#60b6c8] bg-white/80 sm:w-44"><motion.div animate={{ width: `${Math.min(100, player.experience / 60 * 100)}%` }} className="h-full rounded-full bg-[#4ec5a7]"/></div><p className="mt-0.5 text-[9px] text-[#4d8492]">经验 {player.experience}/60</p></div>
        </div>
        <div className="pointer-events-auto flex flex-col items-end gap-2"><div className="flex gap-2"><ResourcePill icon={<Shell size={17}/>} value={player.shells}/><ResourcePill icon={<Utensils size={17}/>} value={player.food}/></div><span className="rounded-xl bg-[#083b56]/75 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur">{saveStatus === 'saving' ? '保存中' : saveStatus === 'error' ? '保存异常' : '已同步'}</span></div>
      </div>

      <div className="absolute right-2.5 top-[92px] flex gap-2 sm:right-4 sm:top-[106px] sm:flex-col">
        <OceanTool label="全部喂食" icon={<Utensils size={20}/>} onClick={feedAll}/>
        <OceanTool label="生物图鉴" icon={<BookOpen size={20}/>} active={catalogOpen} onClick={() => setCatalogOpen(current => !current)}/>
      </div>

      <AnimatePresence>{selected && selectedAsset && <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="absolute bottom-14 left-2.5 w-[min(310px,calc(100%-20px))] rounded-2xl border-2 border-white/80 bg-[#effcff]/94 p-3 shadow-xl backdrop-blur sm:bottom-5 sm:left-4 sm:p-4"><button onClick={() => setSelectedId(null)} aria-label="关闭生物详情" className="absolute right-2 top-2 grid size-7 place-items-center rounded-lg text-cyan-800 hover:bg-cyan-100"><X size={14}/></button><div className="flex items-center gap-3"><img src={selectedAsset.image} alt={selectedAsset.name} className="size-14 object-contain"/><div><b className="text-sm text-[#17485d]">{selected.nickname || selectedAsset.name}</b><p className="mt-0.5 text-[10px] italic text-[#5d8795]">{selectedAsset.scientificName}</p><p className={`mt-1 text-[11px] font-semibold ${hungerStatus(selected.hunger).color}`}>{hungerStatus(selected.hunger).label}</p></div></div><div className="mt-3 flex items-center gap-2"><div className="h-2 flex-1 overflow-hidden rounded-full bg-cyan-100"><div className={`h-full rounded-full ${hungerStatus(selected.hunger).bar}`} style={{ width: `${selected.hunger}%` }}/></div><b className="text-[11px] text-cyan-800">{selected.hunger}%</b><button onClick={() => feedCreature(selected.id)} className="rounded-xl bg-[#2ca9bd] px-3 py-2 text-[11px] font-bold text-white">喂食</button></div></motion.div>}</AnimatePresence>

      <AnimatePresence>{catalogOpen && assets.manifest && <motion.aside initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} className="absolute bottom-2.5 right-2.5 top-2.5 z-10 w-[min(355px,calc(100%-20px))] overflow-auto rounded-3xl border-[3px] border-white/85 bg-[#effcff]/97 p-4 shadow-2xl backdrop-blur sm:bottom-5 sm:right-20 sm:top-[106px] sm:p-5"><div className="flex items-center justify-between"><div><h2 className="font-black text-[#164c60]">海洋生物图鉴</h2><p className="mt-1 text-[10px] text-cyan-700">馆内生物 {creatures.length}/{Object.keys(assets.manifest.creatures).length}</p></div><button onClick={() => setCatalogOpen(false)} aria-label="关闭图鉴" className="grid size-8 place-items-center rounded-xl bg-cyan-100 text-cyan-800"><X size={16}/></button></div><div className="mt-4 space-y-2">{creatures.map(creature => { const asset = assets.manifest!.creatures[creature.speciesKey]; const status = hungerStatus(creature.hunger); return <button key={creature.id} onClick={() => { setSelectedId(creature.id); setCatalogOpen(false) }} className="flex w-full items-center gap-3 rounded-2xl border border-cyan-100 bg-white p-3 text-left"><img src={asset.image} alt="" className="size-12 object-contain"/><div className="min-w-0 flex-1"><b className="text-xs text-[#16495c]">{asset.name}</b><p className="mt-0.5 truncate text-[9px] italic text-slate-400">{asset.scientificName}</p><p className={`mt-1 text-[10px] font-semibold ${status.color}`}>{status.label} · {creature.hunger}%</p></div></button>})}</div></motion.aside>}</AnimatePresence>

      <div className="absolute bottom-3 left-1/2 max-w-[calc(100%-24px)] -translate-x-1/2 sm:bottom-5"><AnimatePresence mode="wait"><motion.div key={notice} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="whitespace-nowrap rounded-2xl border-2 border-white/70 bg-[#073d58]/84 px-4 py-2 text-[11px] font-semibold text-white shadow-lg backdrop-blur sm:text-xs">{notice}</motion.div></AnimatePresence></div>
    </section>

    <div className="mt-4 grid gap-3 sm:grid-cols-3"><OceanInfo icon={<Fish size={19}/>} title="馆内生物" value={`${creatures.length} 只均已标注`} color="bg-cyan-50 text-cyan-700"/><OceanInfo icon={<HeartPulse size={19}/>} title="健康监测" value={`${creatures.filter(item => item.health >= 80).length}/${creatures.length} 状态健康`} color="bg-emerald-50 text-emerald-700"/><OceanInfo icon={<Waves size={19}/>} title="水质状态" value="清澈 · 循环正常" color="bg-sky-50 text-sky-700"/></div>
  </div>
}

function ResourcePill({ icon, value }: { icon: React.ReactNode; value: number }) { return <span className="flex h-10 items-center gap-1.5 rounded-2xl border-2 border-white/70 bg-[#eafcff]/92 px-3 text-xs font-black text-[#17617a] shadow-[0_5px_0_rgba(8,64,91,.22)] sm:h-12 sm:text-sm">{icon}{value}</span> }

function OceanTool({ label, icon, active = false, onClick }: { label: string; icon: React.ReactNode; active?: boolean; onClick: () => void }) { return <motion.button whileHover={{ x: -3 }} whileTap={{ scale: .94 }} title={label} aria-label={label} onClick={onClick} className={`grid size-11 place-items-center rounded-2xl border-2 shadow-[0_5px_0_rgba(8,64,91,.28)] sm:size-12 ${active ? 'border-[#ffe47b] bg-[#ffd85b] text-[#65461e]' : 'border-white/85 bg-[#eafcff]/95 text-[#17617a]'}`}>{icon}</motion.button> }

function OceanInfo({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: string; color: string }) { return <motion.div whileHover={{ y: -2 }} className="flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-[0_12px_35px_rgba(54,84,72,.07)]"><span className={`grid size-10 place-items-center rounded-xl ${color}`}>{icon}</span><div><p className="text-[11px] text-slate-400">{title}</p><b className="mt-0.5 block text-sm text-slate-700">{value}</b></div></motion.div> }
