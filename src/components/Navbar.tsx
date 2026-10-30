import { motion } from 'framer-motion'
import { Sprout } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DataCenterButton } from './DataCenterButton'
import { HomeAccount } from './HomeAccount'

export function Navbar() {
  const [compact, setCompact] = useState(false)
  const [hidden, setHidden] = useState(false)
  const lastScroll = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const current = window.scrollY
      setCompact(current > 44)
      if (current > 100 && current - lastScroll.current > 8) setHidden(true)
      if (lastScroll.current - current > 8 || current < 40) setHidden(false)
      lastScroll.current = current
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return <motion.header
    animate={{ y: hidden ? '-110%' : 0, opacity: hidden ? 0 : 1 }}
    transition={{ duration: .42, ease: [.22, 1, .36, 1] }}
    className={`fixed inset-x-0 top-0 z-30 border-b border-[#8dcc65]/20 backdrop-blur-2xl transition-[background-color,box-shadow] duration-500 ${compact ? 'bg-white/78 shadow-[0_8px_30px_rgba(55,88,45,.1)]' : 'bg-white/92'}`}
  >
    <nav className={`mx-auto flex w-full min-w-0 max-w-[1440px] items-center justify-between px-4 transition-[height] duration-500 sm:px-8 lg:px-12 ${compact ? 'h-12 sm:h-14' : 'h-14 sm:h-16'}`}>
      <a href="#top" className="flex min-w-0 items-center gap-3 text-black">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#8dcc65] text-white"><Sprout size={17}/></span>
        <span className="hidden min-w-0 sm:block"><b className="block truncate text-sm tracking-[-.02em]">BrandFlow OS</b><small className="block text-[9px] font-semibold uppercase tracking-[.16em] text-black/40">Brand intelligence</small></span>
      </a>
      <div className="flex items-center gap-1 sm:gap-3">
        <a href="#overview" className="hidden h-10 items-center px-3 text-xs font-medium text-black/55 transition hover:text-black sm:flex">概览</a>
        <a href="#space" className="hidden h-10 items-center px-3 text-xs font-medium text-black/55 transition hover:text-black sm:flex">数据空间</a>
        <DataCenterButton compact/>
        <HomeAccount/>
      </div>
    </nav>
  </motion.header>
}
