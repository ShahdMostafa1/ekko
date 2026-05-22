import os
import io
import base64
import stripe
from datetime import datetime
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER

import resend

router = APIRouter(prefix="/stripe", tags=["stripe"])

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
supabase = create_client(
    os.environ.get("SUPABASE_URL"),
    os.environ.get("SUPABASE_KEY"),
)
resend.api_key = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM    = os.environ.get("RESEND_FROM_EMAIL", "Ekko <receipts@ekko.app>")
FRONTEND_URL   = os.environ.get("FRONTEND_URL", "https://ekko.app")

PLAN_PRICE_IDS = {
    "groove": os.environ.get("STRIPE_GROOVE_PRICE_ID"),
    "studio": os.environ.get("STRIPE_STUDIO_PRICE_ID"),
}
PLAN_AMOUNTS = {"groove": 9.00, "studio": 19.00}

EKKO_LOGO_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAHgAAAB4CAYAAAA5ZDbSAAB4LElEQVR4nNT9d5ylWVXvj7/33k84"
    "+VSO3dXd1XE6zHRPzoGBYUgDDAxJYERUjFwVUdSrCCoXUUSCosQLKGGGMDDEASYyOfSEzjlUV1eu"
    "OvlJe+/fH89TPaNfw9WrXn/n9apXV1edc+qcs96913xnr732enxf1iHLmmRZC5N3KcZGHaOjo5JS"
    "YYWQ3CCujBLX1xBX16BKbhh9aXYvi1NP0Jx+ml5rv++4dGrdxeBd0VtRtPEKvEIqeMGTAcCyT6Uh"
    "MNZYO1TiWAe2v2S8cUvZe5rBhTQiCVQIWOIqp9lQgbsa7iXKV9eTCcq9hhPTg9wdBZaKhbxCKl9"
    "aTAFOjfLaFq7l5I2iGrQKPxH86F3aW09grRWSCgkAAAAASUVORK5CYII="
)

class CheckoutRequest(BaseModel):
    plan:    str
    user_id: str
    email:   str

class PortalRequest(BaseModel):
    user_id: str


def _get_or_create_stripe_customer(user_id: str, email: str) -> str:
    row = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).single().execute()
    cid = (row.data or {}).get("stripe_customer_id")
    if cid:
        return cid
    customer = stripe.Customer.create(email=email, metadata={"user_id": user_id})
    supabase.table("profiles").update({"stripe_customer_id": customer.id}).eq("id", user_id).execute()
    return customer.id


def _active_subscription_for_plan(customer_id: str, plan: str) -> bool:
    price_id = PLAN_PRICE_IDS.get(plan)
    if not price_id:
        return False
    subs = stripe.Subscription.list(customer=customer_id, status="active", expand=["data.items.data.price"])
    for sub in subs.auto_paging_iter():
        for item in sub["items"]["data"]:
            if item["price"]["id"] == price_id:
                return True
    return False


def _get_active_subscriptions(customer_id: str) -> list:
    """Return list of active (not cancelled/ending) subscriptions for a customer."""
    result = []
    try:
        subs = stripe.Subscription.list(
            customer=customer_id,
            status="active",
            expand=["data.items.data.price"]
        )
        for sub in subs.auto_paging_iter():
            # Skip subscriptions that are set to cancel at period end
            if sub.get("cancel_at_period_end", False):
                continue
            for item in sub["items"]["data"]:
                price_id = item["price"]["id"]
                plan_name = "groove"
                if price_id == PLAN_PRICE_IDS.get("studio"):
                    plan_name = "studio"
                result.append({
                    "id": sub["id"],
                    "plan": plan_name,
                    "status": sub["status"],
                    "current_period_end": sub.get("current_period_end"),
                    "cancel_at_period_end": sub.get("cancel_at_period_end", False),
                })
    except Exception as e:
        print(f"[ekko] Error fetching subscriptions: {e}")
    return result


def _get_invoices(customer_id: str) -> list:
    """Return recent paid invoices for a customer."""
    result = []
    try:
        invoices = stripe.Invoice.list(customer=customer_id, limit=20)
        for inv in invoices.auto_paging_iter():
            if inv.get("status") != "paid":
                continue
            lines = inv.get("lines", {}).get("data", [])
            plan = "groove"
            if lines:
                price_id = lines[0].get("price", {}).get("id", "")
                if price_id == PLAN_PRICE_IDS.get("studio"):
                    plan = "studio"
            result.append({
                "id": inv["id"],
                "number": inv.get("number") or f"INV-{inv['id'][-8:].upper()}",
                "amount_paid": (inv.get("amount_paid") or 0) / 100,
                "date": datetime.utcfromtimestamp(inv["created"]).strftime("%b %d, %Y"),
                "plan": plan,
                "invoice_pdf": inv.get("invoice_pdf"),
                "receipt_number": inv.get("receipt_number") or f"RCP-{inv['id'][-8:].upper()}",
            })
    except Exception as e:
        print(f"[ekko] Error fetching invoices: {e}")
    return result


def _build_pdf(doc_type: str, invoice_number: str, receipt_number: str,
               customer_email: str, plan: str, amount: float,
               period_start: str, period_end: str) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        rightMargin=20*mm, leftMargin=20*mm,
        topMargin=20*mm, bottomMargin=20*mm,
    )

    styles = getSampleStyleSheet()
    normal = styles["Normal"]
    h1     = ParagraphStyle("h1", parent=normal, fontSize=22, fontName="Helvetica-Bold", spaceAfter=4)
    small  = ParagraphStyle("small", parent=normal, fontSize=9, textColor=colors.HexColor("#666666"))
    bold9  = ParagraphStyle("bold9", parent=normal, fontSize=9, fontName="Helvetica-Bold")
    right9 = ParagraphStyle("right9", parent=normal, fontSize=9, alignment=TA_RIGHT)

    story = []

    logo_img = Paragraph("<b>Ekko</b>", h1)
    
    title_text  = "Invoice" if doc_type == "invoice" else "Receipt"
    header_data = [[Paragraph(title_text, h1), logo_img]]
    header_tbl  = Table(header_data, colWidths=["85%", "15%"])
    header_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",  (1, 0), (1, 0),  "RIGHT"),
    ]))
    story.append(header_tbl)
    story.append(Spacer(1, 4*mm))

    today = datetime.utcnow().strftime("%B %d, %Y")
    meta_lines = [
        f"Invoice number   {invoice_number}",
        f"Receipt number   {receipt_number}",
        f"Date paid        {today}",
    ] if doc_type == "receipt" else [
        f"Invoice number   {invoice_number}",
        f"Date of issue    {today}",
        f"Date due         {today}",
    ]
    for line in meta_lines:
        story.append(Paragraph(line, small))
    story.append(Spacer(1, 6*mm))

    from_to_data = [[
        Paragraph("<b>Ekko</b><br/>ekko.app<br/>support@ekko.app", small),
        Paragraph(f"<b>Bill to</b><br/>{customer_email}", small),
    ]]
    ft_tbl = Table(from_to_data, colWidths=["50%", "50%"])
    ft_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(ft_tbl)
    story.append(Spacer(1, 6*mm))

    plan_label = plan.capitalize()
    amount_str = f"${amount:,.2f}"
    if doc_type == "invoice":
        story.append(Paragraph(f"{amount_str} USD due {today}", bold9))
    else:
        story.append(Paragraph(f"{amount_str} paid on {today}", bold9))
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 4*mm))

    tbl_header = [
        Paragraph("<b>Description</b>", bold9),
        Paragraph("<b>Qty</b>", bold9),
        Paragraph("<b>Unit price</b>", bold9),
        Paragraph("<b>Amount</b>", bold9),
    ]
    tbl_row = [
        Paragraph(f"{plan_label}<br/><font size=8 color='#666666'>{period_start}–{period_end}</font>", small),
        Paragraph("1", small),
        Paragraph(amount_str, small),
        Paragraph(amount_str, small),
    ]
    items_tbl = Table([tbl_header, tbl_row], colWidths=["50%", "10%", "20%", "20%"])
    items_tbl.setStyle(TableStyle([
        ("LINEBELOW",     (0, 0), (-1, 0), 0.5, colors.HexColor("#cccccc")),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(items_tbl)
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#cccccc")))
    story.append(Spacer(1, 2*mm))

    label_key = "Amount due" if doc_type == "invoice" else "Amount paid"
    for label, val in [("Subtotal", amount_str), ("Total", amount_str), (label_key, amount_str)]:
        is_last   = label == label_key
        row_style = bold9 if is_last else small
        totals_row = Table([[
            Paragraph(f"<b>{label}</b>" if is_last else label, row_style),
            Paragraph(f"<b>{val}</b>"   if is_last else val,   right9),
        ]], colWidths=["70%", "30%"])
        totals_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        story.append(totals_row)

    story.append(Spacer(1, 8*mm))

    if doc_type == "receipt":
        story.append(Paragraph("<b>Payment history</b>", bold9))
        story.append(Spacer(1, 3*mm))
        ph_header = [
            Paragraph("<b>Payment method</b>", small),
            Paragraph("<b>Date</b>", small),
            Paragraph("<b>Amount paid</b>", small),
            Paragraph("<b>Receipt number</b>", small),
        ]
        ph_row = [
            Paragraph("Card on file", small),
            Paragraph(today, small),
            Paragraph(amount_str, small),
            Paragraph(receipt_number, small),
        ]
        ph_tbl = Table([ph_header, ph_row], colWidths=["30%", "20%", "25%", "25%"])
        ph_tbl.setStyle(TableStyle([
            ("LINEBELOW",     (0, 0), (-1, 0), 0.5, colors.HexColor("#cccccc")),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(ph_tbl)

    story.append(Spacer(1, 12*mm))
    story.append(Paragraph("Questions? Contact us at <link href='mailto:support@ekko.app'>support@ekko.app</link>", small))
    story.append(Spacer(1, 4*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#eeeeee")))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("Page 1 of 1", ParagraphStyle("footer", parent=small, alignment=TA_RIGHT)))

    doc.build(story)
    return buf.getvalue()


def _send_receipt_email(email: str, plan: str, amount: float,
                        invoice_number: str, receipt_number: str,
                        period_start: str, period_end: str) -> None:
    if not resend.api_key:
        print("[ekko] RESEND_API_KEY not set — skipping receipt email")
        return

    plan_label  = plan.capitalize()
    amount_str  = f"${amount:,.2f}"

    invoice_pdf = _build_pdf("invoice", invoice_number, receipt_number, email,
                             plan, amount, period_start, period_end)
    receipt_pdf = _build_pdf("receipt", invoice_number, receipt_number, email,
                             plan, amount, period_start, period_end)

    html_body = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1a1a2e;">
      <div style="text-align:center;padding:32px 0 16px;">
        <span style="font-size:28px;font-weight:800;background:linear-gradient(130deg,#a78bfa,#60a5fa);
              -webkit-background-clip:text;-webkit-text-fill-color:transparent;">Ekko</span>
      </div>
      <div style="background:#f8f7ff;border-radius:12px;padding:28px 32px;">
        <h2 style="margin:0 0 8px;font-size:20px;">Payment confirmed ✓</h2>
        <p style="color:#555;margin:0 0 20px;">
          Thanks for subscribing to Ekko <strong>{plan_label}</strong>!
          Your music journey continues. 📧 Check your email for attached invoice &amp; receipt PDFs.
        </p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:8px 0;color:#888;">Plan</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">{plan_label}</td>
          </tr>
          <tr style="border-top:1px solid #e0e0e0;">
            <td style="padding:8px 0;color:#888;">Amount paid</td>
            <td style="padding:8px 0;text-align:right;font-weight:600;">{amount_str}/mo</td>
          </tr>
          <tr style="border-top:1px solid #e0e0e0;">
            <td style="padding:8px 0;color:#888;">Billing period</td>
            <td style="padding:8px 0;text-align:right;">{period_start} – {period_end}</td>
          </tr>
          <tr style="border-top:1px solid #e0e0e0;">
            <td style="padding:8px 0;color:#888;">Invoice number</td>
            <td style="padding:8px 0;text-align:right;font-size:12px;color:#555;">{invoice_number}</td>
          </tr>
          <tr style="border-top:1px solid #e0e0e0;">
            <td style="padding:8px 0;color:#888;">Receipt number</td>
            <td style="padding:8px 0;text-align:right;font-size:12px;color:#555;">{receipt_number}</td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#888;">
          📎 Your invoice and receipt are attached as PDFs to this email.
        </p>
      </div>
      <p style="text-align:center;font-size:12px;color:#aaa;margin-top:24px;">
        Questions? <a href="mailto:support@ekko.app" style="color:#7c3aed;">support@ekko.app</a>
      </p>
    </div>
    """

    resend.Emails.send({
        "from":    RESEND_FROM,
        "to":      [email],
        "subject": f"Your Ekko {plan_label} receipt – {receipt_number}",
        "html":    html_body,
        "attachments": [
            {"filename": f"Invoice-{invoice_number}.pdf", "content": list(invoice_pdf)},
            {"filename": f"Receipt-{receipt_number}.pdf", "content": list(receipt_pdf)},
        ],
    })
    print(f"[ekko] Receipt email sent to {email}")


# ── NEW: subscription status endpoint ──────────────────────────────────────────
@router.get("/status/{user_id}")
async def get_subscription_status(user_id: str):
    """
    Returns the user's current plan status from Supabase profiles table.
    Also checks Stripe directly for cancelled/ending subscriptions.
    """
    row = supabase.table("profiles").select(
        "plan, plan_status, stripe_customer_id, stripe_subscription_id, plan_latest_period_end"
    ).eq("id", user_id).single().execute()

    profile = row.data or {}
    plan    = profile.get("plan", "free")
    status  = profile.get("plan_status", "inactive")
    cid     = profile.get("stripe_customer_id")

    # If we have a Stripe customer, verify real-time subscription state
    cancel_at_period_end = False
    if cid and plan != "free":
        try:
            subs = stripe.Subscription.list(customer=cid, status="active")
            active_subs = list(subs.auto_paging_iter())
            if not active_subs:
                # Check if any are cancelling (cancel_at_period_end=true)
                all_subs = stripe.Subscription.list(customer=cid)
                cancelling = [s for s in all_subs.auto_paging_iter()
                              if s.get("cancel_at_period_end")]
                if cancelling:
                    cancel_at_period_end = True
                    status = "cancelling"
                else:
                    # All truly cancelled — sync DB
                    status = "cancelled"
                    supabase.table("profiles").update(
                        {"plan": "free", "plan_status": "cancelled"}
                    ).eq("id", user_id).execute()
                    plan = "free"
            else:
                cancel_at_period_end = any(
                    s.get("cancel_at_period_end") for s in active_subs
                )
                if cancel_at_period_end:
                    status = "cancelling"
        except Exception as e:
            print(f"[ekko] Stripe status check error: {e}")

    return {
        "plan":                plan,
        "status":              status,
        "cancel_at_period_end": cancel_at_period_end,
        "period_end":          profile.get("plan_latest_period_end"),
    }


# ── NEW: invoice list endpoint ─────────────────────────────────────────────────
@router.get("/invoices/{user_id}")
async def get_invoices(user_id: str):
    """Returns list of paid invoices for download."""
    row = supabase.table("profiles").select("stripe_customer_id").eq("id", user_id).single().execute()
    cid = (row.data or {}).get("stripe_customer_id")
    if not cid:
        return {"invoices": []}
    invoices = _get_invoices(cid)
    return {"invoices": invoices}


# ── NEW: download invoice PDF endpoint ────────────────────────────────────────
@router.get("/invoice-pdf/{user_id}/{invoice_id}")
async def download_invoice_pdf(user_id: str, invoice_id: str):
    """Generate and return invoice PDF for download."""
    row = supabase.table("profiles").select("stripe_customer_id, email").eq("id", user_id).single().execute()
    profile = row.data or {}
    cid     = profile.get("stripe_customer_id")
    email   = profile.get("email", "")

    if not cid:
        raise HTTPException(status_code=404, detail="No billing account.")

    try:
        inv = stripe.Invoice.retrieve(invoice_id)
        if inv.get("customer") != cid:
            raise HTTPException(status_code=403, detail="Forbidden.")

        lines        = inv.get("lines", {}).get("data", [])
        plan         = "groove"
        period_start = period_end = datetime.utcnow().strftime("%b %d, %Y")
        amount       = (inv.get("amount_paid") or 0) / 100

        if lines:
            period_start = datetime.utcfromtimestamp(lines[0]["period"]["start"]).strftime("%b %d, %Y")
            period_end   = datetime.utcfromtimestamp(lines[0]["period"]["end"]).strftime("%b %d, %Y")
            price_id     = lines[0].get("price", {}).get("id", "")
            if price_id == PLAN_PRICE_IDS.get("studio"):
                plan = "studio"

        invoice_number = inv.get("number") or f"INV-{invoice_id[-8:].upper()}"
        receipt_number = inv.get("receipt_number") or f"RCP-{invoice_id[-8:].upper()}"

        pdf_bytes = _build_pdf("invoice", invoice_number, receipt_number,
                               email, plan, amount, period_start, period_end)

        from fastapi.responses import Response
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="Invoice-{invoice_number}.pdf"'}
        )
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/create-checkout")  # alias for older frontend builds
@router.post("/checkout")
async def create_checkout(body: CheckoutRequest):
    plan = body.plan.lower()
    if plan not in PLAN_PRICE_IDS:
        raise HTTPException(status_code=400, detail="Invalid plan")

    customer_id = _get_or_create_stripe_customer(body.user_id, body.email)

    if _active_subscription_for_plan(customer_id, plan):
        raise HTTPException(
            status_code=409,
            detail=f"You already have an active {plan.capitalize()} subscription."
        )

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": PLAN_PRICE_IDS[plan], "quantity": 1}],
        mode="subscription",
        success_url=f"{FRONTEND_URL}?payment=success&plan={plan}",
        cancel_url=f"{FRONTEND_URL}?payment=cancel",
        metadata={"user_id": body.user_id, "plan": plan},
    )
    return {"url": session.url}


@router.post("/create-portal")   # alias for older frontend builds
@router.post("/portal")
async def create_portal(body: PortalRequest):
    row = supabase.table("profiles").select("stripe_customer_id").eq("id", body.user_id).single().execute()
    cid = (row.data or {}).get("stripe_customer_id")
    if not cid:
        raise HTTPException(status_code=404, detail="No billing account found.")
    session = stripe.billing_portal.Session.create(customer=cid, return_url=FRONTEND_URL)
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    payload        = await request.body()
    sig_header     = request.headers.get("stripe-signature", "")
    webhook_secret = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    etype = event["type"]
    data  = event["data"]["object"]

    if etype == "checkout.session.completed":
        user_id = data.get("metadata", {}).get("user_id")
        plan    = data.get("metadata", {}).get("plan", "groove")
        if user_id:
            supabase.table("profiles").update({
                "plan": plan, "plan_status": "active",
                "stripe_subscription_id": data.get("subscription"),
            }).eq("id", user_id).execute()

    elif etype == "customer.subscription.updated":
        cid = data.get("customer")
        row = supabase.table("profiles").select("id").eq("stripe_customer_id", cid).maybe_single().execute()
        if row.data:
            new_status = data["status"]
            # If cancelling at period end, mark as "cancelling" not "cancelled"
            if data.get("cancel_at_period_end"):
                new_status = "cancelling"
            supabase.table("profiles").update({
                "plan_status": new_status,
                "plan_latest_period_end": data.get("current_period_end"),
            }).eq("id", row.data["id"]).execute()

    elif etype == "customer.subscription.deleted":
        cid = data.get("customer")
        row = supabase.table("profiles").select("id").eq("stripe_customer_id", cid).maybe_single().execute()
        if row.data:
            supabase.table("profiles").update({
                "plan": "free", "plan_status": "cancelled"
            }).eq("id", row.data["id"]).execute()

    elif etype == "invoice.payment_succeeded":
        customer_email = data.get("customer_email") or ""
        invoice_number = data.get("number") or f"INV-{data['id'][-8:].upper()}"
        receipt_number = data.get("receipt_number") or f"RCP-{data['id'][-8:].upper()}"
        lines          = data.get("lines", {}).get("data", [])
        period_start   = period_end = ""
        amount_paid    = (data.get("amount_paid") or 0) / 100
        plan           = "groove"

        if lines:
            period_start = datetime.utcfromtimestamp(lines[0]["period"]["start"]).strftime("%b %d, %Y")
            period_end   = datetime.utcfromtimestamp(lines[0]["period"]["end"]).strftime("%b %d, %Y")
            price_id     = lines[0].get("price", {}).get("id", "")
            if price_id == PLAN_PRICE_IDS.get("studio"):
                plan = "studio"

        # Only send for actual subscription payments (amount > 0)
        if customer_email and amount_paid > 0:
            try:
                _send_receipt_email(customer_email, plan, amount_paid,
                                    invoice_number, receipt_number,
                                    period_start, period_end)
            except Exception as e:
                print(f"[ekko] Receipt email failed: {e}")

    elif etype in ("invoice.payment_failed", "invoice.payment_action_required"):
        cid = data.get("customer")
        row = supabase.table("profiles").select("id").eq("stripe_customer_id", cid).maybe_single().execute()
        if row.data:
            supabase.table("profiles").update({"plan_status": "past_due"}).eq("id", row.data["id"]).execute()

    return JSONResponse({"status": "ok"})