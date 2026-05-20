"""
Ekko — Stripe Integration
POST /stripe/create-checkout        → create Stripe Checkout session
POST /stripe/create-portal          → open Stripe Customer Portal
POST /stripe/webhook                → handle all Stripe events
GET  /stripe/status/{user_id}       → current plan & status
"""
from __future__ import annotations
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import stripe
import json

router = APIRouter(prefix="/stripe", tags=["Stripe — Subscriptions"])

# ── Stripe config ─────────────────────────────────────────────
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
GROOVE_PRICE_ID = os.getenv("STRIPE_GROOVE_PRICE_ID", "")
STUDIO_PRICE_ID = os.getenv("STRIPE_STUDIO_PRICE_ID", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

PRICE_TO_PLAN: dict[str, str] = {}

def _price_map():
    global PRICE_TO_PLAN
    PRICE_TO_PLAN = {
        GROOVE_PRICE_ID: "groove",
        STUDIO_PRICE_ID: "studio",
    }

def _get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        return None
    from supabase import create_client
    return create_client(url, key)

def _send_receipt_email(to_email: str, customer_name: str, plan: str,
                        amount: float, currency: str, invoice_url: str,
                        period_end: str):
    """
    Optional: send a custom receipt via Resend if RESEND_API_KEY is set.
    If not configured, Stripe's own receipt emails will be used.
    """
    resend_key = os.getenv("RESEND_API_KEY")
    if not resend_key:
        print("[stripe] RESEND_API_KEY not set — skipping custom receipt email")
        return

    try:
        # Minimal send via Resend API (optional)
        import requests
        subject = f"Your {plan.capitalize()} subscription receipt"
        body = f"Thanks {customer_name} — you subscribed to {plan}.\n\nAmount: {amount:.2f} {currency.upper()}\nPeriod ends: {period_end}\n\nView invoice: {invoice_url}"
        resp = requests.post(
            "https://api.resend.com/emails",
            headers={
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json",
            },
            json={
                "from": "no-reply@ekko.app",
                "to": [to_email],
                "subject": subject,
                "text": body,
            },
        )
        if resp.status_code >= 300:
            print("[stripe] Resend email failed:", resp.text)
    except Exception as e:
        print("[stripe] Failed to send receipt email:", e)


# ── Models ────────────────────────────────────────────────────
class CheckoutRequest(BaseModel):
    user_id: str
    email:   str
    plan:    str   # 'groove' or 'studio'

class PortalRequest(BaseModel):
    user_id: str


# Ensure price map on import
_price_map()

# ── POST /stripe/create-checkout ─────────────────────────────
@router.post("/create-checkout")
async def create_checkout(req: CheckoutRequest):
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    # choose price id from plan
    plan = (req.plan or "").lower()
    if plan == "groove":
        price_id = GROOVE_PRICE_ID
    elif plan == "studio":
        price_id = STUDIO_PRICE_ID
    else:
        raise HTTPException(status_code=400, detail="Invalid plan")

    # fetch profile to see if we have a customer id
    profile_q = supabase.from_("profiles").select("stripe_customer_id").eq("id", req.user_id).single().execute()
    profile = profile_q.data
    customer_id = profile.get("stripe_customer_id") if profile else None

    try:
        if not customer_id:
            cust = stripe.Customer.create(email=req.email, metadata={"supabase_id": req.user_id})
            customer_id = cust.id
            await supabase.from_("profiles").update({"stripe_customer_id": customer_id}).eq("id", req.user_id).execute()

        session = stripe.checkout.Session.create(
            mode="subscription",
            payment_method_types=["card"],
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=f"{FRONTEND_URL}/?billing=success",
            cancel_url=f"{FRONTEND_URL}/?billing=canceled",
        )
        return JSONResponse({"url": session.url})
    except Exception as e:
        print("[stripe] create_checkout error:", e)
        raise HTTPException(status_code=500, detail="Failed to create checkout session")


# ── POST /stripe/create-portal ────────────────────────────────
@router.post("/create-portal")
async def create_portal(req: PortalRequest):
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")

    profile_q = supabase.from_("profiles").select("stripe_customer_id").eq("id", req.user_id).single().execute()
    profile = profile_q.data
    customer_id = profile.get("stripe_customer_id") if profile else None
    if not customer_id:
        raise HTTPException(status_code=400, detail="No Stripe customer for user")

    try:
        portal = stripe.billing_portal.Session.create(customer=customer_id, return_url=f"{FRONTEND_URL}/billing")
        return JSONResponse({"url": portal.url})
    except Exception as e:
        print("[stripe] create_portal error:", e)
        raise HTTPException(status_code=500, detail="Failed to create billing portal session")


# ── POST /stripe/webhook ──────────────────────────────────────
@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
):
    supabase = _get_supabase()
    payload = await request.body()

    if not WEBHOOK_SECRET:
        # If webhook secret not set, try to parse without verifying (dev only)
        try:
            event = json.loads(payload)
        except Exception as e:
            print("[stripe] webhook parse failed:", e)
            raise HTTPException(status_code=400, detail="Invalid payload")
    else:
        try:
            event = stripe.Webhook.construct_event(payload, stripe_signature, WEBHOOK_SECRET)
        except Exception as e:
            print("[stripe] Webhook signature verification failed:", e)
            raise HTTPException(status_code=400, detail="Webhook signature verification failed")

    etype = event.get("type")
    data = event.get("data", {}).get("object", {})

    try:
        # Checkout completed → subscription created (store subscription on profile)
        if etype == "checkout.session.completed":
            session = data
            customer_id = session.get("customer")
            subscription_id = session.get("subscription")
            if subscription_id and customer_id and supabase:
                sub = stripe.Subscription.retrieve(subscription_id)
                plan_price = sub["items"]["data"][0]["price"]["id"] if sub["items"]["data"] else ""
                plan = PRICE_TO_PLAN.get(plan_price, plan_price)
                period_end = datetime.fromtimestamp(sub.current_period_end, tz=timezone.utc).isoformat() if sub.current_period_end else None

                # find profile by stripe_customer_id
                prof_q = supabase.from_("profiles").select("id,email").eq("stripe_customer_id", customer_id).limit(1).execute()
                prof = prof_q.data[0] if prof_q and prof_q.data else None
                if prof:
                    await supabase.from_("profiles").update({
                        "stripe_subscription_id": sub.id,
                        "plan": plan,
                        "plan_status": sub.status,
                        "plan_latest_period_end": period_end
                    }).eq("id", prof["id"]).execute()

                    # optionally send a custom receipt email (best-effort)
                    invoice_url = ""
                    try:
                        invoices = stripe.Invoice.list(subscription=sub.id, limit=1)
                        if invoices and invoices.data:
                            invoice_url = invoices.data[0].hosted_invoice_url or ""
                            amount = (invoices.data[0].amount_paid or 0) / 100.0
                            currency = invoices.data[0].currency or "usd"
                            _send_receipt_email(prof.get("email", ""), prof.get("email", ""), plan, amount, currency, invoice_url, period_end or "")
                    except Exception:
                        pass

        # Subscription updated/cancelled → sync status
        if etype in ("customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_succeeded", "invoice.payment_failed"):
            # try to find subscription id or customer and update profile accordingly
            sub = data if data.get("object") == "subscription" or etype.startswith("customer.subscription") else None
            subscription_id = sub.get("id") if sub else data.get("subscription") or data.get("id")
            # retrieve subscription when possible
            try:
                if subscription_id:
                    subscription = stripe.Subscription.retrieve(subscription_id)
                    # find profile by stripe_customer_id
                    customer_id = subscription.customer
                    prof_q = supabase.from_("profiles").select("id").eq("stripe_customer_id", customer_id).limit(1).execute()
                    prof = prof_q.data[0] if prof_q and prof_q.data else None
                    if prof:
                        plan_price = subscription["items"]["data"][0]["price"]["id"] if subscription["items"]["data"] else ""
                        plan = PRICE_TO_PLAN.get(plan_price, plan_price)
                        period_end = datetime.fromtimestamp(subscription.current_period_end, tz=timezone.utc).isoformat() if subscription.current_period_end else None
                        await supabase.from_("profiles").update({
                            "stripe_subscription_id": subscription.id,
                            "plan": plan,
                            "plan_status": subscription.status,
                            "plan_latest_period_end": period_end
                        }).eq("id", prof["id"]).execute()
            except Exception as e:
                print("[stripe] failed to sync subscription event:", e)

    except Exception as e:
        print("[stripe] webhook handler error:", e)

    return JSONResponse({"received": True})


# ── GET /stripe/status/{user_id} ──────────────────────────────
@router.get("/status/{user_id}")
async def get_status(user_id: str):
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase not configured")
    res = supabase.from_("profiles").select("plan,plan_status,plan_latest_period_end,stripe_subscription_id,stripe_customer_id").eq("id", user_id).single().execute()
    if not res or not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return JSONResponse(res.data)