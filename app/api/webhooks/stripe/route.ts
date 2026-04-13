import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import type { NextRequest } from "next/server";
import type Stripe from "stripe";

/**
 * Stripe webhook receiver.
 *
 * Events handled:
 *   checkout.session.completed   – link completed checkout to billing record
 *   invoice.paid                 – insert a succeeded payment, map to draw cycle
 *   invoice.payment_failed       – mark subscription past_due, insert failed row
 *   customer.subscription.deleted – mark subscription canceled
 *
 * Idempotency: payments.provider_event_id carries the Stripe event ID.
 * Duplicate delivery of the same event is safely ignored.
 *
 * Security: every request is verified with HMAC using STRIPE_WEBHOOK_SECRET
 * before any DB operation runs.
 *
 * Stripe API version note (2026-03-25.dahlia):
 *   The subscription reference on an invoice moved from the top-level
 *   `invoice.subscription` field to `invoice.parent.subscription_details.subscription`.
 *   All helpers below use the new path.
 */

export const dynamic = "force-dynamic";

/* ── Type helpers ─────────────────────────────────────────────────────────── */

/** Resolve any Stripe expandable field to its string ID. */
function stripeId(field: string | { id: string } | null | undefined): string | null {
  if (!field) return null;
  return typeof field === "string" ? field : field.id;
}

/**
 * Extract the Stripe subscription ID from a v22 Invoice.
 * In API 2026-03-25.dahlia the subscription moved to:
 *   invoice.parent.subscription_details.subscription
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (!parent || parent.type !== "subscription_details") return null;
  return stripeId(parent.subscription_details?.subscription ?? null);
}

/* ── DB helpers ────────────────────────────────────────────────────────────── */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Find the billing_subscriptions row for an invoice, by subscription ID then customer ID. */
async function findBillingSub(
  supabase: SupabaseClient,
  subscriptionId: string | null,
  customerId: string | null
) {
  if (subscriptionId) {
    const { data } = await supabase
      .from("billing_subscriptions")
      .select("id, membership_id")
      .eq("external_subscription_id", subscriptionId)
      .maybeSingle();
    if (data) return data;
  }
  if (customerId) {
    const { data } = await supabase
      .from("billing_subscriptions")
      .select("id, membership_id")
      .eq("external_customer_id", customerId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/** Find the club_id for a membership. */
async function getClubId(supabase: SupabaseClient, membershipId: string) {
  const { data } = await supabase
    .from("memberships")
    .select("club_id")
    .eq("id", membershipId)
    .maybeSingle();
  return data?.club_id ?? null;
}

/**
 * Find the draw cycle whose period contains paidAt for the given club.
 * Returns null if no cycle matches (e.g. payment arrives outside cycle window).
 */
async function findDrawCycle(
  supabase: SupabaseClient,
  clubId: string,
  paidAt: Date
): Promise<string | null> {
  const iso = paidAt.toISOString();
  const { data } = await supabase
    .from("draw_cycles")
    .select("id")
    .eq("club_id", clubId)
    .lte("period_start", iso)
    .gte("period_end", iso)
    .order("period_start", { ascending: false })
    .limit(1);
  return data?.[0]?.id ?? null;
}

/* ── Event handlers ───────────────────────────────────────────────────────── */

/**
 * checkout.session.completed
 * Persist the subscription ID and confirm active status.
 * Also handles sessions where billing_subscriptions was created optimistically
 * by the checkout action (most common path).
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: SupabaseClient
) {
  if (session.mode !== "subscription") return;

  const membershipId = session.metadata?.membership_id ?? null;
  const subscriptionId = stripeId(session.subscription);
  const customerId = stripeId(session.customer);

  if (!membershipId) return;

  await supabase
    .from("billing_subscriptions")
    .update({
      external_subscription_id: subscriptionId,
      external_customer_id: customerId,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("membership_id", membershipId);
}

/**
 * invoice.paid
 * Insert a succeeded payment row linked to the correct membership and draw cycle.
 * Idempotent: skipped if provider_event_id already exists in payments.
 */
async function handleInvoicePaid(
  event: Stripe.Event,
  invoice: Stripe.Invoice,
  supabase: SupabaseClient
) {
  // Idempotency guard — skip if this event was already processed
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("provider_event_id", event.id)
    .maybeSingle();
  if (existing) return;

  const subscriptionId = invoiceSubscriptionId(invoice);
  const customerId = stripeId(invoice.customer);

  const billingSub = await findBillingSub(supabase, subscriptionId, customerId);
  if (!billingSub) {
    console.warn(`invoice.paid: no billing_subscriptions found for sub=${subscriptionId} cust=${customerId}`);
    return;
  }

  const { membership_id: membershipId } = billingSub;
  const clubId = await getClubId(supabase, membershipId);

  // Determine when the invoice was paid
  const paidAtUnix = invoice.status_transitions?.paid_at ?? invoice.effective_at;
  const paidAt = paidAtUnix ? new Date(paidAtUnix * 1000) : new Date();

  // Find the draw cycle whose period contains paidAt (null is allowed)
  const drawCycleId = clubId ? await findDrawCycle(supabase, clubId, paidAt) : null;

  // Insert payment row
  const { error } = await supabase.from("payments").insert({
    draw_cycle_id: drawCycleId,
    membership_id: membershipId,
    amount_pence: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    status: "succeeded",
    provider: "stripe",
    provider_event_id: event.id,
    paid_at: paidAt.toISOString(),
  });

  if (error) {
    console.error("invoice.paid: failed to insert payment:", error.message);
    throw new Error(error.message);
  }

  // Keep billing record status current
  await supabase
    .from("billing_subscriptions")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", billingSub.id);
}

/**
 * invoice.payment_failed
 * Mark the subscription as past_due and record the failed payment attempt.
 * Idempotent via provider_event_id.
 */
async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  invoice: Stripe.Invoice,
  supabase: SupabaseClient
) {
  const subscriptionId = invoiceSubscriptionId(invoice);
  const customerId = stripeId(invoice.customer);

  const billingSub = await findBillingSub(supabase, subscriptionId, customerId);
  if (!billingSub) return;

  // Update billing subscription to past_due
  await supabase
    .from("billing_subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("id", billingSub.id);

  // Record the failed attempt (idempotent)
  const { data: existing } = await supabase
    .from("payments")
    .select("id")
    .eq("provider_event_id", event.id)
    .maybeSingle();
  if (existing) return;

  await supabase.from("payments").insert({
    draw_cycle_id: null,
    membership_id: billingSub.membership_id,
    amount_pence: invoice.amount_due,
    currency: invoice.currency.toUpperCase(),
    status: "failed",
    provider: "stripe",
    provider_event_id: event.id,
    paid_at: null,
  });
}

/**
 * customer.subscription.deleted
 * Stripe fires this when a subscription is fully canceled.
 * Mark the billing record as canceled.
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: SupabaseClient
) {
  const subscriptionId = subscription.id;
  const customerId = stripeId(subscription.customer);

  const billingSub = await findBillingSub(supabase, subscriptionId, customerId);
  if (!billingSub) return;

  await supabase
    .from("billing_subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", billingSub.id);
}

/* ── Route Handler ────────────────────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // Read the raw body before anything else — required for signature verification
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return new Response(`Webhook signature verification failed: ${msg}`, { status: 400 });
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session,
          supabase
        );
        break;

      case "invoice.paid":
        await handleInvoicePaid(
          event,
          event.data.object as Stripe.Invoice,
          supabase
        );
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event,
          event.data.object as Stripe.Invoice,
          supabase
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
          supabase
        );
        break;

      default:
        // Unhandled event types are acknowledged and ignored
        break;
    }
  } catch (e) {
    console.error(`Webhook handler error for event ${event.id} (${event.type}):`, e);
    // Return 500 so Stripe retries delivery
    return new Response("Internal handler error", { status: 500 });
  }

  // Always acknowledge receipt so Stripe does not retry
  return new Response(null, { status: 200 });
}
