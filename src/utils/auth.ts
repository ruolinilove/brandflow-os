import { isSupabaseConfigured, supabase } from '../lib/supabase'

export const APP_NAVIGATION_EVENT = 'brandflow:navigate'

export function navigateTo(path: string, replace = false) {
  if (window.location.pathname === path) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
  window.dispatchEvent(new Event(APP_NAVIGATION_EVENT))
}

export async function getDataCenterDestination() {
  if (!isSupabaseConfigured || !supabase) return '/dashboard'
  const { data } = await supabase.auth.getSession()
  return data.session ? '/dashboard' : '/login'
}
