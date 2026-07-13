import { requireSupabase } from './supabase'

export type BrandCode = 'brandA' | 'brandB'
export type AccessRole = 'super_admin' | 'admin' | 'member'

export type BrandRow = {
  id: string
  code: BrandCode
  name: string
  color: string
}

export type MetricRow = {
  id: number
  brand_id: string
  metric_date: string
  platform: string
  views: number
  shares: number
  follower_growth: number
}

export type InviteRow = {
  id: string
  created_at: string
  expires_at: string
  max_uses: number
  use_count: number
  revoked_at: string | null
}

export type AdminUserRow = {
  user_id: string
  email: string
  display_name: string
  access_role: AccessRole
  created_at: string
}

export type ProfileRow = {
  display_name: string
  role: string
  avatar_url: string | null
}

async function currentUserId() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('请先登录 BrandFlow OS。')
  return data.user.id
}

function assertData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message)
  if (data === null) throw new Error('Supabase 没有返回数据。')
  return data
}

export async function bootstrapBrandFlow() {
  const client = requireSupabase()
  const core = await client.rpc('bootstrap_brandflow')
  if (core.error) throw core.error
  const modules = await client.rpc('bootstrap_brandflow_modules')
  if (modules.error) throw modules.error
}

export async function isBrandFlowAuthorized() {
  const client = requireSupabase()
  const { data, error } = await client.rpc('is_brandflow_authorized')
  if (error) throw error
  return data === true
}

export async function getBrandFlowAccessRole(): Promise<AccessRole> {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_brandflow_access_role')
  if (error) throw error
  return data === 'super_admin' || data === 'admin' ? data : 'member'
}

export async function listBrandFlowUsers() {
  const client = requireSupabase()
  const { data, error } = await client.rpc('list_brandflow_users')
  return assertData(data as AdminUserRow[] | null, error)
}

export async function setBrandFlowUserRole(userId: string, role: 'admin' | 'member') {
  const client = requireSupabase()
  const { error } = await client.rpc('set_brandflow_user_role', {
    target_user: userId,
    target_role: role,
  })
  if (error) throw error
}

export async function saveProfile(displayName: string) {
  const client = requireSupabase()
  const userId = await currentUserId()
  const { data, error } = await client
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', userId)
    .select('display_name, role, avatar_url')
    .single()
  return assertData(data as ProfileRow | null, error)
}

export async function createBrandFlowInvite(validHours = 24, allowedUses = 1) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('create_brandflow_invite', {
    valid_hours: validHours,
    allowed_uses: allowedUses,
  })
  if (error) throw error
  const invite = data?.[0]
  if (!invite) throw new Error('邀请码生成失败。')
  return invite as { code: string; invite_id: string; expires_at: string }
}

export async function listBrandFlowInvites() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('brandflow_invites')
    .select('id, created_at, expires_at, max_uses, use_count, revoked_at')
    .order('created_at', { ascending: false })
  return assertData(data as InviteRow[] | null, error)
}

export async function revokeBrandFlowInvite(id: string) {
  const client = requireSupabase()
  const { error } = await client.rpc('revoke_brandflow_invite', { target_id: id })
  if (error) throw error
}

export async function loadCoreData() {
  const client = requireSupabase()
  const [brandsResult, metricsResult, profileResult] = await Promise.all([
    client.from('brands').select('id, code, name, color').order('code'),
    client.from('metric_entries').select('id, brand_id, metric_date, platform, views, shares, follower_growth').order('metric_date'),
    client.from('profiles').select('display_name, role, avatar_url').maybeSingle(),
  ])
  return {
    brands: assertData(brandsResult.data as BrandRow[] | null, brandsResult.error),
    metrics: assertData(metricsResult.data as MetricRow[] | null, metricsResult.error),
    profile: profileResult.error ? null : profileResult.data,
  }
}

export async function saveBrandName(code: BrandCode, name: string) {
  const client = requireSupabase()
  const ownerId = await currentUserId()
  const { error } = await client.from('brands').update({ name }).eq('owner_id', ownerId).eq('code', code)
  if (error) throw error
}

export async function saveMetric(input: {
  brandCode: BrandCode
  date: string
  views: number
  shares: number
  followerGrowth?: number
  platform?: string
}) {
  const client = requireSupabase()
  const ownerId = await currentUserId()
  const { data: brand, error: brandError } = await client
    .from('brands')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('code', input.brandCode)
    .single()
  if (brandError) throw brandError
  const { data, error } = await client
    .from('metric_entries')
    .upsert({
      owner_id: ownerId,
      brand_id: brand.id,
      metric_date: input.date,
      platform: input.platform ?? 'all',
      views: input.views,
      shares: input.shares,
      follower_growth: input.followerGrowth ?? 0,
    }, { onConflict: 'owner_id,brand_id,metric_date,platform' })
    .select('id, brand_id, metric_date, platform, views, shares, follower_growth')
    .single()
  return assertData(data as MetricRow | null, error)
}

export async function deleteMetric(id: number) {
  const client = requireSupabase()
  const { error } = await client.from('metric_entries').delete().eq('id', id)
  if (error) throw error
}

type OwnedInsert = Record<string, unknown>

async function listOwned(table: string, order = 'created_at') {
  const client = requireSupabase()
  const { data, error } = await client.from(table).select('*').order(order, { ascending: false })
  return assertData(data, error)
}

async function listWithBrand(table: string, order = 'created_at') {
  const client = requireSupabase()
  const { data, error } = await client.from(table).select('*, brands(code, name)').order(order, { ascending: false })
  return assertData(data, error)
}

async function insertOwned(table: string, input: OwnedInsert) {
  const client = requireSupabase()
  const ownerId = await currentUserId()
  const { data, error } = await client.from(table).insert({ ...input, owner_id: ownerId }).select('*').single()
  return assertData(data, error)
}

async function resolveBrandId(code?: BrandCode) {
  if (!code) return null
  const client = requireSupabase()
  const ownerId = await currentUserId()
  const { data, error } = await client.from('brands').select('id').eq('owner_id', ownerId).eq('code', code).single()
  if (error) throw error
  return data.id as string
}

export const plansDb = {
  list: () => listWithBrand('plans', 'due_date'),
  create: async (input: OwnedInsert & { brandCode?: BrandCode }) => {
    const { brandCode, ...row } = input
    return insertOwned('plans', { ...row, brand_id: await resolveBrandId(brandCode) })
  },
}

export const projectsDb = {
  list: () => listWithBrand('projects'),
  create: async (input: OwnedInsert & { brandCode?: BrandCode }) => {
    const { brandCode, ...row } = input
    return insertOwned('projects', { ...row, brand_id: await resolveBrandId(brandCode) })
  },
}

export const contentsDb = {
  list: () => listWithBrand('contents'),
  create: async (input: OwnedInsert & { brandCode?: BrandCode }) => {
    const { brandCode, ...row } = input
    return insertOwned('contents', { ...row, brand_id: await resolveBrandId(brandCode) })
  },
}

export const ideasDb = {
  list: () => listOwned('ideas'),
  create: async (input: OwnedInsert & { brandCode?: BrandCode }) => {
    const { brandCode, ...row } = input
    return insertOwned('ideas', { ...row, brand_id: await resolveBrandId(brandCode) })
  },
}

export const assetsDb = {
  list: () => listWithBrand('assets'),
  create: async (input: OwnedInsert & { brandCode?: BrandCode }) => {
    const { brandCode, ...row } = input
    return insertOwned('assets', { ...row, brand_id: await resolveBrandId(brandCode) })
  },
}

export async function loadGarden() {
  const client = requireSupabase()
  const [stateResult, plotsResult] = await Promise.all([
    client.from('garden_state').select('*').single(),
    client.from('garden_plots').select('*').order('position'),
  ])
  return {
    state: assertData(stateResult.data, stateResult.error),
    plots: assertData(plotsResult.data, plotsResult.error),
  }
}

export async function saveGarden(state: { water: number; coins: number; notice: string }, plots: Array<{
  position: number
  flower: string | null
  stage: number | null
  color: string | null
}>) {
  const client = requireSupabase()
  const ownerId = await currentUserId()
  const [stateResult, plotsResult] = await Promise.all([
    client.from('garden_state').upsert({ owner_id: ownerId, ...state }),
    client.from('garden_plots').upsert(plots.map(plot => ({ owner_id: ownerId, ...plot })), { onConflict: 'owner_id,position' }),
  ])
  if (stateResult.error) throw stateResult.error
  if (plotsResult.error) throw plotsResult.error
}

export async function uploadAsset(file: File) {
  const client = requireSupabase()
  const ownerId = await currentUserId()
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
  const path = `${ownerId}/${crypto.randomUUID()}-${cleanName}`
  const { data, error } = await client.storage.from('brandflow-assets').upload(path, file)
  if (error) throw error
  return data.path
}
