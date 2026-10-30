import { ArrowRight, BarChart3, Check, Database, Layers3, ShieldCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { DataCenterButton } from '../components/DataCenterButton'
import { LoginPrompt } from '../components/DataCenterButton'
import { Navbar } from '../components/Navbar'
import { hasDataCenterSession, navigateTo } from '../utils/auth'

const quickLinks = [
  ['品牌总览', '02', Layers3],
  ['数据中心', 'LIVE', BarChart3],
  ['工作计划', '08', Database],
  ['安全访问', 'ON', ShieldCheck],
] as const

export function Home() {
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  useEffect(() => {
    document.documentElement.classList.add('immersive-home')
    return () => document.documentElement.classList.remove('immersive-home')
  }, [])

  const enterDataCenter = async () => {
    if (await hasDataCenterSession()) navigateTo('/dashboard')
    else setShowLoginPrompt(true)
  }

  return <div id="top" className="relative min-h-screen overflow-x-hidden bg-[#f6f8f4] text-[#1d1f1d] selection:bg-[#dff2d6] selection:text-[#29492b]">
    <Navbar/>
    <main className="pt-14 sm:pt-16">
      <section className="relative isolate min-h-[620px] overflow-hidden bg-[#637064] sm:min-h-[700px]">
        <img src="/assets/project-home.jpg" alt="品牌内容项目现场" className="absolute inset-0 size-full object-cover object-center"/>
        <div className="absolute inset-0 bg-black/35"/>
        <div className="relative z-10 mx-auto flex min-h-[620px] max-w-[1280px] items-end px-5 pb-14 sm:min-h-[700px] sm:px-10 sm:pb-20 lg:px-16">
          <div className="w-full min-w-0 max-w-xl text-white">
            <p className="flex items-center gap-2 text-xs font-medium text-white/75"><span className="size-1.5 rounded-full bg-[#b7e68e]"/> BRANDFLOW OS · 品牌经营工作空间</p>
            <h1 className="mt-5 text-5xl font-semibold leading-[1.04] tracking-[-.04em] sm:text-7xl">让品牌经营<br/>更清晰。</h1>
            <p className="mt-5 w-full max-w-[19rem] whitespace-normal break-all text-sm leading-7 text-white/78 sm:max-w-md sm:break-words sm:text-base">内容、项目与增长数据，在一个安静、可靠的空间里协同工作。</p>
            <div className="mt-8 flex flex-wrap items-center gap-4"><DataCenterButton/><a href="#overview" className="hidden h-13 items-center gap-2 px-1 text-sm font-medium text-white/85 transition hover:text-white sm:inline-flex">了解工作空间 <ArrowRight size={16}/></a></div>
          </div>
        </div>
      </section>

      <nav id="overview" className="border-b border-black/[.07] bg-white" aria-label="首页快捷导航">
        <div className="mx-auto grid max-w-[1280px] grid-cols-2 sm:grid-cols-4">
          {quickLinks.map(([label, value, Icon]) => label === '数据中心' ? <button type="button" key={label} onClick={enterDataCenter} className="group flex min-h-[84px] items-center gap-3 border-b border-black/[.06] px-5 text-left transition hover:bg-[#f1f8ec] sm:min-h-[98px] sm:border-b-0 sm:border-r sm:px-7 lg:px-10">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef7e9] text-[#6ca84f] transition group-hover:bg-[#dff2d6]"><Icon size={16}/></span><span className="min-w-0 flex-1"><span className="block text-[11px] text-black/45">{label}</span><b className="mt-1 block text-sm font-semibold">{value}</b></span><ArrowRight size={14} className="text-black/25 transition group-hover:translate-x-1 group-hover:text-[#4f8248]"/>
          </button> : <a key={label} href="#workspace" className="group flex min-h-[84px] items-center gap-3 border-b border-black/[.06] px-5 transition hover:bg-[#f1f8ec] sm:min-h-[98px] sm:border-b-0 sm:border-r sm:px-7 sm:last:border-r-0 lg:px-10">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#eef7e9] text-[#6ca84f] transition group-hover:bg-[#dff2d6]"><Icon size={16}/></span><span className="min-w-0 flex-1"><span className="block text-[11px] text-black/45">{label}</span><b className="mt-1 block text-sm font-semibold">{value}</b></span><ArrowRight size={14} className="text-black/25 transition group-hover:translate-x-1 group-hover:text-[#4f8248]"/>
          </a>)}
        </div>
      </nav>

      <section className="relative isolate min-h-[560px] overflow-hidden bg-[#3d4b3b] sm:min-h-[680px]">
        <img src="/assets/finished-home.jpg" alt="品牌内容与生活空间项目" className="absolute inset-0 size-full object-cover object-center"/>
        <div className="absolute inset-0 bg-black/30"/>
        <div className="relative z-10 mx-auto flex min-h-[560px] max-w-[1280px] items-end px-5 pb-14 sm:min-h-[680px] sm:px-10 sm:pb-20 lg:px-16">
          <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }} transition={{ duration: .65 }} className="max-w-lg text-white">
            <p className="text-xs font-medium tracking-[.14em] text-white/70">PROJECTS · 01</p><h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-.035em] sm:text-6xl">把每个项目，<br/>变成品牌资产。</h2><p className="mt-5 max-w-md text-sm leading-7 text-white/75 sm:text-base">从现场素材到交付节点，所有内容都在同一条工作线上持续积累。</p><a href="#workspace" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-white transition hover:gap-3">查看工作空间 <ArrowRight size={16}/></a>
          </motion.div>
        </div>
      </section>

      <section className="relative isolate min-h-[560px] overflow-hidden bg-[#dfe9da] sm:min-h-[680px]">
        <img src="/assets/site-monitor.jpg" alt="施工现场内容记录" className="absolute inset-0 size-full object-cover object-center"/>
        <div className="absolute inset-0 bg-black/35"/>
        <div className="relative z-10 mx-auto flex min-h-[560px] max-w-[1280px] items-start px-5 pt-16 sm:min-h-[680px] sm:px-10 sm:pt-24 lg:px-16">
          <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }} transition={{ duration: .65 }} className="max-w-lg text-white">
            <p className="text-xs font-medium tracking-[.14em] text-white/70">CONTENT · 02</p><h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-.035em] sm:text-6xl">现场发生的每一刻，<br/>都值得被看见。</h2><p className="mt-5 max-w-md text-sm leading-7 text-white/75 sm:text-base">记录、整理、发布、复盘，让内容不再散落在不同工具里。</p><a href="#overview" className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-white transition hover:gap-3">查看内容表现 <ArrowRight size={16}/></a>
          </motion.div>
        </div>
      </section>

      <section className="bg-[#e8f3e2] px-5 py-20 sm:px-10 sm:py-28 lg:px-16"><div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[.72fr_1.28fr] lg:items-center lg:gap-20"><div><p className="text-xs font-semibold tracking-[.12em] text-[#4f8248]">INSIGHTS · 03</p><h2 className="mt-4 text-3xl font-semibold leading-tight tracking-[-.035em] sm:text-5xl">经营数据，<br/>也可以很有画面。</h2><p className="mt-5 max-w-md text-sm leading-7 text-black/50 sm:text-base">用一眼能看懂的方式，把品牌表现、内容节奏和项目进度放在一起。</p></div><div className="rounded-[26px] border border-[#cfe2c8] bg-white p-5 shadow-[0_18px_60px_rgba(80,110,70,.08)] sm:p-8"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold">本月品牌增长</p><p className="mt-1 text-[10px] text-black/40">创艺装饰 · 喜客喜装饰</p></div><span className="rounded-full bg-[#e7f4df] px-3 py-1 text-[10px] font-semibold text-[#4f8248]">+18.6%</span></div><div className="mt-8 grid h-44 grid-cols-12 items-end gap-2 sm:h-56 sm:gap-3">{[34,48,42,66,58,72,64,86,78,92,82,100].map((height, index) => <motion.span key={index} initial={{ height: 0 }} whileInView={{ height: `${height}%` }} viewport={{ once: true }} transition={{ duration: .55, delay: index * .035 }} className={`rounded-t-lg ${index > 8 ? 'bg-[#8dcc65]' : 'bg-[#dff2d6]'}`}/>)}</div><div className="mt-5 flex items-center justify-between border-t border-black/[.07] pt-4 text-[10px] text-black/40"><span>1月</span><span>2月</span><span>3月</span><span>4月</span><span>5月</span><span>6月</span></div></div></div></section>

      <section id="workspace" className="bg-[#f6f8f4] px-5 py-20 sm:px-10 sm:py-28 lg:px-16">
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-semibold tracking-[.12em] text-[#4f8248]">BRANDFLOW WORKSPACE</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.035em] sm:text-5xl">一个空间，掌握每一个增长信号。</h2><p className="mt-5 text-sm leading-7 text-black/50 sm:text-base">把每天的内容、项目和经营数据放在同一条清晰的工作线上。</p></div>
          <div className="mt-12 overflow-hidden rounded-[26px] border border-[#dce8d9] bg-white shadow-[0_18px_60px_rgba(80,110,70,.09)] sm:mt-16 sm:rounded-[32px]">
            <div className="flex h-14 items-center justify-between border-b border-black/[.06] px-5 sm:px-8"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[#8dcc65] text-white"><Layers3 size={14}/></span><span className="text-xs font-semibold">品牌经营总览</span></div><span className="flex items-center gap-2 text-[10px] text-black/40"><span className="size-1.5 rounded-full bg-[#8dcc65]"/> 数据已同步</span></div>
            <div className="grid grid-cols-2 divide-x divide-y divide-black/[.06] sm:grid-cols-4 sm:divide-y-0">
              {[['总播放量', '128.6万', '+18.6%'], ['内容发布', '36', '本月'], ['粉丝增长', '2,408', '+12.4%'], ['进行中项目', '08', '按计划']].map(([label, value, note]) => <div key={label} className="p-5 sm:p-7"><p className="text-[11px] text-black/45">{label}</p><b className="mt-3 block text-2xl font-semibold tracking-[-.03em] sm:text-3xl">{value}</b><span className={`mt-2 block text-[10px] ${note.startsWith('+') ? 'text-[#4f8248]' : 'text-black/38'}`}>{note}</span></div>)}
            </div>
            <div className="grid gap-8 border-t border-black/[.06] p-5 sm:p-8 lg:grid-cols-[1.35fr_.65fr] lg:gap-12">
              <div><div className="flex items-start justify-between"><div><h3 className="text-sm font-semibold">内容增长趋势</h3><p className="mt-1 text-[10px] text-black/40">近 7 日 · 双品牌汇总</p></div><BarChart3 size={18} className="text-[#8dcc65]"/></div><div className="relative mt-7 h-[150px]"><div className="absolute inset-0 flex flex-col justify-between">{[0,1,2,3].map(line => <span key={line} className="border-t border-dashed border-black/[.08]"/>)}</div><svg viewBox="0 0 620 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" role="img" aria-label="内容增长趋势"><defs><linearGradient id="growth-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8dcc65" stopOpacity=".28"/><stop offset="100%" stopColor="#8dcc65" stopOpacity="0"/></linearGradient></defs><path d="M0 119 C38 112 48 94 89 101 S145 112 177 86 S232 78 266 91 S317 99 355 60 S416 79 445 58 S504 66 529 39 S581 50 620 13 L620 150 L0 150 Z" fill="url(#growth-fill)"/><path d="M0 119 C38 112 48 94 89 101 S145 112 177 86 S232 78 266 91 S317 99 355 60 S416 79 445 58 S504 66 529 39 S581 50 620 13" fill="none" stroke="#8dcc65" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round"/><circle cx="529" cy="39" r="5" fill="white" stroke="#8dcc65" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg></div><div className="mt-3 flex justify-between text-[9px] text-black/35"><span>周一</span><span>周二</span><span>周三</span><span>周四</span><span>周五</span><span>周六</span><span>周日</span></div></div>
              <div className="border-t border-black/[.06] pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0"><h3 className="text-sm font-semibold">工作状态</h3><div className="mt-5 space-y-4">{[['创艺装饰', '内容稳定增长'], ['喜客喜装饰', '本周目标已完成'], ['数据同步', '刚刚更新']].map(([name, status]) => <div key={name} className="flex items-center gap-3"><span className="grid size-7 place-items-center rounded-full bg-[#e7f4df] text-[#5f9b46]"><Check size={13}/></span><div><p className="text-xs font-medium">{name}</p><p className="mt-1 text-[10px] text-black/42">{status}</p></div></div>)}</div><button type="button" onClick={enterDataCenter} className="mt-7 inline-flex items-center gap-2 text-xs font-medium text-[#4f8248]">进入数据中心 <ArrowRight size={14}/></button></div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20 sm:px-10 sm:py-28 lg:px-16"><div className="mx-auto grid max-w-[1280px] gap-5 sm:grid-cols-2"><article className="group relative min-h-[390px] overflow-hidden rounded-[22px] bg-[#d7e5d2] sm:min-h-[500px]"><img src="/assets/site-monitor.jpg" alt="品牌项目现场" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]"/><div className="absolute inset-0 bg-black/25"/><div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8"><p className="text-[10px] tracking-[.14em] text-white/65">PROJECTS · 01</p><h3 className="mt-3 text-2xl font-semibold">项目与品牌内容</h3><p className="mt-2 text-sm text-white/75">作品、素材和交付进度，集中管理。</p></div></article><article className="group relative min-h-[390px] overflow-hidden rounded-[22px] bg-[#e5efe1] sm:min-h-[500px]"><img src="/assets/content-video.jpg" alt="品牌内容制作" className="absolute inset-0 size-full object-cover transition duration-700 group-hover:scale-[1.04]"/><div className="absolute inset-0 bg-black/25"/><div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8"><p className="text-[10px] tracking-[.14em] text-white/65">CONTENT · 02</p><h3 className="mt-3 text-2xl font-semibold">内容与经营表现</h3><p className="mt-2 text-sm text-white/75">用清晰指标，持续看见内容增长。</p></div></article></div></section>

      <section className="border-y border-black/[.06] bg-white px-5 py-20 sm:px-10 sm:py-28 lg:px-16"><div className="mx-auto max-w-[1280px]"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold tracking-[.12em] text-[#4f8248]">TWO BRANDS · ONE WORKFLOW</p><h2 className="mt-4 text-3xl font-semibold tracking-[-.035em] sm:text-5xl">两条品牌线，<br/>一套清晰节奏。</h2></div><p className="max-w-sm text-sm leading-7 text-black/50">分别记录每个品牌的内容表现，同时保留一份完整的经营全景。</p></div><div className="mt-12 grid gap-px overflow-hidden rounded-[24px] border border-[#dce8d9] bg-[#dce8d9] sm:grid-cols-2"><div className="bg-[#f7fbf5] p-7 sm:p-10"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-full bg-[#dff2d6] text-[#4f8248]"><Layers3 size={18}/></span><span className="text-[10px] text-black/35">BRAND A</span></div><h3 className="mt-10 text-2xl font-semibold">创艺装饰</h3><p className="mt-3 text-sm leading-6 text-black/50">内容、项目与客户沟通，按计划持续推进。</p><div className="mt-8 flex items-end justify-between border-t border-black/[.07] pt-5"><span className="text-[11px] text-black/45">本月内容表现</span><b className="text-2xl font-semibold text-[#4f8248]">+18.6%</b></div></div><div className="bg-white p-7 sm:p-10"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-full bg-[#dff2d6] text-[#4f8248]"><BarChart3 size={18}/></span><span className="text-[10px] text-black/35">BRAND B</span></div><h3 className="mt-10 text-2xl font-semibold">喜客喜装饰</h3><p className="mt-3 text-sm leading-6 text-black/50">用可见的数据，复盘每一次内容动作。</p><div className="mt-8 flex items-end justify-between border-t border-black/[.07] pt-5"><span className="text-[11px] text-black/45">本月目标完成</span><b className="text-2xl font-semibold text-[#4f8248]">92%</b></div></div></div></div></section>

      <section id="space" className="bg-[#e8f3e2] px-5 py-16 sm:px-10 sm:py-20 lg:px-16"><div className="mx-auto flex max-w-[1280px] flex-col gap-8 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold text-[#4f8248]">BRANDFLOW OS · WORKSPACE</p><h2 className="mt-3 text-2xl font-semibold tracking-[-.025em] sm:text-4xl">让每一项经营工作，都有清晰坐标。</h2><p className="mt-3 text-sm leading-6 text-black/50">登录后继续查看品牌数据、项目进度与内容表现。</p></div><DataCenterButton/></div></section>

      <footer className="bg-[#f6f8f4]"><div className="mx-auto flex max-w-[1280px] flex-col gap-5 px-5 py-8 text-[10px] text-black/45 sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16"><span>BrandFlow OS · 品牌经营工作空间</span><span className="flex items-center gap-2"><ShieldCheck size={13}/> 账号与经营数据由访问权限保护</span><a href="#top" className="w-fit transition hover:text-[#4f8248]">返回顶部 ↑</a></div></footer>
    </main>
    {showLoginPrompt && <LoginPrompt close={() => setShowLoginPrompt(false)}/>}
  </div>
}
