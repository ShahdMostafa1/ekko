import { supabase } from '../lib/supabase'

/** Public admin account identifier — password lives only in Supabase Auth, never in client code. */
export const ADMIN_EMAIL = 'admin@ekko.app'

export async function getAdminSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.access_token) return null
  if (session.user?.email !== ADMIN_EMAIL) return null
  return session
}

export async function signInAdmin(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw error
  if (data.user?.email !== ADMIN_EMAIL) {
    await supabase.auth.signOut()
    throw new Error('This account is not authorized for admin access.')
  }
  return data.session
}

export async function adminApiFetch(path, options = {}) {
  const session = await getAdminSession()
  if (!session) throw new Error('Admin session expired — sign in again.')
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${session.access_token}`,
  }
  return fetch(`${import.meta.env.VITE_API_URL}${path}`, { ...options, headers })
}
