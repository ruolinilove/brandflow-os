import { ArrowUpRight, Database, LogIn, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { hasDataCenterSession, navigateTo } from '../utils/auth'

export function DataCenterButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  const enter = async () => {
    if (loading) return
    setLoading(true)
    try {
      if (await hasDataCenterSession()) navigateTo('/dashboard')
      else setShowLoginPrompt(true)
    } finally {
      setLoading(false)
    }
  }

  return <>
    <motion.button type="button" onClick={enter} disabled={loading} aria-label={loading ? '正在连接数据中心' : '进入数据中心'} whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: .97 }} className={compact
      ? 'hidden h-10 items-center gap-2 whitespace-nowrap rounded-full border border-[#8dcc65]/35 bg-white/85 px-4 text-xs font-semibold text-[#4f8248] backdrop-blur-xl transition hover:bg-[#f1f8ec] disabled:opacity-60 sm:flex sm:px-5'
      : 'group flex h-13 items-center gap-3 rounded-full bg-[#8dcc65] px-6 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(115,169,81,.2)] transition hover:bg-[#7fbd59] disabled:opacity-60'}><Database size={compact ? 15 : 18}/><span className={compact ? 'hidden sm:inline' : ''}>{loading ? '正在连接' : '进入数据中心'}</span>{!compact && <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/>}</motion.button>
    <AnimatePresence>{showLoginPrompt && <LoginPrompt close={() => setShowLoginPrompt(false)}/>}</AnimatePresence>
  </>
}

export function LoginPrompt({ close }: { close: () => void }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[70] grid place-items-center bg-black/25 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <motion.div initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} className="relative w-full max-w-sm rounded-[26px] border border-[#dce8d9] bg-white p-6 text-center shadow-[0_28px_80px_rgba(44,78,48,.2)]">
      <button type="button" onClick={close} aria-label="关闭提示" className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-black/5 text-black/45 hover:bg-black/10"><X size={15}/></button>
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e7f4df] text-[#5f9b46]"><LogIn size={20}/></span><h2 className="mt-4 text-lg font-semibold">请先登录</h2><p className="mt-2 text-sm leading-6 text-black/50">登录后才能进入你的 BrandFlow 数据后台。</p>
      <div className="mt-6 flex gap-3"><button type="button" onClick={close} className="h-11 flex-1 rounded-full border border-black/10 text-sm font-medium text-black/60 hover:bg-black/[.03]">稍后</button><button type="button" onClick={() => navigateTo('/login')} className="h-11 flex-1 rounded-full bg-[#8dcc65] text-sm font-semibold text-white hover:bg-[#7fbd59]">去登录</button></div>
    </motion.div>
  </motion.div>
}
