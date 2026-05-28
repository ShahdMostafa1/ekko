import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const API = import.meta.env.VITE_API_URL;

const PLANS = [
  {
    id:       "free",
    name:     "Free",
    icon:     "🎧",
    price:    "$0",
    priceAnnual: "$0",
    period:   "forever",
    color:    "#9ca3af",
    glow:     "rgba(156,163,175,0.15)",
    border:   "rgba(156,163,175,0.2)",
    features: [
      "5 song generations / day",
      "Basic moods & regions",
      "Standard audio quality",
      "Last 10 songs in history",
    ],
  },
  {
    id:        "groove",
    name:      "Groove",
    icon:      "🌊",
    price:     "$9",
    priceAnnual: "$7",
    period:    "/ month",
    color:     "#7c5ce7",
    glow:      "rgba(124,92,231,0.2)",
    border:    "rgba(124,92,231,0.45)",
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
    icon:     "🎨",
    price:    "$19",
    priceAnnual: "$15",
    period:   "/ month",
    color:    "#f59e0b",
    glow:     "rgba(245,158,11,0.15)",
    border:   "rgba(245,158,11,0.35)",
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
  const [invoices,      setInvoices]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error,         setError]         = useState(null);
  const [successMsg,    setSuccessMsg]    = useState(null);
  const [showInvoices,  setShowInvoices]  = useState(false);
  const [annual,        setAnnual]        = useState(false);
  const [mounted,       setMounted]       = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        await fetchSub(user.id);
        await fetchInvoices(user.id);
      }
      setLoading(false);
      setTimeout(() => setMounted(true), 60);
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setSuccessMsg("🎉 Payment successful! Your plan is now active. 📧 Check your email for your receipt.");
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) { await fetchSub(user.id); await fetchInvoices(user.id); }
      }, 3000);
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

  async function fetchInvoices(userId) {
    try {
      const res  = await fetch(`${API}/stripe/invoices/${userId}`);
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch {
      setInvoices([]);
    }
  }

  async function handleUpgrade(planId) {
    if (!user || planId === "free") return;
    setActionLoading(planId);
    setError(null);
    try {
      const res = await fetch(`${API}/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, email: user.email, plan: planId }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setSuccessMsg(`✅ You already have an active ${planId.charAt(0).toUpperCase() + planId.slice(1)} subscription!`);
        return;
      }
      if (data.url) window.location.href = data.url;
      else setError(data.detail ?? "Could not create checkout session.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleManage() {
    if (!user) return;
    setActionLoading("portal");
    setError(null);
    try {
      const res = await fetch(`${API}/stripe/portal`, {
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

  async function handleDownloadInvoice(invoiceId, invoiceNumber) {
    if (!user) return;
    setActionLoading(`inv-${invoiceId}`);
    try {
      const res = await fetch(`${API}/stripe/invoice-pdf/${user.id}/${invoiceId}`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = `Invoice-${invoiceNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download invoice.");
    } finally {
      setActionLoading(null);
    }
  }

  const currentPlan   = subscription?.plan   ?? "free";
  const isCancelling  = subscription?.status === "cancelling" || subscription?.cancel_at_period_end;
  const isFullyActive = subscription?.status === "active" && !isCancelling;

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
      <div
        style={{
          ...s.container,
          opacity:   mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "opacity .45s ease, transform .45s ease",
        }}
      >
        {/* Close */}
        {onClose && (
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        )}

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerIconRow}>
            <span style={s.headerIcon}>✨</span>
          </div>
          <h1 style={s.title}>Choose Your Plan</h1>
          <p style={s.subtitle}>Unlock your full sonic potential</p>

          {/* Annual toggle */}
          <div style={s.toggleRow}>
            <span style={{ ...s.toggleLabel, color: !annual ? "#e0d8ff" : "#4b4570" }}>Monthly</span>
            <button
              style={{
                ...s.toggleTrack,
                background: annual ? "#7c5ce7" : "rgba(255,255,255,0.1)",
              }}
              onClick={() => setAnnual(v => !v)}
              aria-label="Toggle annual billing"
            >
              <span
                style={{
                  ...s.toggleThumb,
                  transform: annual ? "translateX(18px)" : "translateX(2px)",
                }}
              />
            </button>
            <span style={{ ...s.toggleLabel, color: annual ? "#e0d8ff" : "#4b4570" }}>
              Annual
              <span style={s.saveBadge}>Save 20%</span>
            </span>
          </div>
        </div>

        {/* Banners */}
        {successMsg && <div style={s.successBox}>{successMsg}</div>}

        {isFullyActive && currentPlan !== "free" && (
          <div style={s.activeBadge}>
            ✅ You're on <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong>
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

        {isCancelling && currentPlan !== "free" && (
          <div style={s.cancellingBadge}>
            ⏳ Your <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong> plan
            is cancelled and will end at the current billing period.
          </div>
        )}

        {error && <div style={s.errorBox}>{error}</div>}

        {/* Plan cards */}
        <div style={s.cardsRow}>
          {PLANS.map((plan, idx) => {
            const isCurrent     = currentPlan === plan.id && (plan.id === "free" ? true : isFullyActive);
            const isUpgrading   = actionLoading === plan.id;
            const displayPrice  = annual && plan.id !== "free" ? plan.priceAnnual : plan.price;

            return (
              <div
                key={plan.id}
                style={{
                  ...s.card,
                  border:     `1.5px solid ${isCurrent && plan.id !== "free" ? plan.color : plan.border}`,
                  background: isCurrent && plan.id !== "free"
                    ? `linear-gradient(160deg, ${plan.glow}, rgba(255,255,255,0.03))`
                    : "rgba(255,255,255,0.03)",
                  boxShadow:  plan.highlight
                    ? `0 0 32px ${plan.glow}, inset 0 1px 0 rgba(255,255,255,.06)`
                    : isCurrent && plan.id !== "free"
                    ? `0 0 24px ${plan.glow}`
                    : "inset 0 1px 0 rgba(255,255,255,.04)",
                  opacity:    mounted ? 1 : 0,
                  transform:  mounted ? "translateY(0)" : "translateY(20px)",
                  transition: `opacity .45s ease ${(idx * 0.08).toFixed(2)}s, transform .45s ease ${(idx * 0.08).toFixed(2)}s, border .2s, box-shadow .2s`,
                }}
              >
                {plan.highlight && (
                  <div style={{ ...s.popularBadge, background: plan.color }}>
                    Most Popular
                  </div>
                )}

                {/* Plan icon + name */}
                <div style={s.cardHeader}>
                  <span style={s.planIcon}>{plan.icon}</span>
                  <h2 style={{ ...s.planName, color: plan.color }}>{plan.name}</h2>
                </div>

                {/* Price */}
                <div style={s.priceRow}>
                  <span style={s.price}>{displayPrice}</span>
                  <div style={s.periodWrap}>
                    <span style={s.period}>{plan.period}</span>
                    {annual && plan.id !== "free" && (
                      <span style={{ ...s.annualNote, color: plan.color }}>billed annually</span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ ...s.divider, background: plan.border }} />

                {/* Features */}
                <ul style={s.featureList}>
                  {plan.features.map(f => (
                    <li key={f} style={s.featureItem}>
                      <span style={{ ...s.checkIcon, color: plan.color }}>✓</span>
                      <span style={s.featureText}>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent && plan.id !== "free" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "auto", paddingTop: "14px" }}>
                    <div style={{ ...s.ctaBtn, background: "rgba(255,255,255,0.05)", color: "#4b5563", textAlign: "center", cursor: "default" }}>
                      ✅ Current Plan
                    </div>
                    <button
                      style={{ ...s.ctaBtn, background: "transparent", border: `1px solid ${plan.color}`, color: plan.color, cursor: "pointer" }}
                      onClick={handleManage}
                      disabled={actionLoading === "portal"}
                    >
                      {actionLoading === "portal" ? "Opening…" : "Manage / Cancel"}
                    </button>
                  </div>
                )}

                {isCurrent && plan.id === "free" && (
                  <div style={{ ...s.ctaBtn, background: "rgba(255,255,255,0.05)", color: "#4b5563", textAlign: "center", cursor: "default", marginTop: "auto", paddingTop: "14px" }}>
                    Current Plan
                  </div>
                )}

                {!isCurrent && plan.id !== "free" && (
                  <button
                    style={{
                      ...s.ctaBtn,
                      background:  plan.highlight
                        ? `linear-gradient(135deg, ${plan.color}cc, ${plan.color})`
                        : "transparent",
                      border:      plan.highlight ? "none" : `1.5px solid ${plan.color}`,
                      color:       "#fff",
                      cursor:      isUpgrading ? "wait" : "pointer",
                      opacity:     isUpgrading ? 0.7 : 1,
                      marginTop:   "auto",
                      paddingTop:  "14px",
                      boxShadow:   plan.highlight && !isUpgrading ? `0 4px 20px ${plan.glow}` : "none",
                    }}
                    disabled={isUpgrading}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {isUpgrading ? "Redirecting…" : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Invoice history */}
        {invoices.length > 0 && (
          <div style={s.invoiceSection}>
            <button style={s.invoiceToggle} onClick={() => setShowInvoices(v => !v)}>
              🧾 Invoice History {showInvoices ? "▲" : "▼"}
            </button>
            {showInvoices && (
              <div style={s.invoiceList}>
                <p style={s.invoiceNote}>
                  📧 Receipts are also emailed to <strong>{user?.email}</strong> after each payment.
                </p>
                {invoices.map(inv => (
                  <div key={inv.id} style={s.invoiceRow}>
                    <div style={s.invoiceInfo}>
                      <span style={s.invoiceNum}>{inv.number}</span>
                      <span style={s.invoiceMeta}>
                        {inv.date} · {inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1)} · ${inv.amount_paid.toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <span style={s.paidBadge}>Paid</span>
                      <button
                        style={s.downloadBtn}
                        onClick={() => handleDownloadInvoice(inv.id, inv.number)}
                        disabled={actionLoading === `inv-${inv.id}`}
                      >
                        {actionLoading === `inv-${inv.id}` ? "⏳" : "⬇ Invoice"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p style={s.footer}>
          Payments processed securely by Stripe · Cancel anytime · No hidden fees
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const s = {
  overlay: {
    position:       "fixed",
    inset:          0,
    background:     "rgba(0,0,0,0.88)",
    backdropFilter: "blur(6px)",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    zIndex:         1000,
    padding:        "20px",
    overflowY:      "auto",
  },
  container: {
    background:    "linear-gradient(160deg, #0d0820 0%, #100c24 50%, #0a0718 100%)",
    borderRadius:  "24px",
    padding:       "36px 32px",
    maxWidth:      "820px",
    width:         "100%",
    position:      "relative",
    fontFamily:    "'DM Sans','Segoe UI',sans-serif",
    maxHeight:     "90vh",
    overflowY:     "auto",
    border:        "1px solid rgba(124,92,231,0.15)",
    boxShadow:     "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
  },
  closeBtn: {
    position:   "absolute",
    top:        "16px",
    right:      "18px",
    background: "rgba(255,255,255,0.06)",
    border:     "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color:      "#6b7280",
    fontSize:   "1rem",
    cursor:     "pointer",
    padding:    "4px 10px",
    transition: "background .15s, color .15s",
  },
  header: {
    textAlign:    "center",
    marginBottom: "28px",
  },
  headerIconRow: {
    marginBottom: "10px",
  },
  headerIcon: {
    fontSize:     "28px",
    display:      "inline-block",
    animation:    "spin 8s linear infinite",
    filter:       "hue-rotate(0deg)",
  },
  title: {
    fontSize:     "1.9rem",
    fontWeight:   800,
    color:        "#e0d8ff",
    margin:       "0 0 6px",
    letterSpacing: "-.02em",
  },
  subtitle: {
    color:    "#6b5f8a",
    margin:   "0 0 18px",
    fontSize: "0.93rem",
  },

  /* Annual toggle */
  toggleRow: {
    display:        "inline-flex",
    alignItems:     "center",
    gap:            "10px",
    background:     "rgba(255,255,255,0.04)",
    border:         "1px solid rgba(255,255,255,0.08)",
    borderRadius:   "99px",
    padding:        "6px 14px",
  },
  toggleLabel: {
    fontSize:   "13px",
    fontWeight: 600,
    transition: "color .2s",
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
  },
  toggleTrack: {
    width:        "38px",
    height:       "20px",
    borderRadius: "99px",
    border:       "none",
    cursor:       "pointer",
    position:     "relative",
    transition:   "background .25s",
    padding:      0,
    flexShrink:   0,
  },
  toggleThumb: {
    position:     "absolute",
    top:          "2px",
    width:        "16px",
    height:       "16px",
    borderRadius: "50%",
    background:   "#fff",
    transition:   "transform .22s cubic-bezier(.34,1.56,.64,1)",
    display:      "block",
  },
  saveBadge: {
    background:   "rgba(124,92,231,0.2)",
    border:       "1px solid rgba(124,92,231,0.3)",
    color:        "#a78bfa",
    borderRadius: "99px",
    padding:      "2px 8px",
    fontSize:     "11px",
    fontWeight:   700,
  },

  successBox: {
    background:   "rgba(52,211,153,0.1)",
    border:       "1px solid rgba(52,211,153,0.3)",
    borderRadius: "12px",
    padding:      "12px 18px",
    color:        "#6ee7b7",
    textAlign:    "center",
    marginBottom: "16px",
    fontSize:     "0.875rem",
  },
  activeBadge: {
    background:   "rgba(124,92,231,0.1)",
    border:       "1px solid rgba(124,92,231,0.25)",
    borderRadius: "12px",
    padding:      "10px 18px",
    color:        "#c4b5fd",
    textAlign:    "center",
    marginBottom: "18px",
    fontSize:     "0.85rem",
  },
  cancellingBadge: {
    background:   "rgba(245,158,11,0.08)",
    border:       "1px solid rgba(245,158,11,0.25)",
    borderRadius: "12px",
    padding:      "10px 18px",
    color:        "#fde68a",
    textAlign:    "center",
    marginBottom: "18px",
    fontSize:     "0.85rem",
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
    background:   "rgba(239,68,68,0.1)",
    border:       "1px solid rgba(239,68,68,0.3)",
    borderRadius: "12px",
    padding:      "10px 18px",
    color:        "#fca5a5",
    textAlign:    "center",
    marginBottom: "16px",
    fontSize:     "0.875rem",
  },

  /* Cards */
  cardsRow: {
    display:             "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap:                 "16px",
    marginBottom:        "28px",
  },
  card: {
    borderRadius:  "20px",
    padding:       "24px 20px",
    position:      "relative",
    display:       "flex",
    flexDirection: "column",
    gap:           "0",
  },
  popularBadge: {
    position:     "absolute",
    top:          "-12px",
    left:         "50%",
    transform:    "translateX(-50%)",
    padding:      "4px 14px",
    borderRadius: "99px",
    fontSize:     "0.7rem",
    fontWeight:   800,
    color:        "#fff",
    whiteSpace:   "nowrap",
    letterSpacing: ".05em",
  },
  cardHeader: {
    display:     "flex",
    alignItems:  "center",
    gap:         "10px",
    marginBottom: "12px",
  },
  planIcon: {
    fontSize:     "22px",
    lineHeight:   1,
  },
  planName: {
    fontSize:   "1.2rem",
    fontWeight: 800,
    margin:     0,
    letterSpacing: "-.01em",
  },
  priceRow: {
    display:     "flex",
    alignItems:  "baseline",
    gap:         "6px",
    marginBottom: "14px",
  },
  price: {
    fontSize:   "2.1rem",
    fontWeight: 800,
    color:      "#f0ebff",
    lineHeight: 1,
  },
  periodWrap: {
    display:       "flex",
    flexDirection: "column",
    gap:           "2px",
  },
  period: {
    fontSize: "0.82rem",
    color:    "#4b4570",
  },
  annualNote: {
    fontSize:   "0.7rem",
    fontWeight: 600,
    opacity:    0.85,
  },
  divider: {
    height:       "1px",
    marginBottom: "14px",
    opacity:      0.5,
  },
  featureList: {
    listStyle:     "none",
    margin:        0,
    padding:       0,
    flexGrow:      1,
    display:       "flex",
    flexDirection: "column",
    gap:           "8px",
  },
  featureItem: {
    display:    "flex",
    gap:        "8px",
    alignItems: "flex-start",
  },
  checkIcon: {
    fontSize:   "12px",
    flexShrink: 0,
    marginTop:  "2px",
    fontWeight: 800,
  },
  featureText: {
    fontSize: "0.83rem",
    color:    "#c4b5f0",
    lineHeight: 1.4,
  },
  ctaBtn: {
    padding:      "13px",
    borderRadius: "13px",
    fontSize:     "0.88rem",
    fontWeight:   700,
    transition:   "opacity 0.2s, transform 0.15s",
    width:        "100%",
    fontFamily:   "'DM Sans','Segoe UI',sans-serif",
    display:      "block",
    boxSizing:    "border-box",
  },

  /* Invoices */
  invoiceSection: {
    borderTop:    "1px solid rgba(255,255,255,0.06)",
    paddingTop:   "20px",
    marginBottom: "20px",
  },
  invoiceToggle: {
    background:   "transparent",
    border:       "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    color:        "#6b5f8a",
    padding:      "10px 16px",
    cursor:       "pointer",
    fontSize:     "0.85rem",
    width:        "100%",
    textAlign:    "left",
    marginBottom: "12px",
    fontFamily:   "'DM Sans','Segoe UI',sans-serif",
    transition:   "border-color .18s, color .18s",
  },
  invoiceNote: {
    fontSize:     "0.78rem",
    color:        "#4b4570",
    margin:       "0 0 12px",
    padding:      "10px 14px",
    background:   "rgba(124,92,231,0.06)",
    borderRadius: "8px",
    border:       "1px solid rgba(124,92,231,0.12)",
  },
  invoiceList: {
    display:       "flex",
    flexDirection: "column",
    gap:           "8px",
  },
  invoiceRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    background:     "rgba(255,255,255,0.03)",
    border:         "1px solid rgba(255,255,255,0.06)",
    borderRadius:   "10px",
    padding:        "12px 14px",
    gap:            "12px",
  },
  invoiceInfo: {
    display:       "flex",
    flexDirection: "column",
    gap:           "3px",
    flex:          1,
    minWidth:      0,
  },
  invoiceNum: {
    fontSize:     "0.83rem",
    fontWeight:   600,
    color:        "#e0d8ff",
    whiteSpace:   "nowrap",
    overflow:     "hidden",
    textOverflow: "ellipsis",
  },
  invoiceMeta: {
    fontSize: "0.72rem",
    color:    "#4b4570",
  },
  paidBadge: {
    background:   "rgba(52,211,153,0.12)",
    border:       "1px solid rgba(52,211,153,0.25)",
    color:        "#6ee7b7",
    borderRadius: "6px",
    padding:      "3px 10px",
    fontSize:     "0.72rem",
    fontWeight:   600,
    whiteSpace:   "nowrap",
  },
  downloadBtn: {
    background:   "rgba(124,92,231,0.12)",
    border:       "1px solid rgba(124,92,231,0.25)",
    color:        "#a78bfa",
    borderRadius: "6px",
    padding:      "4px 12px",
    fontSize:     "0.72rem",
    fontWeight:   600,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    fontFamily:   "'DM Sans','Segoe UI',sans-serif",
  },
  footer: {
    textAlign:  "center",
    color:      "#2d2645",
    fontSize:   "0.75rem",
    marginTop:  "8px",
  },
  spinnerLg: {
    width:        "40px",
    height:       "40px",
    border:       "3px solid rgba(255,255,255,0.06)",
    borderTop:    "3px solid #7c5ce7",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
    margin:       "80px auto",
  },
};