import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SubscribeButton({ plan, userId, email, currentPlan, onSuccess, children }) {
  const [loading, setLoading]       = useState(false)
  const [activePlan, setActivePlan] = useState(currentPlan || null)

  useEffect(() => {
    if (currentPlan !== undefined) {
      setActivePlan(currentPlan)
      return
    }
    if (!userId) return
    supabase
      .from('profiles')
      .select('plan, plan_status')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setActivePlan(data.plan || 'free')
      })
  }, [userId, currentPlan])

  const isCurrentPlan = activePlan === plan
  const isHigherPlan  = plan === 'groove' && activePlan === 'studio'

  const handleClick = async () => {
    if (isCurrentPlan) {
      alert(`You're already on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan!`)
      return
    }
    if (isHigherPlan) {
      alert(`You're already on a higher plan (Studio). Visit Billing to manage your subscription.`)
      return
    }
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_API_URL}/stripe/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
        },
        body: JSON.stringify({ plan, user_id: userId, email }),
      })
      if (res.status === 409) {
        alert(`You already have an active ${plan.charAt(0).toUpperCase() + plan.slice(1)} subscription!`)
        return
      }
      const data = await res.json()
      if (data.url) {
        onSuccess?.()
        window.location.href = data.url
      } else {
        alert('Could not start checkout. Please try again.')
      }
    } catch (err) {
      console.error('[ekko] Checkout error:', err)
      alert('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isPrimary = plan === 'studio'
  const label = isCurrentPlan
    ? '✓ Current Plan'
    : isHigherPlan
    ? '✓ On Studio'
    : loading
    ? 'Loading…'
    : children || `Subscribe: ${plan.charAt(0).toUpperCase() + plan.slice(1)}`

  return (
    <button
      onClick={handleClick}
      disabled={loading || isCurrentPlan || isHigherPlan}
      style={{
        padding: '8px 16px',
        borderRadius: '8px',
        border: isCurrentPlan || isHigherPlan ? '1px solid rgba(255,255,255,0.2)' : 'none',
        background: isCurrentPlan || isHigherPlan
          ? 'rgba(255,255,255,0.08)'
          : isPrimary
          ? 'linear-gradient(135deg, #7c3aed, #2563eb)'
          : 'linear-gradient(135deg, #6d28d9, #4f46e5)',
        color: isCurrentPlan || isHigherPlan ? 'rgba(255,255,255,0.45)' : 'white',
        fontSize: '18px',
        fontWeight: 600,
        cursor: isCurrentPlan || isHigherPlan ? 'default' : 'pointer',
        opacity: loading ? 0.7 : 1,
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}