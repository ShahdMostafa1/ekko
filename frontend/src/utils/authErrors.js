/**
 * User-facing messages for Supabase Auth errors.
 * Built-in SMTP is ~2–4 emails/hour per project (see Supabase → Authentication → Rate Limits).
 */

export function formatAuthError(message, context = 'auth', t) {
  const m = (message || '').toLowerCase()
  const key = (k) => (t ? t(`auth.errors.${k}`) : message)

  if (m.includes('rate limit') && m.includes('email')) {
    return context === 'resend' ? key('rateLimitResend') : key('rateLimitSignup')
  }

  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already registered')) {
    return key('alreadyRegistered')
  }

  if (m.includes('invalid login credentials')) {
    return key('wrongCredentials')
  }

  if (m.includes('email not confirmed')) {
    return key('emailNotConfirmed')
  }

  if (m.includes('password should contain')) {
    return key('passwordRequirements')
  }

  return message || key('generic')
}
