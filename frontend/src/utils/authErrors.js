/**
 * User-facing messages for Supabase Auth errors.
 * Built-in SMTP is ~2–4 emails/hour per project (see Supabase → Authentication → Rate Limits).
 */

export function formatAuthError(message, context = 'auth') {
  const m = (message || '').toLowerCase()

  if (m.includes('rate limit') && m.includes('email')) {
    if (context === 'resend') {
      return 'You can only request a few confirmation emails per hour. Wait 30–60 minutes, then tap Resend again — or use Sign in with Google.'
    }
    return 'Too many signup emails were sent from this project (Supabase email limit). Wait about an hour, sign in with Google, or use a different email. For group testing, your admin can raise the limit in Supabase → Authentication → Rate Limits, or turn off “Confirm email”.'
  }

  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already registered')) {
    return 'This email already has an account. Use Sign in below, or Forgot password if you need to reset it.'
  }

  if (m.includes('invalid login credentials')) {
    return 'Wrong email or password. Double-check your details, or use Forgot password.'
  }

  if (m.includes('email not confirmed')) {
    return 'Please confirm your email first (check your inbox), then sign in.'
  }

  if (m.includes('password should contain')) {
    return 'Please make sure your password meets all the requirements below.'
  }

  return message || 'Something went wrong. Please try again.'
}
