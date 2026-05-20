import React, { useState } from "react";

export default function SubscribeButton({ plan, userId, email, children }) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (!userId || !email || !plan) {
      console.error("Missing userId/email/plan for checkout");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/stripe/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, email, plan }),
      });
      const data = await res.json();
      if (data?.url) {
        window.location.href = data.url;
      } else {
        console.error("Checkout creation failed", data);
      }
    } catch (err) {
      console.error("Checkout error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleCheckout} disabled={loading} className="subscribe-btn">
      {loading ? "Redirecting…" : children || `Subscribe (${plan})`}
    </button>
  );
}