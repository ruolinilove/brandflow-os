import type { Session } from '@supabase/supabase-js'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, KeyRound, LogIn, LogOut, UserRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { navigateTo } from '../utils/auth'

type AuthMode = 'signin' | 'signup'

function accountName(session: Session) {
  const metadataName = session.user.user_metadata?.display_name
  return typeof metadataName === 'string' && metadataName.trim() ? metadataName : session.user.email?.split('@')[0] || 'BrandFlow 用户'
}

export function HomeAccount() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [mode, setMode] = useState<AuthMode>('signin')

  useEffect(() => {
    if (!supabase) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setChecking(false) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setChecking(false)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (checking) return <span className="size-10 animate-pulse rounded-xl border border-cyan-100/15 bg-white/8"/>

  if (session) {
    const name = accountName(session)
    const avatarUrl = session.user.user_metadata?.avatar_url
    return <div className="relative">
      {menuOpen && <button aria-label="关闭账号菜单" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-40 cursor-default"/>}
      <button onClick={() => setMenuOpen(open => !open)} aria-expanded={menuOpen} className="relative z-50 flex h-10 items-center gap-2 rounded-xl border border-cyan-100/20 bg-cyan-50/10 px-2 text-xs font-semibold text-white backdrop-blur-xl transition hover:bg-cyan-50/18 sm:pr-3">
        {avatarUrl ? <img src={avatarUrl} alt={`${name}的头像`} className="size-7 rounded-lg object-cover"/> : <span className="grid size-7 place-items-center rounded-lg bg-cyan-100/15 text-cyan-50">{name.charAt(0).toUpperCase()}</span>}
        <span className="hidden max-w-24 truncate sm:block">{name}</span>
      </button>
      <AnimatePresence>{menuOpen && <motion.div initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: .98 }} className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl border border-cyan-100/18 bg-[#07192e]/94 p-2 text-white shadow-[0_24px_70px_rgba(0,5,18,.48)] backdrop-blur-2xl">
        <div className="border-b border-cyan-100/10 px-3 py-3"><b className="block truncate text-sm">{name}</b><p className="mt-1 truncate text-[10px] text-cyan-100/48">{session.user.email}</p></div>
        <button onClick={() => navigateTo('/dashboard')} className="mt-2 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-xs text-cyan-50/78 transition hover:bg-white/8 hover:text-white"><ArrowRight size={15}/>进入数据中心</button>
        <button onClick={() => supabase?.auth.signOut()} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-xs text-cyan-50/58 transition hover:bg-rose-300/10 hover:text-rose-100"><LogOut size={15}/>退出登录</button>
      </motion.div>}</AnimatePresence>
    </div>
  }

  return <>
    <button onClick={() => setAuthOpen(true)} className="flex h-10 items-center gap-2 rounded-xl border border-cyan-100/20 bg-cyan-50/10 px-3 text-xs font-semibold text-white backdrop-blur-xl transition hover:bg-cyan-50/18" aria-label="登录或注册">
      <UserRound size={15}/><span className="hidden sm:inline">登录 / 注册</span>
    </button>
    {createPortal(<AnimatePresence>{authOpen && <AuthModal mode={mode} setMode={setMode} close={() => setAuthOpen(false)}/>}</AnimatePresence>, document.body)}
  </>
}

function AuthModal({ mode, setMode, close }: { mode: AuthMode; setMode: (mode: AuthMode) => void; close: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase || !isSupabaseConfigured) { navigateTo('/dashboard'); return }
    setLoading(true)
    setMessage('')
    const result = mode === 'signin'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { brandflow_invite_code: inviteCode } } })
    setLoading(false)
    if (result.error) {
      setMessage(result.error.message.includes('Database error') ? '邀请码无效、已过期或已被使用。' : result.error.message)
      return
    }
    if (result.data.session) { close(); navigateTo('/dashboard'); return }
    setMessage('注册成功，请前往邮箱确认后再登录。')
  }

  const resetPassword = async () => {
    if (!supabase || !email.trim()) { setMessage('请先填写注册邮箱。'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/login` })
    setLoading(false)
    setMessage(error ? error.message : '密码重置邮件已发送，请检查邮箱。')
  }

  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80] grid place-items-center bg-[#020811]/72 p-4 backdrop-blur-xl" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
    <motion.div initial={{ opacity: 0, y: 24, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: .98 }} className="relative w-full max-w-md rounded-3xl border border-cyan-100/18 bg-[#081a2f]/96 p-5 text-white shadow-[0_35px_100px_rgba(0,5,20,.62)] sm:p-7">
      <button onClick={close} aria-label="关闭登录窗口" className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl text-cyan-50/55 transition hover:bg-white/8 hover:text-white"><X size={17}/></button>
      <span className="grid size-11 place-items-center rounded-2xl border border-cyan-100/18 bg-cyan-100/10 text-cyan-100"><KeyRound size={19}/></span>
      <h2 className="mt-5 text-xl font-semibold">连接 BrandFlow OS</h2>
      <p className="mt-2 text-xs leading-5 text-cyan-50/48">使用现有账号进入数据中心，或使用管理员邀请码创建账号。</p>
      <div className="mt-6 flex rounded-xl border border-cyan-100/10 bg-black/12 p-1">
        {([['signin', '登录'], ['signup', '注册']] as const).map(([id, label]) => <button type="button" key={id} onClick={() => { setMode(id); setMessage('') }} className={`h-10 flex-1 rounded-lg text-xs font-semibold transition ${mode === id ? 'bg-cyan-50/14 text-white shadow-sm' : 'text-cyan-50/45 hover:text-cyan-50/75'}`}>{label}</button>)}
      </div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <HomeAuthField label="邮箱"><input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com"/></HomeAuthField>
        <HomeAuthField label="密码"><input type="password" required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 6 位密码"/></HomeAuthField>
        {mode === 'signup' && <HomeAuthField label="六位邀请码"><input aria-label="六位邀请码" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={inviteCode} onChange={event => setInviteCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="font-mono text-lg"/></HomeAuthField>}
        {message && <p className={`rounded-xl px-3 py-2.5 text-xs leading-5 ${message.includes('成功') || message.includes('发送') ? 'bg-emerald-300/10 text-emerald-100' : 'bg-rose-300/10 text-rose-100'}`}>{message}</p>}
        <motion.button type="submit" disabled={loading} whileHover={{ y: -1 }} whileTap={{ scale: .98 }} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-100 text-sm font-semibold text-[#082039] transition hover:bg-white disabled:opacity-60"><LogIn size={17}/>{loading ? '请稍候...' : mode === 'signin' ? '登录并进入数据中心' : '使用邀请码注册'}</motion.button>
        {mode === 'signin' && <button type="button" onClick={resetPassword} className="w-full text-center text-[11px] text-cyan-100/45 transition hover:text-cyan-100">忘记密码</button>}
      </form>
    </motion.div>
  </motion.div>
}

function HomeAuthField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs text-cyan-50/55">{label}<div className="mt-2 [&>input]:h-12 [&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-cyan-100/12 [&>input]:bg-black/18 [&>input]:px-4 [&>input]:text-white [&>input]:outline-none [&>input]:transition [&>input]::placeholder:text-cyan-50/25 focus-within:[&>input]:border-cyan-100/35 focus-within:[&>input]:ring-4 focus-within:[&>input]:ring-cyan-100/5">{children}</div></label>
}
