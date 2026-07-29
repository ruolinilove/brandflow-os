import { lazy, Suspense, useEffect, useState } from 'react'
import { APP_NAVIGATION_EVENT, navigateTo } from '../utils/auth'

const DataCenterApp = lazy(() => import('../App'))
const Home = lazy(() => import('../pages/Home').then(module => ({ default: module.Home })))

function normalizedPath() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return path
}

export function AppRouter() {
  const [path, setPath] = useState(normalizedPath)
  const knownPath = path === '/' || path === '/login' || path === '/dashboard'

  useEffect(() => {
    const update = () => setPath(normalizedPath())
    window.addEventListener('popstate', update)
    window.addEventListener(APP_NAVIGATION_EVENT, update)
    return () => {
      window.removeEventListener('popstate', update)
      window.removeEventListener(APP_NAVIGATION_EVENT, update)
    }
  }, [])

  useEffect(() => {
    if (!knownPath) navigateTo('/', true)
  }, [knownPath])

  if (path === '/') return <Suspense fallback={<RouteLoading dark/>}><Home/></Suspense>
  if (path === '/login') return <Suspense fallback={<RouteLoading/>}><DataCenterApp route="login"/></Suspense>
  if (path === '/dashboard') return <Suspense fallback={<RouteLoading/>}><DataCenterApp route="dashboard"/></Suspense>

  return <RouteLoading dark/>
}

function RouteLoading({dark=false}:{dark?:boolean}) {
  return <div className={`grid min-h-screen place-items-center ${dark?'bg-[#061426]':'bg-[#f2f6f2]'}`}><span className={`size-8 animate-spin rounded-full border-2 border-t-transparent ${dark?'border-cyan-200/70':'border-emerald-500'}`}/></div>
}
