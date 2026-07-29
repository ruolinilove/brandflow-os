import { ArrowUpRight, Database } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'
import { getDataCenterDestination, navigateTo } from '../utils/auth'

export function DataCenterButton({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false)

  const enter = async () => {
    if (loading) return
    setLoading(true)
    try {
      navigateTo(await getDataCenterDestination())
    } finally {
      setLoading(false)
    }
  }

  return <motion.button
    type="button"
    onClick={enter}
    disabled={loading}
    whileHover={{ y: -2, scale: 1.01 }}
    whileTap={{ scale: .97 }}
    className={compact
      ? 'flex h-10 items-center gap-2 rounded-xl border border-cyan-100/20 bg-cyan-50/10 px-4 text-xs font-semibold text-white backdrop-blur-xl transition hover:bg-cyan-50/18 disabled:opacity-60'
      : 'group flex h-13 items-center gap-3 rounded-2xl border border-cyan-100/35 bg-white/12 px-5 text-sm font-semibold text-white shadow-[0_14px_45px_rgba(15,177,255,.14)] backdrop-blur-xl transition hover:border-cyan-100/55 hover:bg-white/18 disabled:opacity-60'}
  >
    <Database size={compact ? 15 : 18}/>
    <span>{loading ? '正在连接' : '进入数据中心'}</span>
    {!compact && <ArrowUpRight size={17} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"/>}
  </motion.button>
}
