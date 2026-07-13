import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Variants } from 'framer-motion'
import type { Session } from '@supabase/supabase-js'
import {
  Activity, ArrowLeftRight, ArrowUpRight, Bell, CalendarDays, CheckCircle2, Copy,
  ChevronDown, CircleDashed, Crown, Database, Download, FileChartColumn, FileText,
  Droplets, Flower2, FolderKanban, HardDrive, House, Images, LayoutDashboard,
  KeyRound, Lightbulb, LogOut, Menu, MoreHorizontal, Play, Plus, Search, Settings, Share2,
  ShieldCheck, Sparkles, Sprout, Sun, Trash2, TrendingUp, Trophy, Upload, UserCog, Users,
  WandSparkles, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import {
  assetsDb, bootstrapBrandFlow, contentsDb, createBrandFlowInvite, deleteMetric,
  getBrandFlowAccessRole, ideasDb, isBrandFlowAuthorized, listBrandFlowInvites, listBrandFlowUsers,
  loadCoreData, loadGarden, plansDb, projectsDb, revokeBrandFlowInvite,
  saveGarden, saveMetric, saveProfile, setBrandFlowUserRole, uploadAsset, type AccessRole,
  type AdminUserRow, type InviteRow,
} from './lib/brandflow-db'

type BrandId = 'brandA' | 'brandB'
type PageId = 'dashboard' | 'plan' | 'projects' | 'content' | 'data' | 'assets' | 'ideas' | 'garden' | 'ai' | 'admin' | 'settings'
type BrandConfig = Record<BrandId, string>
type MetricEntry = { id: string; date: string; brand: BrandId; views: number; shares: number; followers: number }
type UserProfile = { displayName: string; jobTitle: string; avatarUrl: string | null }

const defaultBrands: BrandConfig = { brandA: '创艺装饰', brandB: '喜客喜装饰' }
const defaultEntries: MetricEntry[] = [
  ['a01','2026-07-01','brandA',26800,186,72],['b01','2026-07-01','brandB',18200,112,46],
  ['a03','2026-07-03','brandA',42600,318,108],['b03','2026-07-03','brandB',31000,204,81],
  ['a05','2026-07-05','brandA',35200,246,93],['b05','2026-07-05','brandB',38600,260,95],
  ['a07','2026-07-07','brandA',68400,472,156],['b07','2026-07-07','brandB',44800,301,114],
  ['a09','2026-07-09','brandA',55600,394,132],['b09','2026-07-09','brandB',52300,366,127],
  ['a11','2026-07-11','brandA',83200,618,209],['b11','2026-07-11','brandB',61700,432,168],
].map(([id,date,brand,views,shares,followers]) => ({ id, date, brand, views, shares, followers } as MetricEntry))

const navItems = [
  ['dashboard','首页',House],['plan','工作计划',CalendarDays],['projects','项目中心',FolderKanban],
  ['content','内容中心',FileText],['data','数据中心',Database],['assets','素材中心',Images],
  ['ideas','灵感中心',Lightbulb],['garden','我的花园',Flower2],['ai','AI中心',Sparkles],
  ['admin','管理员设置',UserCog],['settings','设置',Settings],
] as const

const assets = [
  ['/assets/project-home.jpg','嗨，我的新家','品牌视频'],['/assets/site-safety.jpg','隐蔽工程标准','工地内容'],
  ['/assets/content-video.jpg','装修不是选择题','短视频'],['/assets/content-team.jpg','设计师人物栏目','人物内容'],
]

const pageMotion: Variants = { hidden:{opacity:0,y:12}, show:{opacity:1,y:0,transition:{duration:.36,ease:[.22,1,.36,1]}} }
const gridMotion: Variants = { hidden:{opacity:0}, show:{opacity:1,transition:{staggerChildren:.055}} }
const cardMotion: Variants = { hidden:{opacity:0,y:14,scale:.985}, show:{opacity:1,y:0,scale:1,transition:{type:'spring',stiffness:180,damping:22}} }
const cardClass = 'rounded-3xl border border-white/90 bg-white shadow-[0_18px_55px_rgba(54,84,72,0.08)]'

function fmt(value:number){ return value.toLocaleString('zh-CN') }
function stored<T>(key:string,fallback:T):T{try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
function dateKey(date:Date){
  const pad=(value:number)=>String(value).padStart(2,'0')
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`
}

function Card({ children, className='', onClick, ariaLabel }: { children:React.ReactNode; className?:string; onClick?:()=>void; ariaLabel?:string }) {
  return <motion.section variants={cardMotion} whileHover={{y:-3,transition:{duration:.2}}} onClick={onClick} role={onClick?'button':undefined} tabIndex={onClick?0:undefined} aria-label={ariaLabel} onKeyDown={onClick?(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onClick()}}:undefined} className={`${cardClass} ${onClick?'cursor-pointer outline-none transition focus-visible:ring-4 focus-visible:ring-emerald-100':''} ${className}`}>{children}</motion.section>
}

function Status({ value }: { value:string }) {
  const style = value==='Success'?'bg-emerald-50 text-emerald-700 ring-emerald-100':value==='Failed'?'bg-rose-50 text-rose-600 ring-rose-100':'bg-amber-50 text-amber-700 ring-amber-100'
  return <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${style}`}>{value}</span>
}

function ChartTooltip({ active,payload,label }: any){
  if(!active||!payload?.length)return null
  return <div className="rounded-2xl border border-emerald-100 bg-white/95 p-3 shadow-xl backdrop-blur"><p className="mb-2 text-xs font-semibold text-slate-500">{label}</p>{payload.map((p:any)=><div key={p.dataKey} className="flex items-center justify-between gap-6 text-xs"><span style={{color:p.color}}>{p.name}</span><b className="text-slate-900">{fmt(p.value)}</b></div>)}</div>
}

function LoadingScreen({label}:{label:string}){
  return <div className="grid min-h-screen place-items-center bg-[#f2f6f2]"><div className="text-center"><motion.div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#9ad66f] text-xl font-black text-white shadow-lg shadow-lime-200" animate={{y:[0,-7,0]}} transition={{duration:1.2,repeat:Infinity}}>B</motion.div><p className="mt-5 text-sm text-slate-500">{label}</p></div></div>
}

function AuthScreen(){
  const [mode,setMode]=useState<'signin'|'signup'>('signin')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [inviteCode,setInviteCode]=useState('')
  const [loading,setLoading]=useState(false)
  const [message,setMessage]=useState('')
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();if(!supabase)return
    setLoading(true);setMessage('')
    const result=mode==='signin'
      ?await supabase.auth.signInWithPassword({email,password})
      :await supabase.auth.signUp({email,password,options:{data:{brandflow_invite_code:inviteCode}}})
    setLoading(false)
    if(result.error){setMessage(result.error.message.includes('Database error')?'邀请码无效、已过期或已被使用。':result.error.message);return}
    if(mode==='signup'&&!result.data.session)setMessage('注册成功，请前往邮箱确认后再登录。')
  }
  return <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#eaf2e7] p-4"><img src="/assets/project-home.jpg" alt="创艺装饰空间" className="absolute inset-0 h-full w-full object-cover opacity-25"/><div className="absolute inset-0 bg-white/60 backdrop-blur-sm"/><motion.main initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} className="relative w-full max-w-md rounded-3xl border border-white bg-white/95 p-6 shadow-[0_30px_90px_rgba(42,70,52,0.18)] sm:p-8"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-[#9ad66f] text-lg font-black text-white shadow-lg shadow-lime-200">B</span><div><h1 className="text-xl font-semibold">BrandFlow OS</h1><p className="mt-1 text-xs text-slate-400">品牌数据中心</p></div></div><div className="mt-8 flex rounded-2xl bg-[#f3f7f1] p-1">{([['signin','登录'],['signup','注册']] as const).map(([id,label])=><button type="button" key={id} onClick={()=>{setMode(id);setMessage('')}} className={`h-10 flex-1 rounded-xl text-sm font-semibold transition ${mode===id?'bg-white text-[#4f8248] shadow-sm':'text-slate-400'}`}>{label}</button>)}</div><form onSubmit={submit} className="mt-6 space-y-4"><Field label="邮箱"><input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></Field><Field label="密码"><input type="password" required minLength={6} autoComplete={mode==='signin'?'current-password':'new-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="至少 6 位密码"/></Field>{mode==='signup'&&<Field label="六位邀请码"><div className="relative rounded-2xl bg-[#f3f7f1] p-2 transition focus-within:bg-[#edf6e9] focus-within:ring-4 focus-within:ring-emerald-50"><input aria-label="六位邀请码" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={inviteCode} onChange={e=>setInviteCode(e.target.value.replace(/\D/g,'').slice(0,6))} className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"/><div aria-hidden="true" className="grid grid-cols-6 gap-2">{Array.from({length:6},(_,index)=><span key={index} className={`grid h-11 min-w-0 place-items-center rounded-xl border bg-white text-lg font-semibold transition ${inviteCode[index]?'border-[#9dcc87] text-[#3f7341] shadow-sm':'border-white text-slate-300'}`}>{inviteCode[index]||'·'}</span>)}</div></div><p className="mt-2 text-[11px] text-slate-400">首次安装可留空，其他用户需填写超级管理员提供的邀请码</p></Field>}{message&&<p className={`rounded-2xl px-4 py-3 text-xs leading-5 ${message.includes('成功')?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-600'}`}>{message}</p>}<SubmitButton label={loading?'请稍候...':mode==='signin'?'登录数据中心':'使用邀请码注册'}/></form></motion.main></div>
}

function AccessDenied(){
  return <div className="grid min-h-screen place-items-center bg-[#f2f6f2] p-4"><motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} className={`${cardClass} w-full max-w-md p-8 text-center`}><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600"><KeyRound size={24}/></span><h1 className="mt-5 text-xl font-semibold">账号尚未获得访问授权</h1><p className="mt-2 text-sm leading-6 text-slate-500">该账号不是通过有效邀请码注册的，无法进入 BrandFlow 数据中心。</p><button onClick={()=>supabase?.auth.signOut()} className="mt-6 h-11 rounded-2xl bg-[#8dcc65] px-6 text-sm font-semibold text-white">退出并更换账号</button></motion.div></div>
}

function App(){
  const [page,setPage]=useState<PageId>('dashboard')
  const [menuOpen,setMenuOpen]=useState(false)
  const [search,setSearch]=useState('')
  const [session,setSession]=useState<Session|null>(null)
  const [authLoading,setAuthLoading]=useState(isSupabaseConfigured)
  const [accessState,setAccessState]=useState<'checking'|'granted'|'denied'>(isSupabaseConfigured?'checking':'granted')
  const [accessRole,setAccessRole]=useState<AccessRole>(isSupabaseConfigured?'member':'super_admin')
  const [dataLoading,setDataLoading]=useState(false)
  const [cloudError,setCloudError]=useState('')
  const [entries,setEntries]=useState<MetricEntry[]>(()=>{try{return JSON.parse(localStorage.getItem('brandflow-metrics')||'null')||defaultEntries}catch{return defaultEntries}})
  const [brands,setBrands]=useState<BrandConfig>(()=>{try{const saved=JSON.parse(localStorage.getItem('brandflow-brands')||'null');return {...defaultBrands,...saved,brandB:!saved?.brandB||saved.brandB==='品牌二'?'喜客喜装饰':saved.brandB}}catch{return defaultBrands}})
  const [profile,setProfile]=useState<UserProfile>(()=>stored('brandflow-profile',{displayName:'BrandFlow 用户',jobTitle:'品牌内容负责人',avatarUrl:null}))
  useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem('brandflow-metrics',JSON.stringify(entries))},[entries])
  useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem('brandflow-brands',JSON.stringify(brands))},[brands])
  useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem('brandflow-profile',JSON.stringify(profile))},[profile])

  useEffect(()=>{
    if(!supabase){setAuthLoading(false);return}
    supabase.auth.getSession().then(({data})=>{setSession(data.session);setAccessState(data.session?'checking':'denied');setAuthLoading(false)})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{setSession(nextSession);setAccessState(nextSession?'checking':'denied');setAuthLoading(false)})
    return ()=>subscription.unsubscribe()
  },[])

  useEffect(()=>{
    if(!session||!supabase)return
    let active=true
    setDataLoading(true);setCloudError('')
    ;(async()=>{
      try{
        setAccessState('checking')
        if(!await isBrandFlowAuthorized()){if(active)setAccessState('denied');return}
        const role=await getBrandFlowAccessRole()
        if(active){setAccessRole(role);setAccessState('granted')}
        await bootstrapBrandFlow()
        const core=await loadCoreData()
        if(!active)return
        const brandById=new Map(core.brands.map(brand=>[brand.id,brand.code]))
        setBrands(core.brands.reduce((result,brand)=>({...result,[brand.code]:brand.name}),defaultBrands))
        setEntries(core.metrics.map(metric=>({id:String(metric.id),date:metric.metric_date,brand:brandById.get(metric.brand_id)||'brandA',views:Number(metric.views),shares:Number(metric.shares),followers:Number(metric.follower_growth)})))
        const emailName=session.user.email?.split('@')[0]||'BrandFlow 用户'
        setProfile({displayName:core.profile?.display_name||emailName,jobTitle:core.profile?.role||'品牌内容负责人',avatarUrl:core.profile?.avatar_url||null})
      }catch(error){if(active){setAccessState('denied');setCloudError(error instanceof Error?error.message:'云端数据加载失败')}}
      finally{if(active)setDataLoading(false)}
    })()
    return ()=>{active=false}
  },[session])

  const addMetricEntry=async(input:{date:string;brand:BrandId;views:number;shares:number})=>{
    if(!isSupabaseConfigured){setEntries(current=>[...current,{id:`metric-${Date.now()}`,...input,followers:0}]);return}
    const row=await saveMetric({brandCode:input.brand,date:input.date,views:input.views,shares:input.shares})
    setEntries(current=>[...current.filter(entry=>entry.id!==String(row.id)&&!(entry.date===input.date&&entry.brand===input.brand)),{id:String(row.id),date:row.metric_date,brand:input.brand,views:Number(row.views),shares:Number(row.shares),followers:Number(row.follower_growth)}])
  }
  const removeMetricEntry=async(id:string)=>{
    if(isSupabaseConfigured)await deleteMetric(Number(id))
    setEntries(current=>current.filter(entry=>entry.id!==id))
  }
  const savePersonalProfile=async(displayName:string)=>{
    const cleanName=displayName.trim()
    if(!cleanName)throw new Error('昵称不能为空。')
    if(isSupabaseConfigured){
      const row=await saveProfile(cleanName)
      setProfile({displayName:row.display_name,jobTitle:row.role,avatarUrl:row.avatar_url})
      return
    }
    setProfile(current=>({...current,displayName:cleanName}))
  }

  const chartData=useMemo(()=>Array.from(new Set(entries.map(e=>e.date))).sort().map(date=>{
    const a=entries.find(e=>e.date===date&&e.brand==='brandA'),b=entries.find(e=>e.date===date&&e.brand==='brandB')
    return {date:`${Number(date.slice(8))}日`,aViews:a?.views||0,bViews:b?.views||0,aShares:a?.shares||0,bShares:b?.shares||0,followers:(a?.followers||0)+(b?.followers||0)}
  }),[entries])
  const totals=useMemo(()=>entries.reduce((r,e)=>({views:r.views+e.views,shares:r.shares+e.shares,followers:r.followers+e.followers}),{views:0,shares:0,followers:0}),[entries])
  const pageProps={entries,setEntries,brands,setBrands,chartData,totals,onAddMetric:addMetricEntry,onDeleteMetric:removeMetricEntry}

  if(authLoading)return <LoadingScreen label="正在连接品牌数据中心..."/>
  if(isSupabaseConfigured&&!session)return <AuthScreen/>
  if(isSupabaseConfigured&&accessState==='checking')return <LoadingScreen label="正在验证访问权限..."/>
  if(isSupabaseConfigured&&accessState==='denied')return <AccessDenied/>

  return <div className="min-h-screen bg-[#f2f6f2] text-slate-950 antialiased">
    <Sidebar page={page} setPage={setPage} open={menuOpen} setOpen={setMenuOpen}/>
    {menuOpen&&<motion.button initial={{opacity:0}} animate={{opacity:1}} onClick={()=>setMenuOpen(false)} className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm lg:hidden" aria-label="关闭导航"/>}
    <div className="min-h-screen lg:pl-[268px]">
      <Header search={search} setSearch={setSearch} openMenu={()=>setMenuOpen(true)} cloud={isSupabaseConfigured} profile={profile} accessRole={accessRole} onOpenSettings={()=>setPage('settings')} onSignOut={()=>supabase?.auth.signOut()}/>
      <main className="mx-auto max-w-[1680px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {cloudError&&<div className="mb-4 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-600">{cloudError}</div>}
        {dataLoading&&<div className="mb-4 h-1 overflow-hidden rounded-full bg-emerald-100"><motion.div className="h-full w-1/3 rounded-full bg-[#8dcc65]" animate={{x:['-100%','300%']}} transition={{duration:1.2,repeat:Infinity,ease:'easeInOut'}}/></div>}
        <AnimatePresence mode="wait">
          <motion.div key={page} variants={pageMotion} initial="hidden" animate="show" exit={{opacity:0,y:-8,transition:{duration:.18}}}>
            {page==='dashboard'&&<Dashboard {...pageProps}/>} {page==='plan'&&<WorkPlan/>} {page==='projects'&&<ProjectCenter/>} {page==='content'&&<ContentCenter/>} {page==='data'&&<DataCenter {...pageProps}/>} {page==='assets'&&<Assets/>} {page==='ideas'&&<IdeasCenter/>} {page==='garden'&&<Garden/>} {page==='ai'&&<AiPage/>} {page==='admin'&&<AdminSettingsPage accessRole={accessRole}/>} {page==='settings'&&<SettingsPage profile={profile} onSaveProfile={savePersonalProfile} accessRole={accessRole}/>}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  </div>
}

function Sidebar({page,setPage,open,setOpen}:{page:PageId;setPage:(p:PageId)=>void;open:boolean;setOpen:(v:boolean)=>void}){
  return <motion.aside initial={false} animate={{x:open?0:undefined}} className={`fixed inset-y-3 left-3 z-40 flex w-[244px] flex-col rounded-[28px] border border-white bg-white/95 p-4 shadow-[0_24px_70px_rgba(54,84,72,0.12)] backdrop-blur-xl transition-transform lg:translate-x-0 ${open?'translate-x-0':'-translate-x-[110%]'}`}>
    <div className="flex h-14 items-center gap-3 px-2"><div className="grid size-10 place-items-center rounded-2xl bg-[#9ad66f] font-black text-white shadow-lg shadow-lime-200">B</div><div><strong className="block text-[17px] tracking-tight">BrandFlow</strong><span className="text-[10px] font-medium text-slate-400">PERSONAL DATA OS</span></div><button aria-label="关闭导航" onClick={()=>setOpen(false)} className="ml-auto grid size-9 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 lg:hidden"><X size={18}/></button></div>
    <div className="my-5 rounded-2xl bg-[#f3f7f2] p-3"><p className="text-xs font-semibold text-slate-700">贵州创艺装饰</p><p className="mt-1 text-[10px] text-slate-400">个人品牌工作空间</p></div>
    <nav className="space-y-1.5">{navItems.map(([id,label,Icon])=><motion.button whileHover={{x:3}} whileTap={{scale:.98}} key={id} onClick={()=>{setPage(id);setOpen(false)}} className={`flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm font-medium transition ${page===id?'bg-[#dff2d6] text-[#2d6b35] shadow-sm':'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}><Icon size={18}/><span>{label}</span>{page===id&&<motion.i layoutId="nav-dot" className="ml-auto size-1.5 rounded-full bg-[#67bb43]"/>}</motion.button>)}</nav>
    <div className="mt-auto rounded-3xl bg-[#eef5eb] p-4"><div className="flex items-center gap-2 text-sm font-semibold"><HardDrive size={16} className="text-[#67a756]"/>存储空间</div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white"><motion.div initial={{width:0}} animate={{width:'68%'}} transition={{duration:1,ease:'easeOut'}} className="h-full rounded-full bg-[#8dcc65]"/></div><div className="mt-2 flex justify-between text-[10px] text-slate-400"><span>34.2 GB / 50 GB</span><b className="text-slate-600">68%</b></div></div>
  </motion.aside>
}

function ProfileAvatar({profile,size='md'}:{profile:UserProfile;size?:'md'|'lg'}){
  const initial=profile.displayName.trim().charAt(0).toUpperCase()||'B'
  const sizeClass=size==='lg'?'size-16 text-lg':'size-12 text-sm'
  if(profile.avatarUrl)return <img src={profile.avatarUrl} alt={`${profile.displayName}的头像`} className={`${sizeClass} shrink-0 rounded-full object-cover ring-4 ring-white shadow-md`}/>
  return <span aria-label={`${profile.displayName}的头像`} className={`grid ${sizeClass} shrink-0 place-items-center rounded-full bg-[#dff2d6] font-bold text-[#4d8648] ring-4 ring-white shadow-md`}>{initial}</span>
}

function Header({search,setSearch,openMenu,cloud,profile,accessRole,onOpenSettings,onSignOut}:{search:string;setSearch:(v:string)=>void;openMenu:()=>void;cloud:boolean;profile:UserProfile;accessRole:AccessRole;onOpenSettings:()=>void;onSignOut:()=>void}){
  const [profileOpen,setProfileOpen]=useState(false)
  const roleLabel=accessRole==='super_admin'?'超级管理员':accessRole==='admin'?'管理员':'普通用户'
  return <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5">
    {profileOpen&&<button aria-label="关闭个人菜单" onClick={()=>setProfileOpen(false)} className="fixed inset-0 z-30 cursor-default"/>}
    <div className="relative z-40 mx-auto flex min-h-16 max-w-[1680px] items-center gap-3 rounded-[24px] border border-white bg-white/90 px-3 py-2 shadow-[0_14px_45px_rgba(54,84,72,0.08)] backdrop-blur-xl sm:px-5">
      <button aria-label="打开导航" onClick={openMenu} className="grid size-10 place-items-center rounded-2xl hover:bg-slate-100 lg:hidden"><Menu size={20}/></button>
      <div className="relative mx-auto w-full max-w-xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索项目、内容、数据..." className="h-11 w-full rounded-2xl border border-slate-100 bg-[#f7f9f7] pl-11 pr-4 text-sm outline-none transition focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50"/></div>
      <motion.button aria-label="通知" whileHover={{scale:1.06}} className="relative grid size-11 shrink-0 place-items-center rounded-2xl border border-slate-100 bg-white text-slate-600"><Bell size={19}/><i className={`absolute right-2 top-2 size-2 rounded-full ring-2 ring-white ${cloud?'bg-[#76c853]':'bg-amber-400'}`}/></motion.button>
      <button onClick={()=>setProfileOpen(open=>!open)} aria-expanded={profileOpen} aria-haspopup="menu" className={`hidden min-w-[190px] items-center gap-3 rounded-2xl px-2 py-1.5 transition sm:flex ${profileOpen?'bg-[#f3f7f1]':'hover:bg-slate-50'}`}><ProfileAvatar profile={profile}/><span className="min-w-0 text-left"><b className="block truncate text-sm">{profile.displayName}</b><small className="mt-0.5 block text-[11px] text-slate-400">{roleLabel}</small></span><motion.span className="ml-auto text-slate-400" animate={{rotate:profileOpen?180:0}}><ChevronDown size={15}/></motion.span></button>
      <AnimatePresence>{profileOpen&&<motion.div role="menu" aria-label="个人中心" initial={{opacity:0,y:-8,scale:.98}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:-6,scale:.98}} className="absolute right-3 top-[calc(100%+10px)] z-50 w-72 overflow-hidden rounded-3xl border border-white bg-white p-2 shadow-[0_24px_70px_rgba(40,65,50,0.18)] sm:right-5"><div className="flex items-center gap-3 p-3"><ProfileAvatar profile={profile}/><div className="min-w-0"><b className="block truncate text-sm">{profile.displayName}</b><span className="text-[11px] text-slate-400">{roleLabel} · {profile.jobTitle}</span></div></div><div className="mx-2 mb-2 flex items-center justify-between rounded-2xl bg-[#f4f8f2] px-3 py-2.5 text-xs"><span className="flex items-center gap-2 text-slate-500"><Database size={15}/>Supabase 云端</span><b className={`flex items-center gap-1 ${cloud?'text-emerald-600':'text-amber-600'}`}><CheckCircle2 size={14}/>{cloud?'已连接':'本地模式'}</b></div><button role="menuitem" onClick={()=>{setProfileOpen(false);onOpenSettings()}} className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm text-slate-600 transition hover:bg-[#f4f7f2]"><Settings size={17}/>个人账号设置</button>{cloud&&<><div className="mx-3 my-1 border-t border-slate-100"/><button role="menuitem" onClick={()=>{setProfileOpen(false);onSignOut()}} className="flex h-11 w-full items-center gap-3 rounded-2xl px-3 text-sm text-rose-500 transition hover:bg-rose-50"><LogOut size={17}/>退出登录</button></>}</motion.div>}</AnimatePresence>
    </div>
  </header>
}

function PageHead({eyebrow,title,desc,action}:{eyebrow:string;title:string;desc:string;action?:React.ReactNode}){
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#67a756]">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-slate-950 sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-slate-500">{desc}</p></div>{action}</div>
}

function Dashboard({entries,brands,totals}:any){
  const [trendRange,setTrendRange]=useState<'week'|'month'|'year'>('month')
  const rangeChartData=useMemo(()=>{
    const typed=entries as MetricEntry[]
    const dates=typed.map(entry=>entry.date).sort()
    const latest=dates[dates.length-1]||dateKey(new Date())
    const reference=new Date(`${latest}T12:00:00`)
    const bucket=(key:string,label:string,match:(entry:MetricEntry)=>boolean)=>{
      const rows=typed.filter(match)
      return {
        date:label,
        aViews:rows.filter(entry=>entry.brand==='brandA').reduce((sum,entry)=>sum+entry.views,0),
        bViews:rows.filter(entry=>entry.brand==='brandB').reduce((sum,entry)=>sum+entry.views,0),
        key,
      }
    }
    if(trendRange==='week'){
      const weekday=(reference.getDay()+6)%7
      const monday=new Date(reference)
      monday.setDate(reference.getDate()-weekday)
      return Array.from({length:7},(_,index)=>{
        const current=new Date(monday)
        current.setDate(monday.getDate()+index)
        const key=dateKey(current)
        return bucket(key,`${current.getMonth()+1}/${current.getDate()}`,entry=>entry.date===key)
      })
    }
    if(trendRange==='month'){
      const year=reference.getFullYear(),month=reference.getMonth()
      const days=new Date(year,month+1,0).getDate()
      return Array.from({length:days},(_,index)=>{
        const current=new Date(year,month,index+1,12)
        const key=dateKey(current)
        return bucket(key,`${index+1}日`,entry=>entry.date===key)
      })
    }
    const year=reference.getFullYear()
    return Array.from({length:12},(_,index)=>{
      const key=`${year}-${String(index+1).padStart(2,'0')}`
      return bucket(key,`${index+1}月`,entry=>entry.date.startsWith(key))
    })
  },[entries,trendRange])
  const rangeLabel={week:'本周',month:'本月',year:'本年'}[trendRange]
  const kpis=[['总播放量',fmt(totals.views),'较上月 +18.6%',Play,'mint'],['总转发量',fmt(totals.shares),'互动效率 0.70%',Share2,'blue'],['粉丝净增长',`+${fmt(totals.followers)}`,'较上月 +12.4%',Users,'violet'],['数据完整度','92%','12 条有效记录',Activity,'amber']]
  return <><PageHead eyebrow="Dashboard · July 2026" title="品牌数据，一目了然" desc="两个品牌的当月表现、内容资产与运营节奏。"/>
    <motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(([label,value,note,Icon,tone]:any)=><Card key={label} className="p-5"><div className="flex items-start justify-between"><span className={`grid size-11 place-items-center rounded-2xl ${tone==='mint'?'bg-emerald-50 text-emerald-600':tone==='blue'?'bg-sky-50 text-sky-600':tone==='violet'?'bg-violet-50 text-violet-600':'bg-amber-50 text-amber-600'}`}><Icon size={20}/></span><ArrowUpRight size={17} className="text-slate-300"/></div><p className="mt-5 text-sm text-slate-500">{label}</p><strong className="mt-1 block text-3xl font-semibold tracking-tight">{value}</strong><p className="mt-2 text-xs font-medium text-emerald-600">{note}</p></Card>)}</motion.div>
    <motion.div variants={gridMotion} initial="hidden" animate="show" className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_.85fr]">
      <Card className="min-h-[420px] p-5 sm:p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h2 className="text-lg font-semibold">{rangeLabel}播放量趋势</h2><p className="mt-1 text-xs text-slate-400">两个品牌 · 数据中心实时同步</p></div><div className="flex self-start rounded-2xl bg-[#f3f7f1] p-1">{([['week','本周'],['month','本月'],['year','本年']] as const).map(([id,label])=><button key={id} onClick={()=>setTrendRange(id)} aria-pressed={trendRange===id} className={`h-8 rounded-xl px-3 text-xs font-semibold transition ${trendRange===id?'bg-white text-[#4f8248] shadow-sm':'text-slate-400 hover:text-slate-700'}`}>{label}</button>)}</div></div><div className="mt-6 h-[310px] recharts-clean-focus"><ResponsiveContainer width="100%" height="100%"><LineChart data={rangeChartData}><CartesianGrid stroke="#edf1ed" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#94a3b8'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#94a3b8'}} width={48}/><Tooltip content={<ChartTooltip/>}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/><Line name={brands.brandA} type="monotone" dataKey="aViews" stroke="#79bf58" strokeWidth={3} dot={{r:4,fill:'#fff',strokeWidth:3}} activeDot={{r:6}}/><Line name={brands.brandB} type="monotone" dataKey="bViews" stroke="#69b8b0" strokeWidth={3} dot={{r:4,fill:'#fff',strokeWidth:3}} activeDot={{r:6}}/></LineChart></ResponsiveContainer></div></Card>
      <Card className="relative overflow-hidden bg-gradient-to-br from-[#e6f3df] via-[#f8fbf5] to-[#d9efcf] p-6"><div className="absolute right-6 top-6 grid size-10 place-items-center rounded-full bg-white/70"><MoreHorizontal size={18}/></div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#5f8e53]">Brand Assets</p><h2 className="mt-5 max-w-[220px] text-2xl font-semibold tracking-tight">双品牌账号资产</h2><p className="mt-2 text-sm text-slate-500">抖音 · 小红书 · 视频号</p><div className="mt-9"><p className="text-xs text-slate-500">当月累计播放</p><strong className="mt-1 block text-4xl font-semibold tracking-tight">{fmt(totals.views)}</strong></div><div className="mt-8 flex items-end justify-between"><div><p className="text-xs text-slate-500">粉丝净增长</p><b className="mt-1 block text-xl">+{fmt(totals.followers)}</b></div><div className="flex -space-x-2"><span className="grid size-10 place-items-center rounded-full border-2 border-white bg-[#91cb73] text-xs font-bold text-white">创</span><span className="grid size-10 place-items-center rounded-full border-2 border-white bg-[#76bbb5] text-xs font-bold text-white">喜</span></div></div></Card>
    </motion.div>
    <motion.div variants={gridMotion} initial="hidden" animate="show" className="mt-4 grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
      <RecentTable entries={entries} brands={brands}/><Card className="p-6"><h2 className="text-lg font-semibold">本月运营节奏</h2><p className="mt-1 text-xs text-slate-400">内容发布与数据复盘进度</p><div className="mt-7 space-y-6">{[['脚本与拍摄','12 / 16',75],['内容发布','24 / 30',80],['数据复盘','3 / 4',75]].map(([name,value,p]:any)=><div key={name}><div className="flex justify-between text-sm"><span>{name}</span><b>{value}</b></div><div className="mt-3 h-2 rounded-full bg-[#edf2eb]"><motion.div initial={{width:0}} whileInView={{width:`${p}%`}} transition={{duration:.8}} className="h-full rounded-full bg-[#8dcc65]"/></div></div>)}</div><div className="mt-8 border-t border-slate-100 pt-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={19}/></span><div><p className="text-sm font-medium">数据更新完成</p><p className="text-xs text-slate-400">今天 09:42</p></div></div></div></Card>
    </motion.div>
  </>
}

function RecentTable({entries,brands}:{entries:MetricEntry[];brands:BrandConfig}){
  const rows=[...entries].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6)
  return <Card className="overflow-hidden"><div className="flex items-center justify-between p-6"><div><h2 className="text-lg font-semibold">最近数据流水</h2><p className="mt-1 text-xs text-slate-400">最近录入的账号表现</p></div><button className="rounded-2xl border border-slate-100 p-2.5 text-slate-500"><Download size={17}/></button></div><div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left"><thead className="bg-[#f7f9f6] text-[11px] uppercase tracking-wide text-slate-400"><tr><th className="px-6 py-3 font-medium">日期</th><th className="px-4 py-3 font-medium">品牌</th><th className="px-4 py-3 font-medium">播放量</th><th className="px-4 py-3 font-medium">转发</th><th className="px-4 py-3 font-medium">粉丝增长</th><th className="px-6 py-3 font-medium">状态</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-t border-slate-50 text-sm transition hover:bg-[#fbfdf9]"><td className="px-6 py-4 text-slate-500">{r.date}</td><td className="px-4 py-4 font-semibold">{brands[r.brand]}</td><td className="px-4 py-4">{fmt(r.views)}</td><td className="px-4 py-4">{fmt(r.shares)}</td><td className="px-4 py-4 font-medium text-emerald-600">+{fmt(r.followers)}</td><td className="px-6 py-4"><Status value={r.views>60000?'Success':r.views<25000?'Pending':'Success'}/></td></tr>)}</tbody></table></div></Card>
}

function WorkPlan(){
  const [planView,setPlanView]=useState<'month'|'week'>('month')
  const [createOpen,setCreateOpen]=useState(false)
  const [selectedPlan,setSelectedPlan]=useState<DetailData|null>(null)
  const [planForm,setPlanForm]=useState({title:'',summary:'',brand:'创艺装饰',period:'month',date:''})
  const [customPlans,setCustomPlans]=useState<Array<{id?:string;title:string;summary?:string;brand?:string;period:string;date:string}>>(()=>stored('brandflow-plans',[]))
  useEffect(()=>{if(isSupabaseConfigured)plansDb.list().then((rows:any)=>setCustomPlans(rows.map((row:any)=>({id:row.id,title:row.title,summary:row.summary,brand:row.brands?.name,period:row.period,date:row.due_date||''})))).catch(()=>{})},[])
  useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem('brandflow-plans',JSON.stringify(customPlans))},[customPlans])
  const monthWeeks=[
    ['第 1 周','品牌策略与选题',['完成七月双品牌选题池','确认品牌片脚本方向'],100],
    ['第 2 周','拍摄与内容生产',['品牌片分镜及场地确认','完成两场工地拍摄'],72],
    ['第 3 周','发布与项目推进',['发布创艺案例短片','喜客喜账号栏目测试'],38],
    ['第 4 周','复盘与下月准备',['双品牌月度数据复盘','建立八月内容计划'],12],
  ] as const
  const weekGroups:Array<[string,string[]]>=[['本周待办',['确定品牌片拍摄场地','整理设计师案例库','建立本周选题清单']],['进行中',['品牌片分镜细化','水电工艺素材归档','云上九州案例文案']],['待确认',['设计师采访短片','隐蔽工程图文']],['已完成',['品牌片文案确认','上周数据复盘']]]
  const switcher=<div className="flex rounded-2xl border border-white bg-white p-1 shadow-sm">{([['month','月度计划'],['week','周计划']] as const).map(([id,label])=><motion.button key={id} whileTap={{scale:.97}} onClick={()=>setPlanView(id)} className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${planView===id?'bg-[#dff2d6] text-[#39713c] shadow-sm':'text-slate-400 hover:text-slate-700'}`}>{label}</motion.button>)}</div>
  const addPlan=async(event:React.FormEvent)=>{event.preventDefault();const item={...planForm};if(isSupabaseConfigured){const row:any=await plansDb.create({brandCode:planForm.brand==='喜客喜装饰'?'brandB':'brandA',title:planForm.title,summary:planForm.summary,period:planForm.period,due_date:planForm.date});item.title=row.title}setCustomPlans([{...item},...customPlans]);setCreateOpen(false);setPlanForm({title:'',summary:'',brand:'创艺装饰',period:'month',date:''})}
  return <><PageHead eyebrow="Work Plan" title="工作计划" desc="月度计划确定阶段目标，周计划负责具体任务执行。" action={<div className="flex flex-wrap items-center gap-3">{switcher}<motion.button onClick={()=>setCreateOpen(true)} whileHover={{y:-2}} whileTap={{scale:.97}} className="flex h-11 items-center gap-2 rounded-2xl bg-[#8dcc65] px-5 text-sm font-semibold text-white shadow-lg shadow-lime-200"><Plus size={17}/>新建计划</motion.button></div>}/>
    {customPlans.length>0&&<motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{customPlans.map((plan,index)=><Card key={`${plan.title}-${index}`} onClick={()=>setSelectedPlan({title:plan.title,category:plan.period==='month'?'月度计划':'周计划',description:plan.summary,fields:[['所属品牌',plan.brand||'未指定'],['完成日期',plan.date||'待定']]})} ariaLabel={`查看计划 ${plan.title}`} className="flex items-start gap-4 p-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e5f3dd] text-[#5e9950]"><CalendarDays size={19}/></span><div className="min-w-0"><b className="block truncate text-sm">{plan.title}</b>{plan.summary&&<p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{plan.summary}</p>}<span className="mt-2 block text-[11px] text-slate-400">{plan.brand&&`${plan.brand} · `}{plan.period==='month'?'月度计划':'周计划'} · {plan.date||'待定时间'}</span></div></Card>)}</motion.div>}
    <AnimatePresence mode="wait">
      {planView==='month'?<motion.div key="month" variants={gridMotion} initial="hidden" animate="show" exit={{opacity:0,y:-8}}><div className="mb-4 grid gap-4 sm:grid-cols-3"><Card className="p-5"><p className="text-xs text-slate-400">本月目标</p><strong className="mt-2 block text-2xl">双品牌内容稳定更新</strong></Card><Card className="p-5"><p className="text-xs text-slate-400">计划完成度</p><strong className="mt-2 block text-3xl">56%</strong><div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf2eb]"><motion.div initial={{width:0}} animate={{width:'56%'}} className="h-full rounded-full bg-[#8dcc65]"/></div></Card><Card className="p-5"><p className="text-xs text-slate-400">本月安排</p><div className="mt-3 flex gap-6"><div><b className="block text-2xl">16</b><span className="text-xs text-slate-400">项任务</span></div><div><b className="block text-2xl">8</b><span className="text-xs text-slate-400">条内容</span></div></div></Card></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{monthWeeks.map(([week,focus,tasks,progress],index)=><Card key={week} className="min-h-[330px] p-5"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#67a756]">{week}</span><span className={`rounded-full px-2.5 py-1 text-[10px] ${progress===100?'bg-emerald-50 text-emerald-700':index===1?'bg-sky-50 text-sky-600':'bg-slate-50 text-slate-500'}`}>{progress===100?'已完成':index===1?'进行中':'待开始'}</span></div><h2 className="mt-5 text-lg font-semibold">{focus}</h2><div className="mt-5 space-y-3">{tasks.map(task=><div key={task} className="flex gap-3 rounded-2xl bg-[#f7f9f6] p-3 text-sm leading-6"><CircleDashed size={16} className="mt-1 shrink-0 text-[#80ba65]"/>{task}</div>)}</div><div className="mt-6 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#edf2eb]"><motion.div initial={{width:0}} animate={{width:`${progress}%`}} className="h-full rounded-full bg-[#8dcc65]"/></div><span className="text-xs font-semibold text-slate-400">{progress}%</span></div></Card>)}</div></motion.div>:<motion.div key="week" variants={gridMotion} initial="hidden" animate="show" exit={{opacity:0,y:-8}} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{weekGroups.map(([name,items],index)=><Card key={name} className="min-h-[430px] bg-white/75 p-4"><div className="flex items-center justify-between px-1 py-2"><h2 className="flex items-center gap-2 font-semibold"><i className={`size-2 rounded-full ${index===0?'bg-slate-300':index===1?'bg-sky-400':index===2?'bg-amber-400':'bg-[#8dcc65]'}`}/>{name}</h2><span className="rounded-full bg-[#f2f6ef] px-2 py-1 text-xs text-slate-500">{items.length}</span></div><div className="mt-3 space-y-3">{items.map((item,i)=><motion.article whileHover={{y:-3}} key={item} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><span className="text-[10px] font-semibold text-[#67a756]">{i%2?'内容运营':'品牌项目'}</span><h3 className="mt-2 text-sm font-semibold leading-6">{item}</h3><div className="mt-5 flex items-center justify-between text-xs text-slate-400"><span className="grid size-7 place-items-center rounded-full bg-[#e5f3dd] font-bold text-[#5d8d52]">{i%2?'文':'设'}</span><time>本周{index+i+1}日</time></div></motion.article>)}</div></Card>)}</motion.div>}
    </AnimatePresence>
    <CreatePanel open={createOpen} onClose={()=>setCreateOpen(false)} title="新建视频计划" desc="先确定要做什么视频，再补充主要内容与执行周期。"><form onSubmit={addPlan} className="space-y-4"><Field label="视频主题"><input required value={planForm.title} onChange={e=>setPlanForm({...planForm,title:e.target.value})} placeholder="例如：第一次装修最容易踩的 5 个坑"/></Field><label className="block text-xs font-medium text-slate-500">大致内容<textarea required value={planForm.summary} onChange={e=>setPlanForm({...planForm,summary:e.target.value})} className="mt-2 min-h-28 w-full resize-none rounded-2xl border border-slate-100 bg-[#f8faf7] p-4 text-sm outline-none transition focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50" placeholder="简单写明视频准备讲什么、主要画面和表达重点"/></label><div className="grid gap-4 sm:grid-cols-2"><Field label="所属品牌"><select value={planForm.brand} onChange={e=>setPlanForm({...planForm,brand:e.target.value})}><option>创艺装饰</option><option>喜客喜装饰</option></select></Field><Field label="计划周期"><select value={planForm.period} onChange={e=>setPlanForm({...planForm,period:e.target.value})}><option value="month">月度计划</option><option value="week">周计划</option></select></Field></div><Field label="计划完成日期"><input type="date" required value={planForm.date} onChange={e=>setPlanForm({...planForm,date:e.target.value})}/></Field><SubmitButton label="保存计划"/></form></CreatePanel>
    <DetailPanel detail={selectedPlan} onClose={()=>setSelectedPlan(null)}/>
  </>
}

function ProjectCenter(){
  const [createOpen,setCreateOpen]=useState(false)
  const [selectedProject,setSelectedProject]=useState<DetailData|null>(null)
  const [projectForm,setProjectForm]=useState({title:'',type:'品牌视频',brand:'创艺装饰',owner:'',desc:'',date:''})
  const [projects,setProjects]=useState<Array<[string,string,string,number,string?,string?,string?,string?]>>(()=>stored('brandflow-projects',[['/assets/project-home.jpg','嗨，我的新家','品牌视频',76],['/assets/finished-home.jpg','云上九州 128㎡','完工案例',92],['/assets/site-safety.jpg','观山湖工地日记','内容栏目',48],['/assets/content-team.jpg','设计师人物栏目','长期栏目',34]]))
  useEffect(()=>{if(isSupabaseConfigured)projectsDb.list().then((rows:any)=>setProjects(rows.map((row:any)=>[row.cover_url||'/assets/project-home.jpg',row.name,row.project_type,Number(row.progress),row.description||'',row.due_date||'',row.owner_name||'',row.brands?.name||'']))).catch(()=>{})},[])
  useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem('brandflow-projects',JSON.stringify(projects))},[projects])
  const addProject=async(event:React.FormEvent)=>{event.preventDefault();if(isSupabaseConfigured)await projectsDb.create({brandCode:projectForm.brand==='喜客喜装饰'?'brandB':'brandA',name:projectForm.title,project_type:projectForm.type,owner_name:projectForm.owner,description:projectForm.desc,due_date:projectForm.date,cover_url:'/assets/project-home.jpg'});setProjects([['/assets/project-home.jpg',projectForm.title,projectForm.type,0,projectForm.desc,projectForm.date,projectForm.owner,projectForm.brand],...projects]);setCreateOpen(false);setProjectForm({title:'',type:'品牌视频',brand:'创艺装饰',owner:'',desc:'',date:''})}
  return <><PageHead eyebrow="Project Center" title="项目中心" desc="统一管理品牌视频、客户案例和长期内容栏目。" action={<motion.button onClick={()=>setCreateOpen(true)} whileHover={{y:-2}} whileTap={{scale:.97}} className="flex h-11 items-center gap-2 rounded-2xl bg-[#8dcc65] px-5 text-sm font-semibold text-white shadow-lg shadow-lime-200"><Plus size={17}/>新建项目</motion.button>}/><motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{projects.map(([src,title,type,progress,desc,date,owner,brand],index)=><Card key={`${title}-${index}`} onClick={()=>setSelectedProject({title,category:type,description:desc,image:src,fields:[['所属品牌',brand||'未指定'],['负责人',owner||'未指定'],['计划交付',date||'待定'],['完成度',`${progress}%`],['项目状态',progress===0?'待开始':progress>=100?'已完成':'进行中']]})} ariaLabel={`查看项目 ${title}`} className="overflow-hidden"><div className="aspect-[16/10] overflow-hidden"><motion.img whileHover={{scale:1.04}} src={src} alt={title} className="h-full w-full object-cover"/></div><div className="p-5"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wider text-[#67a756]">{type}</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] text-emerald-700">{progress===0?'待开始':'进行中'}</span></div><h3 className="mt-4 text-lg font-semibold">{title}</h3>{desc&&<p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{desc}</p>}{date&&<p className="mt-3 text-[11px] text-slate-400">计划交付 · {date}</p>}<div className="mt-6 flex justify-between text-xs text-slate-400"><span>完成度</span><b className="text-slate-700">{progress}%</b></div><div className="mt-2 h-2 rounded-full bg-[#edf2eb]"><motion.div initial={{width:0}} animate={{width:`${progress}%`}} className="h-full rounded-full bg-[#8dcc65]"/></div></div></Card>)}</motion.div><CreatePanel open={createOpen} onClose={()=>setCreateOpen(false)} title="新建项目" desc="项目用于管理一组有共同目标的计划、内容和素材。"><form onSubmit={addProject} className="space-y-4"><Field label="项目名称"><input required value={projectForm.title} onChange={e=>setProjectForm({...projectForm,title:e.target.value})} placeholder="例如：创艺品牌片第二季"/></Field><label className="block text-xs font-medium text-slate-500">项目目标与范围<textarea required value={projectForm.desc} onChange={e=>setProjectForm({...projectForm,desc:e.target.value})} className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-slate-100 bg-[#f8faf7] p-4 text-sm outline-none transition focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50" placeholder="说明项目要解决什么、包含哪些交付内容"/></label><div className="grid gap-4 sm:grid-cols-2"><Field label="所属品牌"><select value={projectForm.brand} onChange={e=>setProjectForm({...projectForm,brand:e.target.value})}><option>创艺装饰</option><option>喜客喜装饰</option></select></Field><Field label="项目类型"><select value={projectForm.type} onChange={e=>setProjectForm({...projectForm,type:e.target.value})}><option>品牌视频</option><option>完工案例</option><option>内容栏目</option><option>长期栏目</option></select></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="负责人"><input required value={projectForm.owner} onChange={e=>setProjectForm({...projectForm,owner:e.target.value})} placeholder="例如：内容运营"/></Field><Field label="计划交付日期"><input required type="date" value={projectForm.date} onChange={e=>setProjectForm({...projectForm,date:e.target.value})}/></Field></div><SubmitButton label="创建项目"/></form></CreatePanel><DetailPanel detail={selectedProject} onClose={()=>setSelectedProject(null)}/></>
}

function ContentCenter(){
  const [createOpen,setCreateOpen]=useState(false)
  const [selectedContent,setSelectedContent]=useState<DetailData|null>(null)
  const [contentForm,setContentForm]=useState({title:'',brand:'创艺装饰',channel:'抖音',state:'脚本中',format:'短视频',outline:'',date:''})
  const [content,setContent]=useState<Array<[string,string,string,string,string?,string?,string?,string?]>>(()=>stored('brandflow-content',[['/assets/content-video.jpg','装修不是选择题','待审核','抖音'],['/assets/site-safety.jpg','看不见的工程，也有标准','剪辑中','视频号'],['/assets/content-team.jpg','设计师如何听懂你的生活','已发布','小红书'],['/assets/finished-home.jpg','新家交付的第一天','脚本中','抖音']]))
  useEffect(()=>{if(isSupabaseConfigured)contentsDb.list().then((rows:any)=>setContent(rows.map((row:any)=>[row.cover_url||'/assets/content-video.jpg',row.title,row.status,row.channel,row.summary||'',row.content_format||'',row.planned_publish_date||'',row.brands?.name||'']))).catch(()=>{})},[])
  useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem('brandflow-content',JSON.stringify(content))},[content])
  const addContent=async(event:React.FormEvent)=>{event.preventDefault();if(isSupabaseConfigured)await contentsDb.create({brandCode:contentForm.brand==='喜客喜装饰'?'brandB':'brandA',title:contentForm.title,summary:contentForm.outline,content_format:contentForm.format,channel:contentForm.channel,status:contentForm.state,planned_publish_date:contentForm.date,cover_url:'/assets/content-video.jpg'});setContent([['/assets/content-video.jpg',contentForm.title,contentForm.state,contentForm.channel,contentForm.outline,contentForm.format,contentForm.date,contentForm.brand],...content]);setCreateOpen(false);setContentForm({title:'',brand:'创艺装饰',channel:'抖音',state:'脚本中',format:'短视频',outline:'',date:''})}
  return <><PageHead eyebrow="Content Center" title="内容中心" desc="管理选题、脚本、拍摄、剪辑、发布与复盘；优秀作品和原始文件统一归档到素材中心。" action={<motion.button onClick={()=>setCreateOpen(true)} whileHover={{y:-2}} whileTap={{scale:.97}} className="flex h-11 items-center gap-2 rounded-2xl bg-[#8dcc65] px-5 text-sm font-semibold text-white shadow-lg shadow-lime-200"><Plus size={17}/>创建内容</motion.button>}/><motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{content.map(([src,title,state,channel,outline,format,date,brand],index)=><Card key={`${title}-${index}`} onClick={()=>setSelectedContent({title,category:format||'内容',description:outline,image:src,fields:[['所属品牌',brand||'未指定'],['发布平台',channel],['当前阶段',state],['计划发布',date||'待定']]})} ariaLabel={`查看内容 ${title}`} className="overflow-hidden"><div className="relative aspect-video overflow-hidden"><motion.img whileHover={{scale:1.05}} src={src} alt={title} className="h-full w-full object-cover"/><span className="absolute bottom-3 right-3 rounded-xl bg-slate-950/65 px-2 py-1 text-[10px] text-white">00:58</span></div><div className="p-5"><div className="flex justify-between text-xs"><span className="rounded-full bg-[#eaf5e5] px-2.5 py-1 font-medium text-[#548448]">{state}</span><span className="text-slate-400">{channel}</span></div><h3 className="mt-4 font-semibold leading-6">{title}</h3>{outline&&<p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{outline}</p>}<p className="mt-5 text-xs text-slate-400">本周更新 · 12.4k 浏览</p></div></Card>)}</motion.div><CreatePanel open={createOpen} onClose={()=>setCreateOpen(false)} title="创建内容" desc="单条内容从选题开始，进入脚本、拍摄、剪辑和发布流程。"><form onSubmit={addContent} className="space-y-4"><Field label="内容标题"><input required value={contentForm.title} onChange={e=>setContentForm({...contentForm,title:e.target.value})} placeholder="输入视频或图文标题"/></Field><label className="block text-xs font-medium text-slate-500">内容概要<textarea required value={contentForm.outline} onChange={e=>setContentForm({...contentForm,outline:e.target.value})} className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-slate-100 bg-[#f8faf7] p-4 text-sm outline-none transition focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50" placeholder="说明这条内容讲什么、核心看点和主要画面"/></label><div className="grid gap-4 sm:grid-cols-2"><Field label="所属品牌"><select value={contentForm.brand} onChange={e=>setContentForm({...contentForm,brand:e.target.value})}><option>创艺装饰</option><option>喜客喜装饰</option></select></Field><Field label="内容形式"><select value={contentForm.format} onChange={e=>setContentForm({...contentForm,format:e.target.value})}><option>短视频</option><option>图文</option><option>直播切片</option><option>长视频</option></select></Field></div><div className="grid gap-4 sm:grid-cols-2"><Field label="发布平台"><select value={contentForm.channel} onChange={e=>setContentForm({...contentForm,channel:e.target.value})}><option>抖音</option><option>视频号</option><option>小红书</option></select></Field><Field label="当前阶段"><select value={contentForm.state} onChange={e=>setContentForm({...contentForm,state:e.target.value})}><option>脚本中</option><option>拍摄中</option><option>剪辑中</option><option>待审核</option></select></Field></div><Field label="计划发布日期"><input required type="date" value={contentForm.date} onChange={e=>setContentForm({...contentForm,date:e.target.value})}/></Field><SubmitButton label="创建内容"/></form></CreatePanel><DetailPanel detail={selectedContent} onClose={()=>setSelectedContent(null)}/></>
}

function IdeasCenter(){
  const [createOpen,setCreateOpen]=useState(false)
  const [selectedIdea,setSelectedIdea]=useState<DetailData|null>(null)
  const [ideaForm,setIdeaForm]=useState({title:'',desc:'',tag:'品牌叙事',brand:'创艺装饰'})
  const [ideas,setIdeas]=useState<string[][]>(()=>stored('brandflow-ideas',[['家的第一句问候','品牌片开场不介绍公司，先让“家”成为说话的人。','品牌叙事'],['把隐蔽工程拍成可见的安心','用极近特写和检测动作，把标准变成用户能理解的证据。','工艺内容'],['设计师不是给答案的人','把设计师拍成帮助客户发现生活方式的人。','人物栏目']]))
  useEffect(()=>{if(isSupabaseConfigured)ideasDb.list().then((rows:any)=>setIdeas(rows.map((row:any)=>[row.title,row.description,row.category,row.brands?.name||'']))).catch(()=>{})},[])
  useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem('brandflow-ideas',JSON.stringify(ideas))},[ideas])
  const addIdea=async(event:React.FormEvent)=>{event.preventDefault();if(isSupabaseConfigured)await ideasDb.create({brandCode:ideaForm.brand==='喜客喜装饰'?'brandB':'brandA',title:ideaForm.title,description:ideaForm.desc,category:ideaForm.tag});setIdeas([[ideaForm.title,ideaForm.desc,ideaForm.tag,ideaForm.brand],...ideas]);setCreateOpen(false);setIdeaForm({title:'',desc:'',tag:'品牌叙事',brand:'创艺装饰'})}
  return <><PageHead eyebrow="Inspiration" title="灵感中心" desc="收集参考、沉淀观察，并把灵感转化为可执行选题。" action={<motion.button onClick={()=>setCreateOpen(true)} whileHover={{y:-2}} whileTap={{scale:.97}} className="flex h-11 items-center gap-2 rounded-2xl bg-[#8dcc65] px-5 text-sm font-semibold text-white shadow-lg shadow-lime-200"><Plus size={17}/>记录灵感</motion.button>}/><motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-3">{ideas.map(([title,desc,tag,brand],index)=><Card key={`${title}-${index}`} onClick={()=>setSelectedIdea({title,category:tag,description:desc,fields:[['所属品牌',brand||'未指定'],['内容状态','灵感记录']]})} ariaLabel={`查看灵感 ${title}`} className="p-6"><span className="grid size-11 place-items-center rounded-2xl bg-[#e5f3dd] text-[#5e9950]"><Lightbulb size={20}/></span><span className="mt-7 inline-block rounded-full bg-[#f3f7f1] px-3 py-1 text-[10px] font-semibold text-[#5f8e53]">{tag}</span><h3 className="mt-4 text-xl font-semibold tracking-tight">{title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{desc}</p><button onClick={event=>event.stopPropagation()} className="mt-8 flex items-center gap-1 text-xs font-semibold text-[#67a756]">转为选题 <ArrowUpRight size={14}/></button></Card>)}</motion.div><CreatePanel open={createOpen} onClose={()=>setCreateOpen(false)} title="记录灵感" desc="把观察、参考和创意先收进灵感库。"><form onSubmit={addIdea} className="space-y-4"><Field label="灵感标题"><input required value={ideaForm.title} onChange={e=>setIdeaForm({...ideaForm,title:e.target.value})} placeholder="一句话记录核心想法"/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="所属品牌"><select value={ideaForm.brand} onChange={e=>setIdeaForm({...ideaForm,brand:e.target.value})}><option>创艺装饰</option><option>喜客喜装饰</option></select></Field><Field label="灵感分类"><select value={ideaForm.tag} onChange={e=>setIdeaForm({...ideaForm,tag:e.target.value})}><option>品牌叙事</option><option>工艺内容</option><option>人物栏目</option><option>案例内容</option></select></Field></div><label className="block text-xs font-medium text-slate-500">详细说明<textarea required value={ideaForm.desc} onChange={e=>setIdeaForm({...ideaForm,desc:e.target.value})} className="mt-2 min-h-32 w-full resize-none rounded-2xl border border-slate-100 bg-[#f8faf7] p-4 text-sm outline-none transition focus:border-emerald-200 focus:ring-4 focus:ring-emerald-50" placeholder="记录画面、文案或执行方向"/></label><SubmitButton label="保存灵感"/></form></CreatePanel><DetailPanel detail={selectedIdea} onClose={()=>setSelectedIdea(null)}/></>
}

type GardenPlot = { flower:string; stage:number; color:string } | null
const defaultGardenPlots:GardenPlot[]=[
  {flower:'向日葵',stage:3,color:'#f4b942'},{flower:'郁金香',stage:2,color:'#ef7c8e'},null,
  {flower:'小雏菊',stage:1,color:'#f5d76e'},{flower:'绣球花',stage:3,color:'#75a7d8'},null,
  {flower:'月季',stage:2,color:'#e36b7f'},{flower:'薰衣草',stage:1,color:'#9476bd'},null,
]

function Garden(){
  const gardenSaved=useMemo(()=>stored<{water:number;coins:number;notice?:string;plots:GardenPlot[]}|null>('brandflow-garden',null),[])
  const [cloudGardenLoaded,setCloudGardenLoaded]=useState(false)
  const [tool,setTool]=useState<'water'|'harvest'>('water')
  const [water,setWater]=useState(gardenSaved?.water??8)
  const [coins,setCoins]=useState(gardenSaved?.coins??126)
  const [createOpen,setCreateOpen]=useState(false)
  const [flowerType,setFlowerType]=useState('向日葵')
  const [notice,setNotice]=useState(gardenSaved?.notice??'今天的花园状态很好')
  const [plots,setPlots]=useState<GardenPlot[]>(gardenSaved?.plots??defaultGardenPlots)
  useEffect(()=>{if(isSupabaseConfigured)loadGarden().then((garden:any)=>{setWater(Number(garden.state.water));setCoins(Number(garden.state.coins));setNotice(garden.state.notice);setPlots(garden.plots.map((plot:any)=>plot.flower?{flower:plot.flower,stage:Number(plot.stage),color:plot.color}:null));setCloudGardenLoaded(true)}).catch(()=>{})},[])
  useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem('brandflow-garden',JSON.stringify({water,coins,notice,plots}));else if(cloudGardenLoaded)saveGarden({water,coins,notice},plots.map((plot,position)=>({position,flower:plot?.flower??null,stage:plot?.stage??null,color:plot?.color??null}))).catch(()=>{})},[water,coins,notice,plots,cloudGardenLoaded])
  const useTool=(index:number)=>{
    const plot=plots[index]
    if(!plot){setNotice('这块花圃还空着，可以种一朵新花');return}
    if(tool==='water'){
      if(water<=0){setNotice('今天的水滴已经用完了');return}
      if(plot.stage>=3){setNotice(`${plot.flower}已经成熟，可以采收了`);return}
      setPlots(plots.map((item,i)=>i===index&&item?{...item,stage:item.stage+1}:item));setWater(water-1);setNotice(`${plot.flower}喝饱了水，长大了一点`)
    }else{
      if(plot.stage<3){setNotice(`${plot.flower}还没有成熟`);return}
      setPlots(plots.map((item,i)=>i===index?null:item));setCoins(coins+20);setNotice(`采收了${plot.flower}，获得 20 花币`)
    }
  }
  const plant=(event:React.FormEvent)=>{
    event.preventDefault();const empty=plots.findIndex(plot=>plot===null);if(empty<0){setNotice('花圃已经种满了');setCreateOpen(false);return}
    const palette:Record<string,string>={'向日葵':'#f4b942','郁金香':'#ef7c8e','小雏菊':'#f5d76e','绣球花':'#75a7d8','月季':'#e36b7f','薰衣草':'#9476bd'}
    setPlots(plots.map((plot,index)=>index===empty?{flower:flowerType,stage:1,color:palette[flowerType]}:plot));setCreateOpen(false);setNotice(`${flowerType}已经种进花圃`)
  }
  const planted=plots.filter(Boolean).length
  return <><PageHead eyebrow="My Garden" title="我的花园" desc="在忙碌的内容工作之外，照料属于自己的小花园。" action={<motion.button onClick={()=>setCreateOpen(true)} whileHover={{y:-2}} whileTap={{scale:.97}} className="flex h-11 items-center gap-2 rounded-2xl bg-[#8dcc65] px-5 text-sm font-semibold text-white shadow-lg shadow-lime-200"><Sprout size={17}/>种植花朵</motion.button>}/>
    <motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 xl:grid-cols-[1.5fr_.75fr]">
      <Card className="overflow-hidden"><div className="relative min-h-[570px] bg-[#dbeed3]"><img src="/assets/garden-meadow.jpg" alt="花园草地" className="absolute inset-0 h-full w-full object-cover opacity-35"/><div className="absolute inset-0 bg-gradient-to-b from-white/20 via-[#dcebd1]/45 to-[#c8dfbd]/90"/><div className="relative p-5 sm:p-7"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><span className="flex h-10 items-center gap-2 rounded-2xl bg-white/85 px-3 text-xs font-semibold shadow-sm backdrop-blur"><Droplets size={16} className="text-sky-500"/>{water} 水滴</span><span className="flex h-10 items-center gap-2 rounded-2xl bg-white/85 px-3 text-xs font-semibold shadow-sm backdrop-blur"><Trophy size={16} className="text-amber-500"/>{coins} 花币</span></div><div className="flex rounded-2xl bg-white/85 p-1 shadow-sm backdrop-blur"><button title="浇水" onClick={()=>setTool('water')} className={`grid size-9 place-items-center rounded-xl transition ${tool==='water'?'bg-sky-100 text-sky-600':'text-slate-400'}`}><Droplets size={17}/></button><button title="采收" onClick={()=>setTool('harvest')} className={`grid size-9 place-items-center rounded-xl transition ${tool==='harvest'?'bg-amber-100 text-amber-600':'text-slate-400'}`}><Flower2 size={17}/></button></div></div><div className="mx-auto mt-10 grid max-w-3xl grid-cols-3 gap-3 sm:gap-5">{plots.map((plot,index)=><motion.button key={index} whileHover={{y:-4,scale:1.02}} whileTap={{scale:.97}} onClick={()=>useTool(index)} className="relative aspect-square min-h-24 overflow-hidden rounded-2xl border-2 border-white/70 bg-[#9a7048]/85 shadow-[0_14px_26px_rgba(73,91,50,0.18)]"><span className="absolute inset-x-2 top-1/2 h-px bg-[#6e4e33]/35"/><span className="absolute inset-y-2 left-1/2 w-px bg-[#6e4e33]/35"/>{plot?<div className="relative z-10 flex h-full flex-col items-center justify-center text-white">{plot.stage===1?<Sprout size={34} style={{color:'#d8f0c8'}}/>:<Flower2 size={plot.stage===3?52:42} fill={plot.color} style={{color:plot.color}}/>}<b className="mt-2 text-xs text-white drop-shadow">{plot.flower}</b><span className="mt-1 text-[10px] text-white/80">{plot.stage===3?'可采收':`成长 ${plot.stage}/3`}</span></div>:<div className="relative z-10 grid h-full place-items-center text-white/65"><Plus size={24}/></div>}</motion.button>)}</div><div className="mx-auto mt-7 flex max-w-3xl items-center justify-between rounded-2xl bg-white/85 px-4 py-3 text-xs shadow-sm backdrop-blur"><span className="text-slate-600">{notice}</span><b className="text-[#5f9551]">{planted}/9 已种植</b></div></div></div></Card>
      <div className="space-y-4"><Card className="overflow-hidden"><img src="/assets/garden-flowers.jpg" alt="盛开的花朵" className="aspect-[16/9] w-full object-cover"/><div className="p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">今日花园</h2><Sun size={18} className="text-amber-500"/></div><p className="mt-2 text-sm leading-6 text-slate-500">阳光充足，适合浇水。成熟花朵采收后可获得花币。</p></div></Card><Card className="p-5"><h2 className="font-semibold">成长任务</h2><div className="mt-5 space-y-4">{[['给花朵浇水',Math.min(3,8-water),3],['种满花圃',planted,9],['收集花币',coins,200]].map(([name,value,total]:any)=><div key={name}><div className="flex justify-between text-xs"><span className="text-slate-500">{name}</span><b>{value}/{total}</b></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf2eb]"><div className="h-full rounded-full bg-[#8dcc65]" style={{width:`${Math.min(100,value/total*100)}%`}}/></div></div>)}</div></Card><Card className="overflow-hidden"><img src="/assets/garden-leaves.jpg" alt="花园绿植" className="h-28 w-full object-cover"/><div className="p-4"><p className="text-xs font-semibold text-[#67a756]">花房图鉴</p><p className="mt-1 text-sm text-slate-500">已解锁 6 种花卉</p></div></Card></div>
    </motion.div>
    <CreatePanel open={createOpen} onClose={()=>setCreateOpen(false)} title="种植花朵" desc="新花会自动种在第一块空花圃。"><form onSubmit={plant} className="space-y-4"><Field label="选择花种"><select value={flowerType} onChange={e=>setFlowerType(e.target.value)}><option>向日葵</option><option>郁金香</option><option>小雏菊</option><option>绣球花</option><option>月季</option><option>薰衣草</option></select></Field><div className="rounded-2xl bg-[#f4f8f1] p-4 text-sm leading-6 text-slate-500">种下后从幼苗开始成长，浇水两次即可成熟。</div><SubmitButton label="确认种植" icon={<Sprout size={17}/>}/></form></CreatePanel>
  </>
}

function DataCenter({entries,brands,onAddMetric,onDeleteMetric}:any){
  const today=new Date().toLocaleDateString('en-CA')
  const [form,setForm]=useState({date:today,brand:'brandA' as BrandId,views:'',shares:''})
  const [saving,setSaving]=useState(false)
  const [formError,setFormError]=useState('')
  const [pendingDelete,setPendingDelete]=useState<MetricEntry|null>(null)
  const [deleting,setDeleting]=useState(false)
  const typedEntries=entries as MetricEntry[]
  const referenceDate=useMemo(()=>{const dates=[today,...typedEntries.map(entry=>entry.date)].sort();return dates[dates.length-1] || today},[entries,today])
  const reference=new Date(`${referenceDate}T12:00:00`)
  const monthKey=referenceDate.slice(0,7)
  const weekday=(reference.getDay()+6)%7
  const monday=new Date(reference); monday.setDate(reference.getDate()-weekday)
  const sunday=new Date(monday); sunday.setDate(monday.getDate()+6)
  const iso=(date:Date)=>date.toLocaleDateString('en-CA')
  const weekStart=iso(monday),weekEnd=iso(sunday)

  const sumByBrand=(source:MetricEntry[])=>source.reduce((result,entry)=>{
    result[entry.brand].views+=entry.views
    result[entry.brand].shares+=entry.shares
    return result
  },{brandA:{views:0,shares:0},brandB:{views:0,shares:0}} as Record<BrandId,{views:number;shares:number}>)
  const monthEntries=typedEntries.filter(entry=>entry.date.startsWith(monthKey))
  const weekEntries=typedEntries.filter(entry=>entry.date>=weekStart&&entry.date<=weekEnd)
  const scopes=[
    {title:'月数据',period:`${reference.getFullYear()}年${reference.getMonth()+1}月`,icon:CalendarDays,data:sumByBrand(monthEntries)},
    {title:'周数据',period:`${weekStart.slice(5).replace('-','/')} - ${weekEnd.slice(5).replace('-','/')}`,icon:Activity,data:sumByBrand(weekEntries)},
    {title:'总数据',period:`累计 ${typedEntries.length} 条记录`,icon:Database,data:sumByBrand(typedEntries)},
  ]
  const trendData=useMemo(()=>Array.from(new Set<string>(monthEntries.map(entry=>entry.date))).sort().map(date=>{
    const daily=monthEntries.filter(entry=>entry.date===date)
    const totals=sumByBrand(daily)
    return {date:`${Number(date.slice(8))}日`,aViews:totals.brandA.views,bViews:totals.brandB.views}
  }),[entries,monthKey])
  const recent=[...typedEntries].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,8)
  const add=async(event:React.FormEvent)=>{
    event.preventDefault();setSaving(true);setFormError('')
    try{await onAddMetric({date:form.date,brand:form.brand,views:Number(form.views),shares:Number(form.shares)});setForm({...form,views:'',shares:''})}
    catch(error){setFormError(error instanceof Error?error.message:'数据保存失败')}
    finally{setSaving(false)}
  }
  const confirmRemove=async()=>{if(!pendingDelete)return;setDeleting(true);try{await onDeleteMetric(pendingDelete.id);setPendingDelete(null)}catch(error){setFormError(error instanceof Error?error.message:'删除失败')}finally{setDeleting(false)}}

  return <><PageHead eyebrow="Data Center" title="双品牌数据中心" desc="按周、月与累计维度查看创艺装饰和喜客喜装饰的播放与转发表现。"/>
    <motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-3">
      {scopes.map(({title,period,icon:Icon,data})=><Card key={title} className="p-5 sm:p-6"><div className="flex items-start justify-between"><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-xs text-slate-400">{period}</p></div><span className="grid size-10 place-items-center rounded-2xl bg-[#edf7e8] text-[#67a756]"><Icon size={18}/></span></div><div className="mt-6 space-y-3">{(['brandA','brandB'] as BrandId[]).map((brand,index)=><div key={brand} className="rounded-2xl border border-slate-100 bg-[#f8faf7] p-4"><div className="flex items-center gap-2"><i className={`size-2 rounded-full ${index===0?'bg-[#79bf58]':'bg-[#69b8b0]'}`}/><b className="text-sm">{brands[brand]}</b></div><div className="mt-4 grid grid-cols-2 gap-3"><div><span className="text-[11px] text-slate-400">播放量</span><strong className="mt-1 block text-xl font-semibold">{fmt(data[brand].views)}</strong></div><div><span className="text-[11px] text-slate-400">转发量</span><strong className="mt-1 block text-xl font-semibold">{fmt(data[brand].shares)}</strong></div></div></div>)}</div></Card>)}
    </motion.div>
    <motion.div variants={gridMotion} initial="hidden" animate="show" className="mt-4 grid gap-4 lg:grid-cols-3">
      <Card className="p-5 sm:p-6"><div><h2 className="text-lg font-semibold">新数据记录</h2><p className="mt-1 text-xs text-slate-400">选择品牌与日期，录入当日账号数据</p></div><form onSubmit={add} className="mt-6 space-y-4"><fieldset><legend className="text-xs font-medium text-slate-500">品牌名</legend><div className="mt-2 grid grid-cols-2 gap-2 rounded-2xl bg-[#f4f7f2] p-1.5">{(['brandA','brandB'] as BrandId[]).map((brand,index)=><motion.button type="button" whileTap={{scale:.98}} key={brand} onClick={()=>setForm({...form,brand})} aria-pressed={form.brand===brand} className={`flex min-h-14 items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold transition sm:text-sm ${form.brand===brand?'bg-white text-slate-900 shadow-[0_6px_20px_rgba(54,84,72,0.10)] ring-1 ring-white':'text-slate-400 hover:text-slate-700'}`}><span className={`grid size-7 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white ${index===0?'bg-[#79bf58]':'bg-[#69b8b0]'}`}>{index===0?'创':'喜'}</span><span className="min-w-0 leading-5">{brands[brand]}</span>{form.brand===brand&&<CheckCircle2 size={15} className="ml-auto hidden shrink-0 text-[#72b653] sm:block"/>}</motion.button>)}</div></fieldset><Field label="数据日期"><input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="播放量"><input type="number" min="0" required placeholder="例如 28600" value={form.views} onChange={e=>setForm({...form,views:e.target.value})}/></Field><Field label="转发量"><input type="number" min="0" required placeholder="例如 168" value={form.shares} onChange={e=>setForm({...form,shares:e.target.value})}/></Field></div>{formError&&<p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{formError}</p>}<motion.button disabled={saving} whileHover={saving?undefined:{scale:1.015,y:-1}} whileTap={saving?undefined:{scale:.98}} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#8dcc65] text-sm font-semibold text-white shadow-lg shadow-lime-200 transition hover:bg-[#82c45c] disabled:cursor-wait disabled:opacity-60"><Plus size={18}/>{saving?'正在保存...':'添加数据'}</motion.button></form></Card>
      <Card className="min-h-[440px] p-5 sm:p-6 lg:col-span-2"><div><h2 className="text-lg font-semibold">本月播放趋势</h2><p className="mt-1 text-xs text-slate-400">{brands.brandA}与{brands.brandB}每日播放量对比</p></div><div className="mt-6 h-[330px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><CartesianGrid stroke="#edf1ed" vertical={false}/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#94a3b8'}}/><YAxis axisLine={false} tickLine={false} tick={{fontSize:11,fill:'#94a3b8'}} width={48}/><Tooltip content={<ChartTooltip/>}/><Legend iconType="circle" wrapperStyle={{fontSize:11}}/><Line name={brands.brandA} type="monotone" dataKey="aViews" stroke="#79bf58" strokeWidth={3} dot={{r:3,fill:'#fff',strokeWidth:2}}/><Line name={brands.brandB} type="monotone" dataKey="bViews" stroke="#69b8b0" strokeWidth={3} dot={{r:3,fill:'#fff',strokeWidth:2}}/></LineChart></ResponsiveContainer></div></Card>
    </motion.div>
    <motion.div variants={gridMotion} initial="hidden" animate="show" className="mt-4"><Card className="overflow-hidden"><div className="p-5 sm:p-6"><h2 className="text-lg font-semibold">最近数据记录</h2><p className="mt-1 text-xs text-slate-400">新增记录会实时同步到上方统计与趋势</p></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead className="bg-[#f7f9f6] text-[11px] text-slate-400"><tr><th className="px-6 py-3 font-medium">日期</th><th className="px-4 py-3 font-medium">品牌名</th><th className="px-4 py-3 font-medium">播放量</th><th className="px-4 py-3 font-medium">转发量</th><th className="px-6 py-3 text-right font-medium">操作</th></tr></thead><tbody>{recent.map((entry:MetricEntry)=><tr key={entry.id} className="border-t border-slate-50 text-sm transition hover:bg-[#fbfdf9]"><td className="px-6 py-4 text-slate-500">{entry.date}</td><td className="px-4 py-4 font-semibold">{brands[entry.brand]}</td><td className="px-4 py-4">{fmt(entry.views)}</td><td className="px-4 py-4">{fmt(entry.shares)}</td><td className="px-6 py-4 text-right"><button onClick={()=>setPendingDelete(entry)} title="删除记录" aria-label={`删除 ${entry.date} ${brands[entry.brand]} 数据`} className="inline-grid size-9 place-items-center rounded-xl text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"><Trash2 size={16}/></button></td></tr>)}</tbody></table></div></Card></motion.div>
    <ConfirmDialog open={Boolean(pendingDelete)} onClose={()=>!deleting&&setPendingDelete(null)} onConfirm={confirmRemove} loading={deleting} title="确认删除这条数据？" desc={pendingDelete?`${pendingDelete.date} · ${brands[pendingDelete.brand]} · 播放 ${fmt(pendingDelete.views)} · 转发 ${fmt(pendingDelete.shares)}`:''}/>
  </>
}

function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block text-xs font-medium text-slate-500">{label}<div className="mt-2 [&>input]:h-12 [&>input]:w-full [&>input]:rounded-2xl [&>input]:border [&>input]:border-slate-100 [&>input]:bg-[#f8faf7] [&>input]:px-4 [&>input]:outline-none [&>input]:transition focus-within:[&>input]:border-emerald-200 focus-within:[&>input]:ring-4 focus-within:[&>input]:ring-emerald-50 [&>select]:h-12 [&>select]:w-full [&>select]:rounded-2xl [&>select]:border [&>select]:border-slate-100 [&>select]:bg-[#f8faf7] [&>select]:px-4 [&>select]:outline-none">{children}</div></label>}

function SubmitButton({label,icon}:{label:string;icon?:React.ReactNode}){return <motion.button type="submit" whileHover={{y:-2,scale:1.01}} whileTap={{scale:.98}} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#8dcc65] text-sm font-semibold text-white shadow-lg shadow-lime-200 transition hover:bg-[#82c45c]">{icon||<CheckCircle2 size={17}/>} {label}</motion.button>}

function CreatePanel({open,onClose,title,desc,children}:{open:boolean;onClose:()=>void;title:string;desc:string;children:React.ReactNode}){
  return <AnimatePresence>{open&&<><motion.button aria-label="关闭新增面板" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-sm"/><div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"><motion.section role="dialog" aria-modal="true" aria-label={title} initial={{y:24,scale:.96,opacity:0}} animate={{y:0,scale:1,opacity:1}} exit={{y:18,scale:.97,opacity:0}} transition={{type:'spring',stiffness:260,damping:26}} className="pointer-events-auto max-h-[calc(100vh-24px)] w-full max-w-xl overflow-y-auto rounded-3xl border border-white bg-white p-5 shadow-[0_30px_90px_rgba(31,52,40,0.24)] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#67a756]">Create New</p><h2 className="mt-2 text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{desc}</p></div><button type="button" onClick={onClose} title="关闭" className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#f4f7f2] text-slate-500 transition hover:bg-slate-100"><X size={18}/></button></div><div className="mt-7">{children}</div></motion.section></div></>}</AnimatePresence>
}

type DetailData = {
  title: string
  category: string
  description?: string
  image?: string
  fields: Array<[string,string]>
}

function DetailPanel({detail,onClose}:{detail:DetailData|null;onClose:()=>void}){
  return <AnimatePresence>{detail&&<><motion.button aria-label="关闭详情" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-sm"/><div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6"><motion.section role="dialog" aria-modal="true" aria-label={`${detail.title}详情`} initial={{opacity:0,y:20,scale:.97}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:14,scale:.98}} className="pointer-events-auto max-h-[calc(100vh-24px)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white bg-white shadow-[0_30px_90px_rgba(31,52,40,0.24)]">{detail.image&&<div className="aspect-[16/7] overflow-hidden rounded-t-3xl"><img src={detail.image} alt={detail.title} className="h-full w-full object-cover"/></div>}<div className="p-5 sm:p-7"><div className="flex items-start justify-between gap-4"><div><span className="rounded-full bg-[#edf7e8] px-3 py-1 text-[10px] font-semibold text-[#5f8e53]">{detail.category}</span><h2 className="mt-4 text-2xl font-semibold">{detail.title}</h2></div><button type="button" onClick={onClose} title="关闭" className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#f4f7f2] text-slate-500 hover:bg-slate-100"><X size={18}/></button></div>{detail.description&&<p className="mt-5 rounded-2xl bg-[#f7f9f6] p-4 text-sm leading-7 text-slate-600">{detail.description}</p>}<dl className="mt-6 grid gap-3 sm:grid-cols-2">{detail.fields.map(([label,value])=><div key={label} className="rounded-2xl border border-slate-100 p-4"><dt className="text-[11px] text-slate-400">{label}</dt><dd className="mt-2 text-sm font-semibold text-slate-700">{value||'未填写'}</dd></div>)}</dl></div></motion.section></div></>}</AnimatePresence>
}

function ConfirmDialog({open,onClose,onConfirm,title,desc,loading}:{open:boolean;onClose:()=>void;onConfirm:()=>void;title:string;desc:string;loading:boolean}){
  return <AnimatePresence>{open&&<><motion.button aria-label="关闭删除确认" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="fixed inset-0 z-50 bg-slate-900/25 backdrop-blur-sm"/><div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4"><motion.section role="alertdialog" aria-modal="true" aria-label={title} initial={{opacity:0,y:18,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:12,scale:.97}} className="pointer-events-auto w-full max-w-md rounded-3xl border border-white bg-white p-6 shadow-[0_30px_90px_rgba(31,52,40,0.24)]"><span className="grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-500"><Trash2 size={20}/></span><h2 className="mt-5 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p><p className="mt-4 rounded-2xl bg-[#f7f9f6] px-4 py-3 text-xs text-slate-400">删除后无法恢复，月、周和累计数据都会同步更新。</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" disabled={loading} onClick={onClose} className="h-11 rounded-2xl border border-slate-100 bg-white text-sm font-semibold text-slate-500 transition hover:bg-slate-50">取消</button><motion.button type="button" disabled={loading} onClick={onConfirm} whileTap={{scale:.98}} className="h-11 rounded-2xl bg-rose-500 text-sm font-semibold text-white shadow-lg shadow-rose-100 disabled:cursor-wait disabled:opacity-60">{loading?'正在删除...':'确认删除'}</motion.button></div></motion.section></div></>}</AnimatePresence>
}

function Transactions({entries,brands,chartData}:any){return <><PageHead eyebrow="Transactions" title="数据流水" desc="按时间追踪每一次账号数据变化。" action={<button className="flex h-11 items-center gap-2 rounded-2xl border border-white bg-white px-4 text-sm shadow-sm"><Download size={16}/>导出 CSV</button>}/><motion.div variants={gridMotion} initial="hidden" animate="show" className="space-y-4"><Card className="h-[300px] p-6"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="#eef2ed"/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar name={`${brands.brandA}转发`} dataKey="aShares" fill="#8dcc65" radius={[8,8,0,0]}/><Bar name={`${brands.brandB}转发`} dataKey="bShares" fill="#7fc4bd" radius={[8,8,0,0]}/></BarChart></ResponsiveContainer></Card><RecentTable entries={entries} brands={brands}/></motion.div></>}

function Reports({chartData,totals}:any){return <><PageHead eyebrow="Invoices & Reports" title="月度报表" desc="汇总播放、转发和粉丝增长，形成月度经营视图。"/><motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 lg:grid-cols-3"><Card className="p-6 lg:col-span-2"><h2 className="text-lg font-semibold">互动与粉丝增长</h2><div className="mt-6 h-[360px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid vertical={false} stroke="#eef2ed"/><XAxis dataKey="date" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/><Tooltip content={<ChartTooltip/>}/><Bar name="粉丝增长" dataKey="followers" fill="#8dcc65" radius={[10,10,0,0]}/></BarChart></ResponsiveContainer></div></Card><Card className="bg-[#17251d] p-7 text-white"><p className="text-xs uppercase tracking-[.18em] text-emerald-200">Monthly score</p><strong className="mt-6 block text-6xl font-semibold">92</strong><p className="mt-2 text-sm text-white/50">综合健康度</p><div className="mt-10 space-y-5">{[['内容增长','优秀'],['互动效率','稳定'],['粉丝增长','优秀']].map(([a,b])=><div className="flex justify-between border-b border-white/10 pb-4 text-sm" key={a}><span className="text-white/60">{a}</span><b>{b}</b></div>)}</div><button className="mt-8 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#9ad66f] text-sm font-semibold text-[#18301d]"><Download size={16}/>下载完整报告</button></Card></motion.div></>}

function Assets(){
  const [createOpen,setCreateOpen]=useState(false)
  const [selectedAsset,setSelectedAsset]=useState<DetailData|null>(null)
  const [assetForm,setAssetForm]=useState({title:'',type:'品牌视频',brand:'创艺装饰',fileName:''})
  const [assetFile,setAssetFile]=useState<File|null>(null)
  const [assetItems,setAssetItems]=useState<string[][]>(()=>stored('brandflow-assets',assets))
  useEffect(()=>{if(isSupabaseConfigured)assetsDb.list().then((rows:any)=>setAssetItems(rows.map((row:any)=>[row.public_url||'/assets/project-home.jpg',row.name,row.category,row.brands?.name||'',row.mime_type||'文件']))).catch(()=>{})},[])
  useEffect(()=>{if(!isSupabaseConfigured)localStorage.setItem('brandflow-assets',JSON.stringify(assetItems))},[assetItems])
  const addAsset=async(event:React.FormEvent)=>{event.preventDefault();if(isSupabaseConfigured&&assetFile){const path=await uploadAsset(assetFile);await assetsDb.create({brandCode:assetForm.brand==='喜客喜装饰'?'brandB':'brandA',name:assetForm.title,category:assetForm.type,storage_path:path,mime_type:assetFile.type,size_bytes:assetFile.size})}setAssetItems([['/assets/project-home.jpg',assetForm.title,assetForm.type,assetForm.brand,assetFile?.type||assetForm.fileName||'文件'],...assetItems]);setCreateOpen(false);setAssetFile(null);setAssetForm({title:'',type:'品牌视频',brand:'创艺装饰',fileName:''})}
  return <><PageHead eyebrow="Asset Library" title="素材中心" desc="归档原始视频、工地画面、设计案例、品牌文件和过往优秀作品。" action={<motion.button onClick={()=>setCreateOpen(true)} whileHover={{y:-2}} whileTap={{scale:.97}} className="flex h-11 items-center gap-2 rounded-2xl bg-[#8dcc65] px-5 text-sm font-semibold text-white shadow-lg shadow-lime-200"><Upload size={17}/>上传素材</motion.button>}/><motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{assetItems.map(([src,title,type,brand,fileType],index)=><Card key={`${title}-${index}`} onClick={()=>setSelectedAsset({title,category:type,image:src,fields:[['所属品牌',brand||'未指定'],['文件类型',fileType||'文件'],['更新时间','本月']]})} ariaLabel={`查看素材 ${title}`} className="overflow-hidden"><div className="aspect-[4/3] overflow-hidden"><motion.img whileHover={{scale:1.04}} transition={{duration:.35}} src={src} alt={title} className="h-full w-full object-cover"/></div><div className="p-5"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">{type}</span><h3 className="mt-4 font-semibold">{title}</h3><p className="mt-2 text-xs text-slate-400">{fileType||'文件'} · 本月更新</p></div></Card>)}</motion.div><CreatePanel open={createOpen} onClose={()=>setCreateOpen(false)} title="上传素材" desc="上传文件并补充名称与分类。"><form onSubmit={addAsset} className="space-y-4"><Field label="素材名称"><input required value={assetForm.title} onChange={e=>setAssetForm({...assetForm,title:e.target.value})} placeholder="输入便于检索的素材名称"/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="所属品牌"><select value={assetForm.brand} onChange={e=>setAssetForm({...assetForm,brand:e.target.value})}><option>创艺装饰</option><option>喜客喜装饰</option></select></Field><Field label="素材分类"><select value={assetForm.type} onChange={e=>setAssetForm({...assetForm,type:e.target.value})}><option>品牌视频</option><option>优秀作品</option><option>设计案例</option><option>原始素材</option><option>品牌文件</option></select></Field></div><label className="block text-xs font-medium text-slate-500">选择文件<input required type="file" accept="image/*,video/*" onChange={e=>{const file=e.target.files?.[0]||null;setAssetFile(file);setAssetForm({...assetForm,fileName:file?.name||''})}} className="mt-2 block w-full rounded-2xl border border-dashed border-emerald-200 bg-[#f6faf4] p-4 text-sm text-slate-500 file:mr-3 file:rounded-xl file:border-0 file:bg-[#dff2d6] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#4f8248]"/></label><SubmitButton label="完成上传" icon={<Upload size={17}/>}/></form></CreatePanel><DetailPanel detail={selectedAsset} onClose={()=>setSelectedAsset(null)}/></>
}

function AiPage(){const [text,setText]=useState('');return <><PageHead eyebrow="AI Workspace" title="AI 品牌助手" desc="结合你的品牌数据、内容资产与项目上下文。"/><Card className="mx-auto max-w-4xl overflow-hidden"><div className="border-b border-slate-100 p-6"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#e4f3dc] text-[#5c9e48]"><WandSparkles size={21}/></span><div><h2 className="font-semibold">BrandFlow AI</h2><p className="text-xs text-slate-400">品牌知识库已连接 · 128 个文件</p></div></div></div><div className="min-h-[380px] p-6"><div className="flex max-w-xl gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-[#e4f3dc] text-[#5c9e48]"><Sparkles size={17}/></span><p className="rounded-3xl rounded-tl-md bg-[#f4f7f2] p-4 text-sm leading-7 text-slate-600">你好，我可以帮你分析两个品牌的数据差异、生成装修短视频脚本，或根据工地素材提出内容选题。</p></div></div><div className="m-4 flex items-end gap-2 rounded-3xl border border-slate-100 bg-[#f8faf7] p-2"><textarea value={text} onChange={e=>setText(e.target.value)} className="min-h-14 flex-1 resize-none bg-transparent p-3 text-sm outline-none" placeholder="输入问题或使用 / 调用数据..."/><motion.button whileHover={{scale:1.05}} className="grid size-11 place-items-center rounded-2xl bg-[#8dcc65] text-white"><ArrowUpRight size={18}/></motion.button></div></Card></>}

function AdminSettingsPage({accessRole}:{accessRole:AccessRole}){
  const [users,setUsers]=useState<AdminUserRow[]>([])
  const [loading,setLoading]=useState(accessRole==='super_admin')
  const [status,setStatus]=useState('')
  const loadUsers=async()=>{
    if(accessRole!=='super_admin')return
    setLoading(true);setStatus('')
    try{
      if(!isSupabaseConfigured){
        setUsers([{user_id:'local-owner',email:'local@brandflow.app',display_name:'本地超级管理员',access_role:'super_admin',created_at:new Date().toISOString()}])
      }else setUsers(await listBrandFlowUsers())
    }catch(error){setStatus(error instanceof Error?error.message:'用户列表加载失败')}
    finally{setLoading(false)}
  }
  useEffect(()=>{loadUsers()},[accessRole])
  if(accessRole!=='super_admin'){
    return <><PageHead eyebrow="Admin Access" title="管理员设置" desc="用户角色与后台访问权限管理。"/><Card className="mx-auto max-w-2xl p-8 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600"><ShieldCheck size={24}/></span><h2 className="mt-5 text-xl font-semibold">无法进入管理员设置</h2><p className="mt-2 text-sm leading-6 text-slate-500">{accessRole==='admin'?'您当前是管理员，只有超级管理员可以进入此页面。':'您是普通用户，请联系管理员添加权限。'}</p></Card></>
  }
  const adminCount=users.filter(user=>user.access_role==='admin').length
  const memberCount=users.filter(user=>user.access_role==='member').length
  const updateRole=async(user:AdminUserRow)=>{
    const nextRole=user.access_role==='admin'?'member':'admin'
    const action=nextRole==='admin'?'设为管理员':'撤销管理员权限'
    if(!window.confirm(`确定将 ${user.display_name||user.email} ${action}吗？`))return
    setStatus('正在更新权限...')
    try{
      await setBrandFlowUserRole(user.user_id,nextRole)
      setStatus('管理员权限已更新')
      await loadUsers()
    }catch(error){setStatus(error instanceof Error?error.message:'权限更新失败')}
  }
  const roleLabel=(role:AccessRole)=>role==='super_admin'?'超级管理员':role==='admin'?'管理员':'普通用户'
  return <><PageHead eyebrow="Admin Access" title="管理员设置" desc="仅超级管理员可查看账号并授予管理员权限。"/>
    <motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 sm:grid-cols-3">
      <Card className="p-5"><span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Crown size={20}/></span><p className="mt-5 text-xs text-slate-400">超级管理员</p><strong className="mt-1 block text-3xl">1</strong><p className="mt-2 text-xs text-slate-400">最早注册账号 · 永久唯一</p></Card>
      <Card className="p-5"><span className="grid size-11 place-items-center rounded-2xl bg-sky-50 text-sky-600"><UserCog size={20}/></span><p className="mt-5 text-xs text-slate-400">管理员</p><strong className="mt-1 block text-3xl">{adminCount} / 2</strong><p className="mt-2 text-xs text-slate-400">最多可设置两名</p></Card>
      <Card className="p-5"><span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Users size={20}/></span><p className="mt-5 text-xs text-slate-400">普通用户</p><strong className="mt-1 block text-3xl">{memberCount}</strong><p className="mt-2 text-xs text-slate-400">新注册账号默认角色</p></Card>
    </motion.div>
    <Card className="mt-4 overflow-hidden"><div className="flex flex-col gap-2 p-6 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">账号与角色</h2><p className="mt-1 text-xs text-slate-400">超级管理员不可转让；达到两名管理员后需先撤销一名。</p></div>{status&&<span className="text-xs text-slate-400">{status}</span>}</div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-[#f7f9f6] text-[11px] text-slate-400"><tr><th className="px-6 py-3 font-medium">用户</th><th className="px-4 py-3 font-medium">邮箱账号</th><th className="px-4 py-3 font-medium">注册时间</th><th className="px-4 py-3 font-medium">当前角色</th><th className="px-6 py-3 text-right font-medium">权限操作</th></tr></thead><tbody>{users.map(user=><tr key={user.user_id} className="border-t border-slate-50 text-sm"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[#dff2d6] text-xs font-bold text-[#4d8648]">{user.display_name.charAt(0).toUpperCase()||'B'}</span><b>{user.display_name}</b></div></td><td className="px-4 py-4 text-slate-500">{user.email}</td><td className="px-4 py-4 text-slate-500">{new Date(user.created_at).toLocaleDateString('zh-CN')}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${user.access_role==='super_admin'?'bg-emerald-50 text-emerald-700':user.access_role==='admin'?'bg-sky-50 text-sky-700':'bg-slate-100 text-slate-500'}`}>{roleLabel(user.access_role)}</span></td><td className="px-6 py-4 text-right">{user.access_role==='super_admin'?<span className="text-xs text-slate-300">系统所有者</span>:<button disabled={user.access_role==='member'&&adminCount>=2} onClick={()=>updateRole(user)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${user.access_role==='admin'?'text-rose-500 hover:bg-rose-50':'text-[#4f8248] hover:bg-[#edf7e8]'}`}>{user.access_role==='admin'?'撤销管理员':'设为管理员'}</button>}</td></tr>)}</tbody></table>{loading&&<div className="py-10 text-center text-sm text-slate-400">正在加载账号...</div>}{!loading&&!users.length&&<div className="py-10 text-center text-sm text-slate-400">暂无账号数据</div>}</div></Card>
  </>
}

function SettingsPage({
  profile,
  onSaveProfile,
  accessRole,
}: {
  profile: UserProfile;
  onSaveProfile: (displayName: string) => Promise<void>;
  accessRole: AccessRole;
}) {
  const [status, setStatus] = useState("");
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [inviteHours, setInviteHours] = useState(24);
  const [inviteUses, setInviteUses] = useState(1);
  const [generatedCode, setGeneratedCode] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const loadInvites = async () => {
    if (!isSupabaseConfigured) return;
    try {
      setInvites(await listBrandFlowInvites());
    } catch (error) {
      setInviteStatus(
        error instanceof Error ? error.message : "邀请码加载失败",
      );
    }
  };
  useEffect(() => setDisplayName(profile.displayName), [profile.displayName]);
  useEffect(() => {
    if (accessRole === "super_admin") loadInvites();
  }, [accessRole]);
  const save = async () => {
    setStatus("正在保存...");
    try {
      await onSaveProfile(displayName);
      setStatus("已同步到云端");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "保存失败");
    }
  };
  const generateInvite = async () => {
    setInviteStatus("正在生成...");
    setGeneratedCode("");
    try {
      const result = await createBrandFlowInvite(inviteHours, inviteUses);
      setGeneratedCode(result.code);
      setInviteStatus("邀请码已生成，仅在这里显示一次");
      await loadInvites();
    } catch (error) {
      setInviteStatus(
        error instanceof Error ? error.message : "邀请码生成失败",
      );
    }
  };
  const copyInvite = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode);
    setInviteStatus("邀请码已复制");
  };
  const revokeInvite = async (id: string) => {
    if (!window.confirm("确定撤销这个邀请码吗？撤销后将无法用于注册。")) return;
    try {
      await revokeBrandFlowInvite(id);
      setInviteStatus("邀请码已撤销");
      await loadInvites();
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : "撤销失败");
    }
  };
  const inviteLabel = (invite: InviteRow) =>
    invite.revoked_at
      ? "已撤销"
      : invite.use_count >= invite.max_uses
        ? "已用完"
        : new Date(invite.expires_at) <= new Date()
          ? "已过期"
          : "可使用";
  return (
    <>
      <PageHead
        eyebrow="Settings"
        title="个人账号设置"
        desc="管理你自己的昵称、头像标识和账号信息。"
      />
      <motion.div
        variants={gridMotion}
        initial="hidden"
        animate="show"
        className="grid gap-4 lg:grid-cols-[.65fr_1.35fr]"
      >
        <Card className="p-6">
          <h2 className="font-semibold">个人资料</h2>
          <div className="mt-6 flex items-center gap-4">
            <ProfileAvatar profile={profile} size="lg" />
            <div>
              <b className="block">{profile.displayName}</b>
              <span className="text-xs text-slate-400">{profile.jobTitle}</span>
              <span
                className={`mt-2 flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${accessRole === "super_admin" ? "bg-emerald-50 text-emerald-700" : accessRole === "admin" ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"}`}
              >
                <ShieldCheck size={12} />
                {accessRole === "super_admin" ? "超级管理员" : accessRole === "admin" ? "管理员" : "普通用户"}
              </span>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h2 className="font-semibold">个人昵称</h2>
          <p className="mt-1 text-xs text-slate-400">
            新账号默认使用邮箱 @ 前面的账号名，修改后头像首字符会同步更新。
          </p>
          <div className="mt-6">
            <Field label="账号昵称">
              <input value={displayName} maxLength={24} onChange={(e) => setDisplayName(e.target.value)} placeholder="输入你的昵称" />
            </Field>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <motion.button
              onClick={save}
              whileHover={{ scale: 1.02 }}
              className="h-11 rounded-2xl bg-[#8dcc65] px-5 text-sm font-semibold text-white"
            >
              保存设置
            </motion.button>
            {status && <span className="text-xs text-slate-400">{status}</span>}
          </div>
        </Card>
        {accessRole === "super_admin" ? (
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                <KeyRound size={20} />
              </span>
              <div>
                <h2 className="font-semibold">注册邀请码</h2>
                <p className="mt-1 text-xs text-slate-400">
                  设置 /
                  注册邀请码。选择有效时间和使用次数后生成，原码只显示一次。
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="有效时间">
                <select
                  value={inviteHours}
                  onChange={(e) => setInviteHours(Number(e.target.value))}
                >
                  <option value={24}>24 小时</option>
                  <option value={72}>3 天</option>
                  <option value={168}>7 天</option>
                </select>
              </Field>
              <Field label="可使用次数">
                <select
                  value={inviteUses}
                  onChange={(e) => setInviteUses(Number(e.target.value))}
                >
                  <option value={1}>1 次</option>
                  <option value={3}>3 次</option>
                  <option value={5}>5 次</option>
                </select>
              </Field>
              <motion.button
                onClick={generateInvite}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="mt-auto flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#8dcc65] px-5 text-sm font-semibold text-white"
              >
                <Plus size={17} />
                生成邀请码
              </motion.button>
            </div>
            {generatedCode && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-5 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-[#f4faf1] p-4 sm:flex-row sm:items-center"
              >
                <div className="flex flex-1 justify-center gap-2 sm:justify-start">
                  {generatedCode.split("").map((digit, index) => (
                    <span
                      key={`${digit}-${index}`}
                      className="grid size-10 place-items-center rounded-xl bg-white text-lg font-semibold text-[#3f7341] shadow-sm"
                    >
                      {digit}
                    </span>
                  ))}
                </div>
                <button
                  onClick={copyInvite}
                  className="flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-semibold text-[#4f8248] shadow-sm"
                >
                  <Copy size={15} />
                  复制
                </button>
              </motion.div>
            )}
            {inviteStatus && (
              <p className="mt-3 text-xs text-slate-400">{inviteStatus}</p>
            )}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead className="text-[11px] text-slate-400">
                  <tr>
                    <th className="pb-3 font-medium">创建时间</th>
                    <th className="pb-3 font-medium">有效期至</th>
                    <th className="pb-3 font-medium">使用情况</th>
                    <th className="pb-3 font-medium">状态</th>
                    <th className="pb-3 text-right font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr
                      key={invite.id}
                      className="border-t border-slate-100 text-sm"
                    >
                      <td className="py-3 text-slate-500">
                        {new Date(invite.created_at).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3 text-slate-500">
                        {new Date(invite.expires_at).toLocaleString("zh-CN", {
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-3">
                        {invite.use_count} / {invite.max_uses}
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${inviteLabel(invite) === "可使用" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                        >
                          {inviteLabel(invite)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          disabled={inviteLabel(invite) !== "可使用"}
                          onClick={() => revokeInvite(invite.id)}
                          className="rounded-xl px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          撤销
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!invites.length && (
                <div className="border-t border-slate-100 py-8 text-center text-xs text-slate-400">
                  还没有生成过邀请码
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-6 lg:col-span-2">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h2 className="font-semibold">成员权限</h2>
                <p className="mt-1 text-xs text-slate-400">
                  当前账号为{accessRole === "admin" ? "管理员" : "普通用户"}，邀请码仅由超级管理员生成和管理。
                </p>
              </div>
            </div>
          </Card>
        )}
      </motion.div>
    </>
  );
}

export default App
