/**
 * Ask backend which sign-in methods exist for an email (Google vs password).
 */
export async function fetchSignInMethods(email) {
  const api = import.meta.env.VITE_API_URL
  if (!api || !email?.trim()) return []

  try {
    const res = await fetch(`${api}/auth/sign-in-methods`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.methods) ? data.methods : []
  } catch {
    return []
  }
}

export function isGoogleOnlyAccount(methods) {
  return methods.includes('google') && !methods.includes('email')
}
