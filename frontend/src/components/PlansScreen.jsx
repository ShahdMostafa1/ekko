import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { canUseApiAccess } from "../utils/planUtils";

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
      "2 free artists + next 5 in list via XP (2,500 each)",
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
      "All artist styles (every region)",
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

export default function PlansScreen({ onClose, onPlanChange }) {
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
  const [apiKeyInfo,    setApiKeyInfo]    = useState(null);
  const [revealedKey,   setRevealedKey]   = useState(null);
  const [copiedKey,     setCopiedKey]     = useState(false);

  async function fetchApiKeyInfo(userId) {
    try {
      const res  = await fetch(`${API}/stripe/api-key/${userId}`);
      const data = await res.json();
      setApiKeyInfo(data);
    } catch {
      setApiKeyInfo(null);
    }
  }

  async function handleApiKey() {
    if (!user) return;
    setActionLoading("api-key"); setError(null);
    try {
      const res  = await fetch(`${API}/stripe/api-key`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Could not create API key.");
      setRevealedKey(data.api_key);
      await fetchApiKeyInfo(user.id);
    } catch (e) {
      setError(e.message || "API key error.");
    } finally {
      setActionLoading(null);
    }
  }

  async function copyApiKey(key) {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        await fetchSub(user.id);
        await fetchInvoices(user.id);
        await fetchApiKeyInfo(user.id);
      }
      setLoading(false);
      setTimeout(() => setMounted(true), 60);
    })();
  }, []);

  useEffect(() => {
    if (subscription?.plan && onPlanChange) {
      onPlanChange(subscription.plan);
    }
    if (subscription?.plan === "studio" && user?.id) {
      fetchApiKeyInfo(user.id);
    }
  }, [subscription?.plan, onPlanChange, user?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "success") {
      setSuccessMsg("🎉 Payment successful! Your plan is now active. 📧 Check your email for your receipt.");
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await fetchSub(user.id);
          await fetchInvoices(user.id);
        }
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
    setActionLoading(planId); setError(null);
    try {
      const res = await fetch(`${API}/stripe/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, email: user.email, plan: planId }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setSuccessMsg(`✅ You already have an active ${planId.charAt(0).toUpperCase() + planId.slice(1)} subscription!`);
        return;
      }
      if (data.url) window.location.href = data.url;
      else setError(data.detail ?? "Could not create checkout session.");
    } catch { setError("Network error. Please try again."); }
    finally { setActionLoading(null); }
  }

  async function handleManage() {
    if (!user) return;
    setActionLoading("portal"); setError(null);
    try {
      const res = await fetch(`${API}/stripe/portal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setError(data.detail ?? "Could not open billing portal.");
    } catch { setError("Network error. Please try again."); }
    finally { setActionLoading(null); }
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
    } catch { setError("Could not download invoice."); }
    finally { setActionLoading(null); }
  }

  const currentPlan   = subscription?.plan   ?? "free";
  const isCancelling  = subscription?.status === "cancelling" || subscription?.cancel_at_period_end;
  const isFullyActive = subscription?.status === "active" && !isCancelling;

  if (loading) return (
    <div style={s.page}>
      <div style={s.spinnerLg} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div className="plans-page" style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        ...s.header,
        opacity:   mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(12px)",
        transition: "opacity .4s ease, transform .4s ease",
      }}>
        <div style={{ fontSize: 37, marginBottom: 8 }}>✨</div>
        <h1 className="plans-title" style={s.title}>Choose Your Plan</h1>
        <p style={s.subtitle}>Unlock your full sonic potential</p>

        {/* Annual toggle */}
        <div style={s.toggleRow}>
          <span style={{ ...s.toggleLabel, color: !annual ? "#e0d8ff" : "#4b4570" }}>Monthly</span>
          <button
            style={{ ...s.toggleTrack, background: annual ? "#7c5ce7" : "rgba(255,255,255,0.1)" }}
            onClick={() => setAnnual(v => !v)}
          >
            <span style={{ ...s.toggleThumb, transform: annual ? "translateX(18px)" : "translateX(2px)" }} />
          </button>
          <span style={{ ...s.toggleLabel, color: annual ? "#e0d8ff" : "#4b4570" }}>
            Annual <span style={s.saveBadge}>Save 20%</span>
          </span>
        </div>
      </div>

      {/* Banners */}
      {successMsg && <div style={{ ...s.banner, ...s.successBanner }}>{successMsg}</div>}
      {isFullyActive && currentPlan !== "free" && (
        <div style={{ ...s.banner, ...s.activeBanner }}>
          ✅ You're on <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong>
          {" · "}
          <button style={s.manageLink} onClick={handleManage} disabled={actionLoading === "portal"}>
            {actionLoading === "portal" ? "Opening…" : "Manage billing →"}
          </button>
        </div>
      )}
      {isCancelling && currentPlan !== "free" && (
        <div style={{ ...s.banner, ...s.cancelBanner }}>
          ⏳ Your <strong>{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</strong> plan
          is cancelled and will end at the current billing period.
        </div>
      )}
      {error && <div style={{ ...s.banner, ...s.errorBanner }}>{error}</div>}

      {canUseApiAccess(currentPlan) && isFullyActive && (
        <div style={s.apiKeyBox}>
          <div style={s.apiKeyHeader}>
            <span style={{ fontSize: 23 }}>🔑</span>
            <div>
              <p style={s.apiKeyTitle}>Studio API Access</p>
              <p style={s.apiKeySub}>
                Use <code style={s.apiCode}>X-Ekko-API-Key</code> on{' '}
                <code style={s.apiCode}>/api/v1/*</code> endpoints
              </p>
            </div>
          </div>
          {revealedKey ? (
            <div style={s.apiKeyReveal}>
              <code style={s.apiKeyFull}>{revealedKey}</code>
              <button
                type="button"
                style={s.apiKeyCopyBtn}
                onClick={() => copyApiKey(revealedKey)}
              >
                {copiedKey ? "Copied!" : "Copy key"}
              </button>
            </div>
          ) : apiKeyInfo?.has_key ? (
            <p style={s.apiKeyMasked}>Active key: {apiKeyInfo.masked_key}</p>
          ) : (
            <p style={s.apiKeyMuted}>No API key yet — generate one to use the REST API.</p>
          )}
          <button
            type="button"
            style={s.apiKeyBtn}
            onClick={() => handleApiKey()}
            disabled={actionLoading === "api-key"}
          >
            {actionLoading === "api-key"
              ? "Working…"
              : apiKeyInfo?.has_key
              ? "Rotate API key"
              : "Generate API key"}
          </button>
        </div>
      )}

      {/* Cards — horizontal row */}
      <div
        className="plans-cards-row"
        style={{
        ...s.cardsRow,
        opacity:   mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(20px)",
        transition: "opacity .45s ease .1s, transform .45s ease .1s",
      }}>
        {PLANS.map(plan => {
          const isCurrent   = currentPlan === plan.id && (plan.id === "free" ? true : isFullyActive);
          const isUpgrading = actionLoading === plan.id;
          const displayPrice = annual && plan.id !== "free" ? plan.priceAnnual : plan.price;

          return (
            <div key={plan.id} style={{
              ...s.card,
              border:     `1.5px solid ${isCurrent && plan.id !== "free" ? plan.color : plan.border}`,
              background: isCurrent && plan.id !== "free"
                ? `linear-gradient(160deg, ${plan.glow}, rgba(255,255,255,0.03))`
                : "rgba(255,255,255,0.03)",
              boxShadow: plan.highlight
                ? `0 0 32px ${plan.glow}, inset 0 1px 0 rgba(255,255,255,.06)`
                : isCurrent && plan.id !== "free"
                ? `0 0 24px ${plan.glow}`
                : "inset 0 1px 0 rgba(255,255,255,.04)",
            }}>
              {plan.highlight && (
                <div style={{ ...s.popularBadge, background: plan.color }}>Most Popular</div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 27 }}>{plan.icon}</span>
                <h2 style={{ ...s.planName, color: plan.color }}>{plan.name}</h2>
              </div>

              <div style={s.priceRow}>
                <span style={s.price}>{displayPrice}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={s.period}>{plan.period}</span>
                  {annual && plan.id !== "free" && (
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, color: plan.color, opacity: .85 }}>
                      billed annually
                    </span>
                  )}
                </div>
              </div>

              <div style={{ height: 1, background: plan.border, margin: "12px 0", opacity: .5 }} />

              <ul style={s.featureList}>
                {plan.features.map(f => (
                  <li key={f} style={s.featureItem}>
                    <span style={{ color: plan.color, flexShrink: 0, fontSize: 17, fontWeight: 800 }}>✓</span>
                    <span style={{ fontSize: "0.83rem", color: "#c4b5f0", lineHeight: 1.4 }}>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTAs */}
              {isCurrent && plan.id !== "free" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: "auto", paddingTop: 14 }}>
                  <div style={{ ...s.ctaBtn, background: "rgba(255,255,255,0.05)", color: "#4b5563", textAlign: "center", cursor: "default" }}>
                    ✅ Current Plan
                  </div>
                  <button
                    style={{ ...s.ctaBtn, background: "transparent", border: `1px solid ${plan.color}`, color: plan.color, cursor: "pointer" }}
                    onClick={handleManage} disabled={actionLoading === "portal"}
                  >
                    {actionLoading === "portal" ? "Opening…" : "Manage / Cancel"}
                  </button>
                </div>
              )}
              {isCurrent && plan.id === "free" && (
                <div style={{ ...s.ctaBtn, background: "rgba(255,255,255,0.05)", color: "#4b5563", textAlign: "center", cursor: "default", marginTop: "auto", paddingTop: 14 }}>
                  Current Plan
                </div>
              )}
              {!isCurrent && plan.id !== "free" && (
                <button
                  style={{
                    ...s.ctaBtn,
                    background: `linear-gradient(135deg, ${plan.color}dd, ${plan.color})`,
                    border: "none",
                    color: "#fff",
                    cursor: isUpgrading ? "wait" : "pointer",
                    opacity: isUpgrading ? 0.7 : 1,
                    marginTop: "auto",
                    paddingTop: 14,
                    boxShadow: !isUpgrading ? `0 4px 20px ${plan.glow}` : "none",
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={s.invoiceNote}>
                📧 Receipts are also emailed to <strong>{user?.email}</strong> after each payment.
              </p>
              {invoices.map(inv => (
                <div key={inv.id} className="plans-invoice-row" style={s.invoiceRow}>
                  <div style={s.invoiceInfo}>
                    <span style={s.invoiceNum}>{inv.number}</span>
                    <span style={s.invoiceMeta}>
                      {inv.date} · {inv.plan.charAt(0).toUpperCase() + inv.plan.slice(1)} · ${inv.amount_paid.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .plans-cards-row { grid-template-columns: 1fr !important; max-width: 440px; margin-left: auto; margin-right: auto; }
        }
        @media (max-width: 600px) {
          .plans-title { font-size: 1.65rem !important; }
          .plans-page { padding-bottom: 32px !important; }
          .plans-invoice-row {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </div>
  );
}

const s = {
  page: {
    width: "100%",
    maxWidth: 1200,
    margin: "0 auto",
    padding: "0 0 48px",
    fontFamily: "'DM Sans','Segoe UI',sans-serif",
  },
  backBtn: {
    display:      "inline-flex",
    alignItems:   "center",
    gap:          8,
    background:   "rgba(255,255,255,0.05)",
    border:       "1px solid rgba(255,255,255,0.1)",
    borderRadius: 50,
    padding:      "8px 18px",
    color:        "#8b7eb8",
    fontSize:     18,
    fontWeight:   600,
    cursor:       "pointer",
    marginBottom: 24,
    transition:   "background .2s, color .2s",
    fontFamily:   "'DM Sans',sans-serif",
  },
  header: {
    textAlign:    "center",
    marginBottom: 28,
  },
  title: {
    fontSize:      "2.4rem",
    fontWeight:    800,
    color:         "#e0d8ff",
    margin:        "0 0 6px",
    letterSpacing: "-.02em",
    fontFamily:    "'Syne',sans-serif",
  },
  subtitle: {
    color:    "#6b5f8a",
    margin:   "0 0 20px",
    fontSize: "0.93rem",
  },
  toggleRow: {
    display:        "inline-flex",
    alignItems:     "center",
    gap:            10,
    background:     "rgba(255,255,255,0.04)",
    border:         "1px solid rgba(255,255,255,0.08)",
    borderRadius:   99,
    padding:        "6px 14px",
  },
  toggleLabel: {
    fontSize:   18,
    fontWeight: 600,
    transition: "color .2s",
    display:    "flex",
    alignItems: "center",
    gap:        6,
  },
  toggleTrack: {
    width:        38,
    height:       20,
    borderRadius: 99,
    border:       "none",
    cursor:       "pointer",
    position:     "relative",
    transition:   "background .25s",
    padding:      0,
    flexShrink:   0,
  },
  toggleThumb: {
    position:     "absolute",
    top:          2,
    width:        16,
    height:       16,
    borderRadius: "50%",
    background:   "#fff",
    transition:   "transform .22s cubic-bezier(.34,1.56,.64,1)",
    display:      "block",
  },
  saveBadge: {
    background:   "rgba(124,92,231,0.2)",
    border:       "1px solid rgba(124,92,231,0.3)",
    color:        "#a78bfa",
    borderRadius: 99,
    padding:      "2px 8px",
    fontSize:     16,
    fontWeight:   700,
  },
  banner: {
    borderRadius: 12,
    padding:      "12px 18px",
    textAlign:    "center",
    marginBottom: 16,
    fontSize:     "0.875rem",
  },
  successBanner: {
    background: "rgba(52,211,153,0.1)",
    border:     "1px solid rgba(52,211,153,0.3)",
    color:      "#6ee7b7",
  },
  activeBanner: {
    background: "rgba(124,92,231,0.1)",
    border:     "1px solid rgba(124,92,231,0.25)",
    color:      "#c4b5fd",
  },
  cancelBanner: {
    background: "rgba(245,158,11,0.08)",
    border:     "1px solid rgba(245,158,11,0.25)",
    color:      "#fde68a",
  },
  errorBanner: {
    background: "rgba(239,68,68,0.1)",
    border:     "1px solid rgba(239,68,68,0.3)",
    color:      "#fca5a5",
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
  cardsRow: {
    display:             "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap:                 28,
    marginBottom:        28,
    alignItems:          "stretch",
  },
  card: {
    borderRadius:  24,
    padding:       "36px 32px",
    position:      "relative",
    display:       "flex",
    flexDirection: "column",
    minHeight:     420,
  },
  popularBadge: {
    position:      "absolute",
    top:           -13,
    left:          "50%",
    transform:     "translateX(-50%)",
    padding:       "4px 14px",
    borderRadius:  99,
    fontSize:      "0.7rem",
    fontWeight:    800,
    color:         "#fff",
    whiteSpace:    "nowrap",
    letterSpacing: ".05em",
  },
  planName: {
    fontSize:   "1.35rem",
    fontWeight: 800,
    margin:     0,
  },
  priceRow: {
    display:     "flex",
    alignItems:  "baseline",
    gap:         6,
    marginBottom: 4,
  },
  price: {
    fontSize:   "2.6rem",
    fontWeight: 800,
    color:      "#f0ebff",
    lineHeight: 1,
  },
  period: {
    fontSize: "0.82rem",
    color:    "#4b4570",
  },
  featureList: {
    listStyle:     "none",
    margin:        0,
    padding:       0,
    flexGrow:      1,
    display:       "flex",
    flexDirection: "column",
    gap:           8,
  },
  featureItem: {
    display:    "flex",
    gap:        8,
    alignItems: "flex-start",
  },
  ctaBtn: {
    padding:      13,
    borderRadius: 13,
    fontSize:     "0.88rem",
    fontWeight:   700,
    transition:   "opacity 0.2s, transform 0.15s",
    width:        "100%",
    fontFamily:   "'DM Sans',sans-serif",
    display:      "block",
    boxSizing:    "border-box",
  },
  invoiceSection: {
    borderTop:    "1px solid rgba(255,255,255,0.06)",
    paddingTop:   20,
    marginBottom: 20,
  },
  invoiceToggle: {
    background:   "transparent",
    border:       "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
    color:        "#6b5f8a",
    padding:      "10px 16px",
    cursor:       "pointer",
    fontSize:     "0.85rem",
    width:        "100%",
    textAlign:    "left",
    marginBottom: 12,
    fontFamily:   "'DM Sans',sans-serif",
  },
  invoiceNote: {
    fontSize:     "0.78rem",
    color:        "#4b4570",
    margin:       "0 0 12px",
    padding:      "10px 14px",
    background:   "rgba(124,92,231,0.06)",
    borderRadius: 8,
    border:       "1px solid rgba(124,92,231,0.12)",
  },
  invoiceRow: {
    display:        "flex",
    justifyContent: "space-between",
    alignItems:     "center",
    background:     "rgba(255,255,255,0.03)",
    border:         "1px solid rgba(255,255,255,0.06)",
    borderRadius:   10,
    padding:        "12px 14px",
    gap:            12,
  },
  invoiceInfo: {
    display:       "flex",
    flexDirection: "column",
    gap:           3,
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
    borderRadius: 6,
    padding:      "3px 10px",
    fontSize:     "0.72rem",
    fontWeight:   600,
    whiteSpace:   "nowrap",
  },
  downloadBtn: {
    background:   "rgba(124,92,231,0.12)",
    border:       "1px solid rgba(124,92,231,0.25)",
    color:        "#a78bfa",
    borderRadius: 6,
    padding:      "4px 12px",
    fontSize:     "0.72rem",
    fontWeight:   600,
    cursor:       "pointer",
    whiteSpace:   "nowrap",
    fontFamily:   "'DM Sans',sans-serif",
  },
  footer: {
    textAlign:  "center",
    color:      "#2d2645",
    fontSize:   "0.75rem",
    marginTop:  8,
  },
  apiKeyBox: {
    margin:       "0 auto 24px",
    maxWidth:     640,
    padding:      "16px 18px",
    background:   "rgba(245,158,11,0.06)",
    border:       "1px solid rgba(245,158,11,0.22)",
    borderRadius: 14,
  },
  apiKeyHeader: {
    display:    "flex",
    alignItems: "flex-start",
    gap:        12,
    marginBottom: 12,
  },
  apiKeyTitle: {
    margin:     0,
    fontSize:   "0.95rem",
    fontWeight: 700,
    color:      "#fcd34d",
  },
  apiKeySub: {
    margin:     "4px 0 0",
    fontSize:   "0.78rem",
    color:      "#8b7eb8",
    lineHeight: 1.45,
  },
  apiCode: {
    fontSize:     "0.75rem",
    background:   "rgba(0,0,0,0.25)",
    padding:      "1px 6px",
    borderRadius: 4,
    color:        "#e0d8ff",
  },
  apiKeyReveal: {
    display:       "flex",
    flexWrap:      "wrap",
    alignItems:    "center",
    gap:           10,
    marginBottom:  10,
  },
  apiKeyFull: {
    flex:         1,
    minWidth:     200,
    fontSize:     "0.72rem",
    color:        "#e0d8ff",
    background:   "rgba(0,0,0,0.3)",
    padding:      "8px 10px",
    borderRadius: 8,
    wordBreak:    "break-all",
  },
  apiKeyCopyBtn: {
    background:   "rgba(124,92,231,0.2)",
    border:       "1px solid rgba(124,92,231,0.35)",
    color:        "#a78bfa",
    borderRadius: 8,
    padding:      "8px 14px",
    fontSize:     "0.78rem",
    fontWeight:   600,
    cursor:       "pointer",
    fontFamily:   "'DM Sans',sans-serif",
  },
  apiKeyMasked: {
    margin:     "0 0 10px",
    fontSize:   "0.8rem",
    color:      "#a395c8",
  },
  apiKeyMuted: {
    margin:     "0 0 10px",
    fontSize:   "0.78rem",
    color:      "#6b5f8a",
  },
  apiKeyBtn: {
    background:   "rgba(245,158,11,0.15)",
    border:       "1px solid rgba(245,158,11,0.35)",
    color:        "#fcd34d",
    borderRadius: 8,
    padding:      "8px 16px",
    fontSize:     "0.8rem",
    fontWeight:   600,
    cursor:       "pointer",
    fontFamily:   "'DM Sans',sans-serif",
  },
  spinnerLg: {
    width:        40,
    height:       40,
    border:       "3px solid rgba(255,255,255,0.06)",
    borderTop:    "3px solid #7c5ce7",
    borderRadius: "50%",
    animation:    "spin 0.8s linear infinite",
    margin:       "80px auto",
  },
};