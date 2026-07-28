import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Backpack, Bug, Coins, Droplets, Move, PackageOpen, ShoppingBasket, Shovel, Sparkles, Sprout, Store, Trophy, Users, Warehouse, Wrench, X } from 'lucide-react'
import { isSupabaseConfigured } from '../lib/supabase'
import { loadFarmGame, saveFarmGame } from '../lib/brandflow-db'
import { useFarmAssets } from './farm-assets'
import { FarmCanvas, type FarmToolMode } from './FarmCanvas'
import { stateAtTime, timeUntilReady, type FarmPlayerState, type FarmPlot } from './farm-types'

type FarmGameProps = {
  profile: { displayName: string; avatarUrl: string | null }
}

type Panel = 'shop' | 'warehouse' | 'friends' | null

const defaultPlayer: FarmPlayerState = {
  level: 1,
  experience: 12,
  coins: 126,
  seeds: { sunflower: 6 },
  inventory: { sunflower: 0 },
  selectedCrop: 'sunflower',
}

function initialPlots(): FarmPlot[] {
  const now = Date.now()
  return Array.from({ length: 18 }, (_, position) => {
    if (position === 0) return { position, plantKey: 'sunflower', growthState: 'ready', plantedAt: new Date(now - 30000).toISOString() }
    if (position === 1) return { position, plantKey: 'sunflower', growthState: 'medium', plantedAt: new Date(now - 12500).toISOString() }
    return { position, plantKey: null, growthState: null, plantedAt: null }
  })
}

function normalizePlots(source?: FarmPlot[]) {
  const byPosition = new Map((source || []).map(plot => [plot.position, plot]))
  return Array.from({ length: 18 }, (_, position) => byPosition.get(position) ?? { position, plantKey: null, growthState: null, plantedAt: null })
}

function readLocalFarm() {
  try {
    const value = JSON.parse(localStorage.getItem('brandflow-farm-v2') || 'null')
    return value && Array.isArray(value.plots) ? value as { player: FarmPlayerState; plots: FarmPlot[] } : null
  } catch {
    return null
  }
}

function formatWait(milliseconds: number) {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000))
  return seconds < 60 ? `${seconds} 秒后成熟` : `${Math.ceil(seconds / 60)} 分钟后成熟`
}

function expRequired(level: number) { return 40 + (level - 1) * 20 }

export function FarmGame({ profile }: FarmGameProps) {
  const assets = useFarmAssets()
  const local = useMemo(readLocalFarm, [])
  const [player, setPlayer] = useState<FarmPlayerState>(local?.player ?? defaultPlayer)
  const [plots, setPlots] = useState<FarmPlot[]>(() => local ? normalizePlots(local.plots) : initialPlots())
  const [tool, setTool] = useState<FarmToolMode>('auto')
  const [ready, setReady] = useState(!isSupabaseConfigured)
  const [panel, setPanel] = useState<Panel>(null)
  const [notice, setNotice] = useState('阳光正好，点击空土地播种吧')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const harvestTimers = useRef<number[]>([])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let active = true
    loadFarmGame().then((garden: any) => {
      if (!active) return
      const cloudPlots = Array.from({ length: 18 }, (_, position) => {
        const row = garden.plots.find((item: any) => Number(item.position) === position)
        if (!row?.plant_key && !row?.flower) return { position, plantKey: null, growthState: null, plantedAt: null } as FarmPlot
        const plantKey = row.plant_key || 'sunflower'
        const plantedAt = row.planted_at || new Date(Date.now() - (Number(row.stage) === 3 ? 30000 : 12000)).toISOString()
        const growthState = row.growth_state || (Number(row.stage) === 3 ? 'ready' : Number(row.stage) === 2 ? 'medium' : 'sprout')
        return { position, plantKey, plantedAt, growthState } as FarmPlot
      })
      setPlayer({
        level: Number(garden.state.level) || 1,
        experience: Number(garden.state.experience) || 0,
        coins: Number(garden.state.coins) || 0,
        seeds: garden.state.seeds || { sunflower: 6 },
        inventory: garden.state.inventory || { sunflower: 0 },
        selectedCrop: garden.state.selected_crop || 'sunflower',
      })
      setPlots(cloudPlots)
      setReady(true)
    }).catch(error => {
      setNotice(error instanceof Error ? `农场读取失败：${error.message}` : '农场读取失败')
      setSaveStatus('error')
    })
    return () => { active = false }
  }, [])

  useEffect(() => () => harvestTimers.current.forEach(timer => window.clearTimeout(timer)), [])

  useEffect(() => {
    if (!assets.manifest) return
    const timer = window.setInterval(() => {
      setPlots(current => {
        let changed = false
        const next = current.map(plot => {
          if (!plot.plantKey || !plot.plantedAt || plot.growthState === 'harvest') return plot
          const plant = assets.manifest?.plants[plot.plantKey]
          if (!plant) return plot
          const growthState = stateAtTime(plant, plot.plantedAt)
          if (growthState === plot.growthState) return plot
          changed = true
          return { ...plot, growthState }
        })
        return changed ? next : current
      })
    }, 500)
    return () => window.clearInterval(timer)
  }, [assets.manifest])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(async () => {
      const snapshot = { player, plots }
      if (!isSupabaseConfigured) {
        localStorage.setItem('brandflow-farm-v2', JSON.stringify(snapshot))
        setSaveStatus('saved')
        return
      }
      setSaveStatus('saving')
      try {
        await saveFarmGame({
          coins: player.coins,
          level: player.level,
          experience: player.experience,
          seeds: player.seeds,
          inventory: player.inventory,
          selected_crop: player.selectedCrop,
        }, plots.map(plot => ({
          position: plot.position,
          plant_key: plot.plantKey,
          growth_state: plot.growthState,
          planted_at: plot.plantedAt,
        })))
        setSaveStatus('saved')
      } catch (error) {
        setSaveStatus('error')
        setNotice(error instanceof Error ? `保存失败：${error.message}` : '农场保存失败')
      }
    }, 550)
    return () => window.clearTimeout(timer)
  }, [player, plots, ready])

  const addExperience = (coins: number, experience: number) => {
    setPlayer(current => {
      let level = current.level
      let nextExperience = current.experience + experience
      while (nextExperience >= expRequired(level)) {
        nextExperience -= expRequired(level)
        level += 1
      }
      if (level > current.level) setNotice(`升级啦！现在是 Lv.${level}`)
      return { ...current, level, experience: nextExperience, coins: current.coins + coins }
    })
  }

  const handlePlotClick = (position: number) => {
    if (!assets.manifest) return
    const plot = plots.find(item => item.position === position)
    if (!plot) return
    const selectedPlant = assets.manifest.plants[player.selectedCrop]
    if (tool === 'water') {
      if (!plot.plantKey || !plot.plantedAt) { setNotice('空土地不用浇水，先选择种子播种'); return }
      if (plot.growthState === 'ready') { setNotice(`${assets.manifest.plants[plot.plantKey].name}已经成熟，可以采收了`); return }
      const boostedAt = new Date(new Date(plot.plantedAt).getTime() - 4000).toISOString()
      setPlots(current => current.map(item => item.position === position ? { ...item, plantedAt: boostedAt } : item))
      setNotice(`浇水完成，${assets.manifest.plants[plot.plantKey].name}加速成长 4 秒`)
      return
    }
    if (tool === 'harvest' && plot.growthState !== 'ready') {
      setNotice(plot.plantKey ? '作物还没有成熟' : '这块土地还没有作物')
      return
    }
    if (!plot.plantKey) {
      const seedCount = player.seeds[player.selectedCrop] || 0
      if (seedCount <= 0) {
        setNotice('种子不够了，去商店补充一些吧')
        setPanel('shop')
        return
      }
      const plantedAt = new Date().toISOString()
      setPlayer(current => ({ ...current, seeds: { ...current.seeds, [current.selectedCrop]: seedCount - 1 } }))
      setPlots(current => current.map(item => item.position === position ? { ...item, plantKey: player.selectedCrop, growthState: 'seed', plantedAt } : item))
      setNotice(`${selectedPlant.name}种子已经落入土地，耐心等它发芽`)
      return
    }
    const plant = assets.manifest.plants[plot.plantKey]
    if (!plant || !plot.plantedAt) return
    if (plot.growthState !== 'ready') {
      setNotice(`${plant.name}正在成长，${formatWait(timeUntilReady(plant, plot.plantedAt))}`)
      return
    }
    setPlots(current => current.map(item => item.position === position ? { ...item, growthState: 'harvest' } : item))
    setNotice(`收获${plant.name}，+${plant.harvestCoins} 金币，+${plant.harvestExperience} 经验`)
    const timer = window.setTimeout(() => {
      setPlots(current => current.map(item => item.position === position ? { position, plantKey: null, growthState: null, plantedAt: null } : item))
      setPlayer(current => ({ ...current, inventory: { ...current.inventory, [plot.plantKey!]: (current.inventory[plot.plantKey!] || 0) + 1 } }))
      addExperience(plant.harvestCoins, plant.harvestExperience)
    }, plant.states.harvest.durationMs)
    harvestTimers.current.push(timer)
  }

  const buySeed = (plantKey: string) => {
    if (!assets.manifest) return
    const plant = assets.manifest.plants[plantKey]
    if (player.coins < plant.seedPrice) { setNotice('金币不足，先收获或出售仓库里的作物吧'); return }
    setPlayer(current => ({ ...current, coins: current.coins - plant.seedPrice, seeds: { ...current.seeds, [plantKey]: (current.seeds[plantKey] || 0) + 1 }, selectedCrop: plantKey }))
    setNotice(`购买了 1 颗${plant.name}种子`)
  }

  const sellProduce = (plantKey: string) => {
    if (!assets.manifest) return
    const count = player.inventory[plantKey] || 0
    if (!count) { setNotice('仓库里还没有可出售的收成'); return }
    const plant = assets.manifest.plants[plantKey]
    setPlayer(current => ({ ...current, coins: current.coins + count * plant.sellPrice, inventory: { ...current.inventory, [plantKey]: 0 } }))
    setNotice(`售出 ${count} 朵${plant.name}，获得 ${count * plant.sellPrice} 金币`)
  }

  const harvestAllReady = () => {
    if (!assets.manifest) return
    const readyPlots = plots.filter(plot => plot.plantKey && plot.growthState === 'ready')
    if (!readyPlots.length) { setNotice('当前没有成熟作物可以收获'); return }
    const additions: Record<string, number> = {}
    let totalCoins = 0
    let totalExperience = 0
    let animationDuration = 0
    readyPlots.forEach(plot => {
      const plant = assets.manifest!.plants[plot.plantKey!]
      additions[plot.plantKey!] = (additions[plot.plantKey!] || 0) + 1
      totalCoins += plant.harvestCoins
      totalExperience += plant.harvestExperience
      animationDuration = Math.max(animationDuration, plant.states.harvest.durationMs)
    })
    const positions = new Set(readyPlots.map(plot => plot.position))
    setPlots(current => current.map(plot => positions.has(plot.position) ? { ...plot, growthState: 'harvest' } : plot))
    setNotice(`一键收获 ${readyPlots.length} 块土地，+${totalCoins} 金币，+${totalExperience} 经验`)
    const timer = window.setTimeout(() => {
      setPlots(current => current.map(plot => positions.has(plot.position) ? { position: plot.position, plantKey: null, growthState: null, plantedAt: null } : plot))
      setPlayer(current => ({ ...current, inventory: Object.entries(additions).reduce((result, [key, count]) => ({ ...result, [key]: (result[key] || 0) + count }), current.inventory) }))
      addExperience(totalCoins, totalExperience)
    }, animationDuration)
    harvestTimers.current.push(timer)
  }

  const experienceTotal = expRequired(player.level)
  const growingCount = plots.filter(plot => plot.plantKey && plot.growthState !== 'ready' && plot.growthState !== 'harvest').length
  const readyCount = plots.filter(plot => plot.growthState === 'ready').length

  if (assets.error) return <div className="rounded-3xl bg-rose-50 p-8 text-sm text-rose-600">{assets.error}</div>

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-1">
      <div><p className="text-xs font-semibold uppercase text-[#65a759]">Social Farm</p><h1 className="mt-1 text-2xl font-semibold">我的农场</h1></div>
      <div className="flex items-center gap-2 text-xs text-slate-400"><span>{growingCount} 株成长中</span><i className="size-1 rounded-full bg-slate-300"/><span className="font-semibold text-amber-600">{readyCount} 株可收获</span></div>
    </div>

    <section className="relative overflow-hidden rounded-[28px] border-[5px] border-white bg-[#83c768] shadow-[0_24px_70px_rgba(44,91,49,.2)]">
      {assets.manifest && !assets.loading ? <FarmCanvas plots={plots} manifest={assets.manifest} images={assets.images} tool={tool} onPlotClick={handlePlotClick}/> : <div className="h-[340px] animate-pulse bg-[#c8e7b9] sm:h-auto sm:aspect-[5/3]"/>}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5 sm:p-4">
        <motion.div initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl border-2 border-white/80 bg-[#fff8dc]/95 p-2 shadow-[0_7px_0_rgba(111,76,35,.25)] backdrop-blur sm:gap-3 sm:p-3">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="玩家头像" className="size-10 rounded-xl object-cover ring-2 ring-white sm:size-12"/> : <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#83bf55] text-base font-black text-white ring-2 ring-white sm:size-12">{profile.displayName.charAt(0) || '农'}</span>}
          <div className="min-w-0"><div className="flex items-center gap-2"><b className="max-w-28 truncate text-xs text-[#573b24] sm:max-w-none sm:text-sm">{profile.displayName}</b><span className="rounded-full bg-[#f0b93f] px-2 py-0.5 text-[9px] font-black text-white sm:text-[10px]">Lv.{player.level}</span></div><div className="mt-1.5 h-2 w-28 overflow-hidden rounded-full border border-[#c4954c] bg-white/80 sm:w-44"><motion.div animate={{ width: `${Math.min(100, player.experience / experienceTotal * 100)}%` }} className="h-full rounded-full bg-[#68b653]"/></div><p className="mt-0.5 text-[9px] text-[#8a6b49]">经验 {player.experience}/{experienceTotal}</p></div>
        </motion.div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex h-10 items-center gap-2 rounded-2xl border-2 border-white/80 bg-[#fff8dc]/95 px-3 text-sm font-black text-[#7b4c20] shadow-[0_6px_0_rgba(111,76,35,.22)] sm:h-12 sm:px-4 sm:text-base"><img src={assets.manifest?.ui.coin} alt="" className="size-5 sm:size-6"/>{player.coins.toLocaleString('zh-CN')}</div>
          <span className="rounded-xl bg-[#284e2d]/75 px-2.5 py-1 text-[9px] font-semibold text-white backdrop-blur">{saveStatus === 'saving' ? '保存中' : saveStatus === 'error' ? '保存异常' : '已同步'}</span>
        </div>
      </div>

      <div className="absolute left-1/2 top-3 hidden -translate-x-1/2 items-start gap-1.5 lg:flex">
        <FarmTopEntry label="成就" icon={<Trophy size={21}/>} onClick={() => setNotice(`农场成就：已解锁 ${plots.filter(plot => plot.plantKey).length}/18 块种植记录`)}/>
        <FarmTopEntry label="装扮" icon={<Sparkles size={21}/>} onClick={() => setNotice('农场装扮功能正在准备更多主题')}/>
        <FarmTopEntry label="商店" icon={<Store size={21}/>} active={panel === 'shop'} onClick={() => setPanel(panel === 'shop' ? null : 'shop')}/>
        <FarmTopEntry label="仓库" icon={<Warehouse size={21}/>} badge={player.inventory.sunflower || 0} active={panel === 'warehouse'} onClick={() => setPanel(panel === 'warehouse' ? null : 'warehouse')}/>
        <FarmTopEntry label="加工" icon={<Wrench size={21}/>} onClick={() => setNotice('加工坊可把收成制作成更高价值商品')}/>
        <FarmTopEntry label="任务" icon={<Sprout size={21}/>} onClick={() => setNotice(`今日任务：播种 ${plots.filter(plot => plot.plantKey).length}/18，成熟 ${readyCount} 块`)}/>
        <FarmTopEntry label="好友" icon={<Users size={21}/>} active={panel === 'friends'} onClick={() => setPanel(panel === 'friends' ? null : 'friends')}/>
      </div>

      <div className="absolute left-2.5 top-[92px] w-[190px] sm:bottom-[78px] sm:left-1/2 sm:top-auto sm:w-[calc(100%-24px)] sm:max-w-xl sm:-translate-x-1/2">
        <AnimatePresence mode="wait"><motion.div key={notice} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mx-auto w-fit max-w-full rounded-2xl border-2 border-white/80 bg-[#24482e]/88 px-4 py-2 text-center text-[11px] font-semibold leading-5 text-white shadow-lg backdrop-blur sm:text-xs">{notice}</motion.div></AnimatePresence>
      </div>

      <div className="absolute bottom-2.5 left-1/2 flex max-w-[calc(100%-18px)] -translate-x-1/2 items-end gap-1 overflow-x-auto rounded-2xl border-[3px] border-[#f7e5b8] bg-[#704923]/94 p-1.5 shadow-[0_7px_0_rgba(62,40,20,.4)] backdrop-blur sm:bottom-3 sm:gap-1.5 sm:p-2">
        <FarmModeButton label="移动" active={tool === 'auto'} icon={<Move size={18}/>} onClick={() => { setTool('auto'); setNotice('智能模式：空地播种，成熟作物直接采收') }}/>
        <FarmModeButton label="种子包" active={panel === 'shop'} icon={<Backpack size={18}/>} badge={player.seeds.sunflower || 0} onClick={() => setPanel(panel === 'shop' ? null : 'shop')}/>
        <FarmModeButton label="除虫" active={false} icon={<Bug size={18}/>} onClick={() => setNotice('已经巡视全部土地，没有发现害虫')}/>
        <FarmModeButton label="浇水" active={tool === 'water'} icon={<Droplets size={18}/>} onClick={() => { setTool('water'); setNotice('浇水模式：点击成长中的作物加速 4 秒') }}/>
        <FarmModeButton label="铲除" active={false} icon={<Shovel size={18}/>} onClick={() => setNotice('铲除工具已收好，避免误删正在成长的作物')}/>
        <FarmModeButton label="收获" active={tool === 'harvest'} icon={<PackageOpen size={18}/>} onClick={() => { setTool('harvest'); setNotice('采收模式：点击成熟作物进行采收') }}/>
        <FarmModeButton label="全收" active={false} icon={<Warehouse size={18}/>} badge={readyCount} onClick={harvestAllReady}/>
      </div>

      <div className="absolute left-4 top-[118px] hidden w-40 rounded-2xl border-2 border-white/80 bg-[#fff7dc]/92 p-3 text-[#6c4b2a] shadow-lg backdrop-blur xl:block">
        <div className="flex items-center gap-2 text-xs font-black"><Sparkles size={15} className="text-amber-500"/>今日农场任务</div>
        <div className="mt-3 space-y-2 text-[10px]"><p className="flex justify-between"><span>播种土地</span><b>{plots.filter(item => item.plantKey).length}/18</b></p><p className="flex justify-between"><span>成熟作物</span><b>{readyCount}</b></p><p className="flex justify-between"><span>仓库收成</span><b>{player.inventory.sunflower || 0}</b></p></div>
      </div>

      <div className="absolute right-2.5 top-[92px] flex flex-col gap-2 sm:right-4 sm:top-[106px]">
        <FarmTool icon={<Sparkles size={20}/>} label="活动" active={false} onClick={() => setNotice('限时丰收活动：完成播种与采收可累计经验')}/>
        <FarmTool icon={<Users size={20}/>} label="好友" active={panel === 'friends'} onClick={() => setPanel(panel === 'friends' ? null : 'friends')}/>
      </div>

      <AnimatePresence>{panel && <FarmPanel panel={panel} onClose={() => setPanel(null)}>
        {panel === 'shop' && assets.manifest && <ShopPanel player={player} plant={assets.manifest.plants.sunflower} onBuy={() => buySeed('sunflower')}/>}
        {panel === 'warehouse' && assets.manifest && <WarehousePanel count={player.inventory.sunflower || 0} sellPrice={assets.manifest.plants.sunflower.sellPrice} onSell={() => sellProduce('sunflower')}/>}
        {panel === 'friends' && <FriendsPanel onVisit={name => { setNotice(`正在准备访问${name}的农场，好友互动功能已开启`); setPanel(null) }}/>}
      </FarmPanel>}</AnimatePresence>
    </section>

    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <InfoStrip icon={<Sprout size={19}/>} title="种子袋" value={`向日葵 × ${player.seeds.sunflower || 0}`} color="bg-emerald-50 text-emerald-700"/>
      <InfoStrip icon={<PackageOpen size={19}/>} title="今日收成" value={`向日葵 × ${player.inventory.sunflower || 0}`} color="bg-amber-50 text-amber-700"/>
      <InfoStrip icon={<Sparkles size={19}/>} title="18 块经典土地" value={readyCount ? `${readyCount} 块土地等待收获` : '一切生长正常'} color="bg-sky-50 text-sky-700"/>
    </div>
  </div>
}

function FarmModeButton({ label, icon, active, badge = 0, onClick }: { label: string; icon: React.ReactNode; active: boolean; badge?: number; onClick: () => void }) {
  return <motion.button whileHover={{ y: -4 }} whileTap={{ scale: .93 }} title={label} aria-label={label} onClick={onClick} className={`relative flex h-11 min-w-10 flex-col items-center justify-center rounded-xl border-2 px-1 text-[8px] font-black transition sm:h-14 sm:min-w-14 sm:px-1.5 sm:text-[9px] ${active ? 'border-[#fff4b5] bg-[#8fd35d] text-white shadow-[0_3px_0_#4e8c36]' : 'border-[#a97642] bg-[#fff5d5] text-[#714a27]'}`}>{icon}<span className="mt-0.5 whitespace-nowrap">{label}</span>{badge > 0 && <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] leading-4 text-white ring-2 ring-[#fff5d5]">{badge}</span>}</motion.button>
}

function FarmTopEntry({ label, icon, active = false, badge = 0, onClick }: { label: string; icon: React.ReactNode; active?: boolean; badge?: number; onClick: () => void }) {
  return <motion.button whileHover={{ y: 3 }} whileTap={{ scale: .93 }} title={label} aria-label={label} onClick={onClick} className={`relative flex w-12 flex-col items-center gap-0.5 text-[9px] font-black drop-shadow-md ${active ? 'text-[#fff099]' : 'text-white'}`}><span className={`grid size-10 place-items-center rounded-xl border-[3px] shadow-[0_4px_0_rgba(62,34,19,.5)] ${active ? 'border-[#fff2a3] bg-[#75b94e]' : 'border-[#ffe5a8] bg-[#765035] text-[#fff1be]'}`}>{icon}</span><span className="rounded-md bg-[#4b2e1f]/82 px-1.5 py-0.5">{label}</span>{badge > 0 && <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[8px] leading-4 text-white ring-2 ring-white">{badge}</span>}</motion.button>
}

function FarmTool({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <motion.button whileHover={{ x: -3 }} whileTap={{ scale: .94 }} title={label} aria-label={label} onClick={onClick} className={`flex w-11 flex-col items-center gap-0.5 text-[8px] font-black drop-shadow-md ${active ? 'text-[#fff099]' : 'text-white'}`}><span className={`grid size-10 place-items-center rounded-xl border-[3px] shadow-[0_4px_0_rgba(58,33,20,.45)] ${active ? 'border-[#fff2a3] bg-[#e4a03b]' : 'border-[#ffe7a8] bg-[#724831]/94 text-[#ffecaa]'}`}>{icon}</span><span className="rounded-md bg-[#4b2e1f]/82 px-1.5 py-0.5">{label}</span></motion.button>
}

function FarmPanel({ panel, onClose, children }: { panel: Exclude<Panel, null>; onClose: () => void; children: React.ReactNode }) {
  const titles = { shop: '种子商店', warehouse: '我的仓库', friends: '农场好友' }
  return <motion.aside initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }} className="absolute bottom-[80px] right-2.5 top-[92px] z-20 w-[min(330px,calc(100%-20px))] overflow-auto rounded-3xl border-[3px] border-white/90 bg-[#fffaf0]/97 p-4 shadow-2xl backdrop-blur sm:bottom-[88px] sm:right-4 sm:top-[106px] sm:p-5 lg:right-20">
    <div className="flex items-center justify-between"><h2 className="font-black text-[#563a22]">{titles[panel]}</h2><button onClick={onClose} aria-label="关闭" className="grid size-8 place-items-center rounded-xl bg-[#efe6d3] text-[#76583b]"><X size={16}/></button></div>
    <div className="mt-4">{children}</div>
  </motion.aside>
}

function ShopPanel({ player, plant, onBuy }: { player: FarmPlayerState; plant: { name: string; seedPrice: number }; onBuy: () => void }) {
  return <div><div className="flex items-center gap-3 rounded-2xl border-2 border-[#ead8b6] bg-white p-3"><img src="/assets/plants/sunflower/ready.svg" alt="向日葵" className="size-16"/><div className="min-w-0 flex-1"><b className="text-sm text-[#553922]">{plant.name}种子</b><p className="mt-1 text-[11px] text-[#987650]">成长快，适合新农场主</p><div className="mt-2 flex items-center gap-1 text-xs font-black text-amber-700"><Coins size={14}/>{plant.seedPrice}</div></div></div><button onClick={onBuy} disabled={player.coins < plant.seedPrice} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#73b84e] text-sm font-bold text-white shadow-[0_5px_0_#4f8b37] disabled:opacity-45"><ShoppingBasket size={17}/>购买 1 颗</button><p className="mt-4 text-center text-[11px] text-[#9c8060]">种子袋现有 {player.seeds.sunflower || 0} 颗</p></div>
}

function WarehousePanel({ count, sellPrice, onSell }: { count: number; sellPrice: number; onSell: () => void }) {
  return <div><div className="flex items-center gap-3 rounded-2xl border-2 border-[#ead8b6] bg-white p-3"><img src="/assets/plants/sunflower/harvest.svg" alt="向日葵收成" className="size-16"/><div className="flex-1"><b className="text-sm text-[#553922]">向日葵</b><p className="mt-1 text-xs text-[#987650]">库存 × {count}</p><p className="mt-2 text-xs font-black text-amber-700">售价 {sellPrice} 金币/朵</p></div></div><button onClick={onSell} disabled={!count} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#e5a83e] text-sm font-bold text-white shadow-[0_5px_0_#b47827] disabled:opacity-45"><Coins size={17}/>全部出售</button></div>
}

function FriendsPanel({ onVisit }: { onVisit: (name: string) => void }) {
  const friends = [['阿岚', 'Lv.8', '3 株成熟'], ['小满', 'Lv.5', '正在浇水'], ['设计师瑞瑞', 'Lv.3', '2 分钟前在线']]
  return <div className="space-y-2">{friends.map(([name, level, status], index) => <div key={name} className="flex items-center gap-3 rounded-2xl border border-[#eadfca] bg-white p-3"><span className={`grid size-10 place-items-center rounded-xl font-black text-white ${['bg-[#e78d63]', 'bg-[#65b8a7]', 'bg-[#7fa5d7]'][index]}`}>{name.charAt(0)}</span><div className="min-w-0 flex-1"><b className="text-xs text-[#543923]">{name}</b><p className="mt-0.5 text-[10px] text-[#a18464]">{level} · {status}</p></div><button onClick={() => onVisit(name)} className="rounded-xl bg-[#eaf4df] px-3 py-2 text-[11px] font-bold text-[#56863c]">访问</button></div>)}</div>
}

function InfoStrip({ icon, title, value, color }: { icon: React.ReactNode; title: string; value: string; color: string }) {
  return <motion.div whileHover={{ y: -2 }} className="flex items-center gap-3 rounded-2xl border border-white bg-white p-4 shadow-[0_12px_35px_rgba(54,84,72,.07)]"><span className={`grid size-10 place-items-center rounded-xl ${color}`}>{icon}</span><div><p className="text-[11px] text-slate-400">{title}</p><b className="mt-0.5 block text-sm text-slate-700">{value}</b></div></motion.div>
}
