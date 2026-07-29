import { motion, useScroll, useTransform } from 'framer-motion'
import { useEffect } from 'react'
import { Activity, ArrowDown, Database, Radio, ShieldCheck } from 'lucide-react'
import { DataCenterButton } from '../components/DataCenterButton'
import { IceScene } from '../components/IceScene'
import { Navbar } from '../components/Navbar'

const signals = [
  { label: '品牌节点', value: '02', icon: Database },
  { label: '数据链路', value: 'LIVE', icon: Radio },
  { label: '访问协议', value: 'SECURE', icon: ShieldCheck },
]

export function Home() {
  const { scrollYProgress } = useScroll()
  const heroY = useTransform(scrollYProgress, [0, .5], [0, -90])
  const heroOpacity = useTransform(scrollYProgress, [0, .42], [1, .08])
  const signalY = useTransform(scrollYProgress, [.18, .72], [90, -35])

  useEffect(() => {
    document.documentElement.classList.add('immersive-home')
    return () => document.documentElement.classList.remove('immersive-home')
  }, [])

  return <div id="top" className="relative min-h-[225vh] overflow-clip bg-[#061426] text-white selection:bg-cyan-100 selection:text-[#071a31]">
    <IceScene/>
    <div className="pointer-events-none fixed inset-0 z-10 bg-[#020a15]/18"/>
    <Navbar/>

    <main className="relative z-20">
      <section className="relative mx-auto flex min-h-[84vh] max-w-[1440px] items-center px-5 pb-16 pt-28 sm:px-9 lg:px-14">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .2, duration: .7 }} className="mb-6 flex items-center gap-3 text-[10px] font-semibold uppercase text-cyan-100/70 sm:text-xs">
            <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-cyan-300 opacity-60"/><span className="relative inline-flex size-2 rounded-full bg-cyan-200"/></span>
            Public gateway · Brand intelligence
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .32, duration: .82, ease: [.22, 1, .36, 1] }} className="text-5xl font-semibold leading-[.94] text-white sm:text-7xl lg:text-8xl">
            BrandFlow OS
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .46, duration: .72 }} className="mt-7 max-w-xl text-base leading-8 text-cyan-50/68 sm:text-lg">
            品牌经营的未来数据世界。让内容、项目与增长信号在同一个坐标中持续流动。
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .58, duration: .7 }} className="mt-9 flex flex-wrap items-center gap-4">
            <DataCenterButton/>
            <span className="flex items-center gap-2 text-xs text-cyan-100/48"><Activity size={15}/> System online</span>
          </motion.div>
        </motion.div>

        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-cyan-100/45">
          <span className="h-12 w-px bg-cyan-100/22"/>
          <ArrowDown size={14} className="animate-bounce"/>
        </div>
      </section>

      <section className="mx-auto flex min-h-[92vh] max-w-[1440px] items-start px-5 py-14 sm:px-9 sm:py-20 lg:px-14">
        <motion.div style={{ y: signalY }} className="grid w-full gap-12 lg:grid-cols-[1fr_1.15fr] lg:items-end lg:gap-24">
          <div>
            <p className="text-xs font-semibold uppercase text-cyan-100/55">Signal coordinates</p>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-tight sm:text-5xl">双品牌数据，在冰层之下持续汇流。</h2>
            <p className="mt-6 max-w-lg text-sm leading-7 text-cyan-50/58 sm:text-base">公开入口保持开放，内部经营数据由现有身份系统守护。进入后继续使用原来的工作计划、项目、内容与数据中心。</p>
          </div>
          <div className="border-y border-cyan-100/18 bg-[#06172b]/28 backdrop-blur-md">
            {signals.map(({ label, value, icon: Icon }, index) => <motion.div
              key={label}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: .5 }}
              transition={{ delay: index * .1, duration: .55 }}
              className="grid min-h-24 grid-cols-[44px_1fr_auto] items-center gap-4 border-b border-cyan-100/12 px-2 last:border-b-0 sm:grid-cols-[54px_1fr_auto] sm:px-5"
            >
              <span className="grid size-10 place-items-center rounded-xl border border-cyan-100/18 bg-cyan-50/8 text-cyan-100"><Icon size={18}/></span>
              <span className="text-xs text-cyan-50/55">{label}</span>
              <b className="font-mono text-lg text-white sm:text-xl">{value}</b>
            </motion.div>)}
          </div>
        </motion.div>
      </section>

      <section className="mx-auto flex min-h-[40vh] max-w-[1440px] items-end justify-between gap-8 px-5 pb-14 sm:px-9 lg:px-14">
        <div><p className="text-[10px] uppercase text-cyan-100/45">BrandFlow / Guizhou</p><p className="mt-2 text-sm text-cyan-50/65">让数据成为品牌行动的坐标。</p></div>
        <DataCenterButton compact/>
      </section>
    </main>
  </div>
}
