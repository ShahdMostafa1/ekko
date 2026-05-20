import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const API      = import.meta.env.VITE_API_URL;
const APP_URL  = typeof window !== "undefined" ? window.location.origin : "";

// ── Plans — matches your backend exactly: 'groove' | 'studio' ──
const PLANS = [
  {
    id:       "free",
    name:     "Free",
    price:    "$0",
    period:   "forever",
    color:    "#6b7280",
    features: [
      "5 song generations / day",
      "Basic moods & regions",
      "Standard audio quality",
      "Last 10 songs in history",
    ],
  },
  {
    id:       "groove",
    name:     "Groove",
    price:    "$9",
    period:   "/ month",
    color:    "#7c5ce7",
    highlight: true,
    features: [
      "50 song generations / day",
      "All 7 regions & moods",
      "HD audio quality",
      "Full song history",
      "Artist style selection",
      "Priority generation queue",
    ],
  },
  {
    id:       "studio",
    name:     "Studio",
    price:    "$19",
    period:   "/ month",
    color:    "#e07b39",
    features: [
      "Unlimited generations",
      "Everything in Groove",
      "Commercial license",
      "API access",
      "Early feature access",
      "Priority support",
    ],
  },
];

export default function PlansScreen({ onClose }) {
  const [user,          setUser]          = useState(null);
  const [subscription,  setSubscription]  = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error,         setError]         = useState(null);
  const [successMsg,    setSuccessMsg]    = useState(null);

  // ── Load user + subscription ──────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) await fetchSub(user.id);
      setLoading(false);
    })();
  }, []);

  // ── Handle ?payment=success return from Stripe ────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setSuccessMsg("🎉 Payment successful! Your plan is now active.");
      // Re-fetch after a short delay to let webhook process
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await fetchSub(user.id);
      }, 3000);
      // Clean up URL
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("payment") === "cancel") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  async function fetchSub(userId) {
    try {
      const res  = await fetch(`${API}/stripe/status/${userId}`);
      const data = await res.json();
      setSubscription(data);
    } catch {
      setSubscription({ plan: "free", status: "inactive" });
    }
  }

  // ── Upgrade: redirect to Stripe Checkout ──────────────────
  async function handleUpgrade(planId) {
    if (!user || planId === "free") return;
    setActionLoading(planId);
    setError(null);
    try {
      const res = await fetch(`${API}/stripe/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          email:   user.email,
          plan:    planId,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.detail ?? "Could not create checkout session.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  // ── Manage: open Stripe billing portal ────────────────────
  async function handleManage() {
    if (!user) return;
    setActionLoading("portal");
    setError(null);
    try {
      const res = await fetch(`${API}/stripe/create-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.detail ?? "Could not open billing portal.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  const currentPlan = subscription?.plan   ?? "free";
  const isActive    = subscription?.status === "active";

  if (loading) {
    return (
      <div style={s.overlay}>
        <div style={s.container}>
          <div style={s.spinnerLg} />
        </div>
      </div>
    );
  }

  return (
    <div style={s.overlay}>
      <div style={s.container}>
        {/* Close */}
        {onClose && (
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        )}

        {/* Header */}
        <div style={s.header}>
          <h1 style={s.title}>Choose Your Plan</h1>
          <p style={s.subtitle}>Unlock your full sonic potential</p>
        </div>

        {/* Success banner */}
        {successMsg && (
          <div style={s.successBox}>{successMsg}</div>
        )}

        {/* Active plan banner */}
        {isActive && (
          <div style={s.activeBadge}>
            ✅ You're on <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong>
            {subscription?.cancel_at_period_end && " · Cancels at period end"}
            {" · "}
            <button
              style={s.manageLink}
              onClick={handleManage}
              disabled={actionLoading === "portal"}
            >
              {actionLoading === "portal" ? "Opening…" : "Manage billing →"}
            </button>
          </div>
        )}

        {/* Error */}
        {error && <div style={s.errorBox}>{error}</div>}

        {/* Plan cards */}
        <div style={s.cardsRow}>
          {PLANS.map(plan => {
            const isCurrent   = currentPlan === plan.id && (plan.id === "free" || isActive);
            const isUpgrading = actionLoading === plan.id;

            return (
              <div
                key={plan.id}
                style={{
                  ...s.card,
                  border: plan.highlight
                    ? `2px solid ${plan.color}`
                    : "2px solid rgba(255,255,255,0.07)",
                  boxShadow: plan.highlight
                    ? `0 0 28px ${plan.color}2a`
                    : "none",
                }}
              >
                {plan.highlight && (
                  <div style={{ ...s.popularBadge, background: plan.color }}>
                    Most Popular
                  </div>
                )}

                <div style={{ width: 10, height: 10, borderRadius: "50%", background: plan.color }} />
                <h2 style={{ ...s.planName, color: plan.color }}>{plan.name}</h2>

                <div style={s.priceRow}>
                  <span style={s.price}>{plan.price}</span>
                  <span style={s.period}>{plan.period}</span>
                </div>

                <ul style={s.featureList}>
                  {plan.features.map(f => (
                    <li key={f} style={s.featureItem}>
                      <span style={{ color: plan.color, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  style={{
                    ...s.ctaBtn,
                    background: isCurrent
                      ? "rgba(255,255,255,0.06)"
                      : plan.highlight
                        ? plan.color
                        : "transparent",
                    border: isCurrent
                      ? "none"
                      : plan.highlight
                        ? "none"
                        : `2px solid ${plan.color}`,
                    color:  isCurrent ? "#6b7280" : "#fff",
                    cursor: isCurrent ? "default"  : "pointer",
                    opacity: isUpgrading ? 0.7 : 1,
                  }}
                  disabled={isCurrent || isUpgrading}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {isUpgrading
                    ? "Redirecting to Stripe…"
                    : isCurrent
                      ? "Current Plan"
                      : plan.id === "free"
                        ? "Free Forever"
                        : `Upgrade to ${plan.name}`}
                </button>
              </div>
            );
          })}
        </div>

        <p style={s.footer}>
          Payments processed securely by Stripe · Cancel anytime · No hidden fees
        </p>
      </div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const s = {
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.88)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         1000,
    padding:        "20px",
    overflowY:      "auto",
  },
  container: {
    background:   "#111827",
    borderRadius: "24px",
    padding:      "40px 36px",
    maxWidth:     "860px",
    width:        "100%",
    position:     "relative",
    fontFamily:   "'DM Sans','Segoe UI',sans-serif",
  },
  closeBtn: {
    position:   "absolute",
    top:        "18px",
    right:      "20px",
    background: "transparent",
    border:     "none",
    color:      "#6b7280",
    fontSize:   "1.4rem",
    cursor:     "pointer",
  },
  header: {
    textAlign:    "center",
    marginBottom: "28px",
  },
  title: {
    fontSize:   "2rem",
    fontWeight: 700,
    color:      "#f9fafb",
    margin:     "0 0 8px",
  },
  subtitle: {
    color:    "#9ca3af",
    margin:   0,
    fontSize: "1rem",
  },
  successBox: {
    background:   "rgba(52,211,153,0.12)",
    border:       "1px solid rgba(52,211,153,0.35)",
    borderRadius: "12px",
    padding:      "12px 20px",
    color:        "#6ee7b7",
    textAlign:    "center",
    marginBottom: "18px",
    fontSize:     "0.9rem",
  },
  activeBadge: {
    background:   "rgba(124,92,231,0.12)",
    border:       "1px solid rgba(124,92,231,0.3)",
    borderRadius: "12px",
    padding:      "12px 20px",
    color:        "#c4b5fd",
    textAlign:    "center",
    marginBottom: "20px",
    fontSize:     "0.875rem",
  },
  manageLink: {
    background:     "transparent",
    border:         "none",
    color:          "#a78bfa",
    cursor:         "pointer",
    textDecoration: "underline",
    fontSize:       "inherit",
    padding:        0,
  },
  errorBox: {
    background:   "rgba(239,68,68,0.12)",
    border:       "1px solid rgba(239,68,68,0.35)",
    borderRadius: "12px",
    padding:      "12px 20px",
    color:        "#fca5a5",
    textAlign:    "center",
    marginBottom: "18px",
    fontSize:     "0.875rem",
  },
  cardsRow: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap:                 "18px",
    marginBottom:        "28px",
  },
  card: {
    background:   "#1f2937",
    borderRadius: "20px",
    padding:      "26px 22px",
    position:     "relative",
    display:      "flex",
    flexDirection:"column",
    gap:          "10px",
  },
  popularBadge: {
    position:     "absolute",
    top:          "-13px",
    left:         "50%",
    transform:    "translateX(-50%)",
    padding:      "4px 14px",
    borderRadius: "99px",
    fontSize:     "0.72rem",
    fontWeight:   700,
    color:        "#fff",
    whiteSpace:   "nowrap",
  },
  planName: {
    fontSize:   "1.35rem",
    fontWeight: 700,
    margin:     0,
  },
  priceRow: {
    display:    "flex",
    alignItems: "baseline",
    gap:        "6px",
  },
  price: {
    fontSize:   "2rem",
    fontWeight: 800,
    color:      "#f9fafb",
  },
  period: {
    fontSize: "0.85rem",
    color:    "#9ca3af",
  },
  featureList: {
    listStyle: "none",
    margin:    "4px 0 0",
    padding:   0,
    flexGrow:  1,
    display:   "flex",
    flexDirection: "column",
    gap:       "7px",
  },
  featureItem: {
    fontSize: "0.84rem",
    color:    "#d1d5db",
    display:  "flex",
    gap:      "8px",
  },
  ctaBtn: {
    marginTop:    "14px",
    padding:      "13px",
    borderRadius: "12px",
    fontSize:     "0.9rem",
    fontWeight:   600,
    transition:   "opacity 0.2s",
    width:        "100%",
  },
  footer: {
    textAlign: "center",
    color:     "#4b5563",
    fontSize:  "0.78rem",
  },
  spinnerLg: {
    width:        "44px",
    height:       "44px",
    border:       "3px solid rgba(255,255,255,0.08)",
    borderTop:    "3px solid #7c5ce7",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
    margin:       "80px auto",
  },
};