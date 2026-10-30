type AuthAction = 'signin' | 'signup' | 'reset'

const AUTH_ERROR_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials|invalid credentials/i, '邮箱或密码错误，请重新检查后再试。'],
  [/email not confirmed/i, '邮箱尚未确认，请先打开注册邮件完成确认后再登录。'],
  [/user already registered|already been registered/i, '该邮箱已经注册，请直接登录。'],
  [/invalid api key|no api key found/i, '系统登录配置无效，请联系管理员检查 Supabase 密钥。'],
  [/password should be at least|password.*characters/i, '密码长度不足，请至少输入 6 位密码。'],
  [/unable to validate email|invalid.*email|email.*invalid/i, '邮箱格式不正确，请检查后重新输入。'],
  [/email rate limit exceeded|over_email_send_rate_limit/i, '邮件发送次数过多，请稍后再试。'],
  [/for security purposes.*seconds/i, '操作过于频繁，请稍后再试。'],
  [/signup.*disabled|signups not allowed/i, '当前已暂停新用户注册，请联系管理员。'],
  [/database error/i, '邀请码无效、已过期或已被使用。'],
  [/failed to fetch|fetch failed|networkerror|network request failed/i, '无法连接数据库登录服务。请检查网络，或联系管理员确认 Supabase 项目是否已暂停。'],
  [/timeout|timed out/i, '连接登录服务器超时，请稍后重试。'],
]

export function getAuthErrorMessage(error: unknown, action: AuthAction = 'signin') {
  const rawMessage = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : ''

  const translated = AUTH_ERROR_MESSAGES.find(([pattern]) => pattern.test(rawMessage))
  if (translated) return translated[1]

  if (action === 'signup') return '注册失败，请稍后重试或联系管理员。'
  if (action === 'reset') return '密码重置邮件发送失败，请稍后重试。'
  return '登录失败，请检查账号信息和网络后重试。'
}
