import { isProductionBuild, isSupabaseConfigured, supabase } from '../lib/supabase'

export const APP_NAVIGATION_EVENT = 'brandflow:navigate'

export function appPath(path: string) {
  const base = import.meta.env.BASE_URL
  return `${base}${path.replace(/^\/+/, '')}`
}

export function navigateTo(path: string, replace = false) {
  const destination = appPath(path)
  if (window.location.pathname === destination) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', destination)
  window.dispatchEvent(new Event(APP_NAVIGATION_EVENT))
}

export async function hasDataCenterSession() {
  if (!isSupabaseConfigured || !supabase) return !isProductionBuild
  const { data } = await supabase.auth.getSession()
  return Boolean(data.session)
}
