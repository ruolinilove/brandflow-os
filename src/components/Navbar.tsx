import { motion } from 'framer-motion'
import { Snowflake } from 'lucide-react'
import { DataCenterButton } from './DataCenterButton'
import { HomeAccount } from './HomeAccount'

export function Navbar() {
  return <motion.header
    initial={{ opacity: 0, y: -18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: .7, ease: [.22, 1, .36, 1] }}
    className="fixed inset-x-0 top-0 z-30 px-3 pt-3 sm:px-6 sm:pt-5"
  >
    <nav className="mx-auto flex h-15 max-w-[1440px] items-center justify-between rounded-2xl border border-white/15 bg-[#06172b]/48 px-3 shadow-[0_18px_60px_rgba(0,9,24,.28)] backdrop-blur-2xl sm:px-5">
      <a href="#top" className="flex min-w-0 items-center gap-3 text-white">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-cyan-100/25 bg-cyan-100/10 text-cyan-100"><Snowflake size={18}/></span>
        <span className="hidden min-w-0 sm:block"><b className="block truncate text-sm">BrandFlow OS</b><small className="block text-[9px] font-semibold uppercase text-cyan-100/55">Data world gateway</small></span>
      </a>
      <div className="flex items-center gap-1 sm:gap-3">
        <a href="#top" className="hidden h-10 items-center px-3 text-xs font-medium text-cyan-50/75 transition hover:text-white sm:flex">首页</a>
        <DataCenterButton compact/>
        <HomeAccount/>
      </div>
    </nav>
  </motion.header>
}
