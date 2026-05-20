import React, { useState } from "react";

export default function BillingPortalButton({ userId, children }) {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/stripe/create-portal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
      else console.error("Portal creation failed", data);
    } catch (err) {
      console.error("Portal error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={openPortal} disabled={loading} className="billing-portal-btn">
      {loading ? "Opening…" : children || "Manage billing"}
    </button>
  );
}