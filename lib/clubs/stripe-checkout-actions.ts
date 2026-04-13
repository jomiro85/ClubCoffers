"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type Stripe from "stripe";

export type CheckoutState = {
  error: string | null;
};

/**
 * Create a Stripe Checkout Session in subscription mode for an active member.
 *
 * Permission rules:
 *   - Caller must be authenticated.
 *   - The membership_id must belong to the authenticated user.
 *   - The membership must be active.
 *   - The club must have a connected Stripe account.
 *
 * Idempotency:
 *   - If billing_subscriptions already has an external_customer_id for this
 *     membership we reuse that customer rather than creating a new one.
 *   - billing_subscriptions is upserted (UNIQUE membership_id) so repeated
 *     clicks never create duplicate rows.
 */
export async function createCheckoutSession(
  _prev: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const membershipId = String(formData.get("membership_id") ?? "").trim();
  if (!membershipId) return { error: "Invalid request." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  // Load membership with club data — verify caller owns this membership
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, user_id, status, clubs ( id, name, monthly_fee_pence, stripe_account_id )")
    .eq("id", membershipId)
    .maybeSingle();

  if (!membership || membership.user_id !== user.id) {
    return { error: "Membership not found." };
  }
  if (membership.status !== "active") {
    return { error: "Only active members can set up billing." };
  }

  const clubRaw = Array.isArray(membership.clubs)
    ? (membership.clubs[0] ?? null)
    : membership.clubs;
  const club = clubRaw as {
    id: string;
    name: string;
    monthly_fee_pence: number;
    stripe_account_id: string | null;
  } | null;

  if (!club) return { error: "Club not found." };
  if (!club.stripe_account_id) {
    return { error: "This club has not set up Stripe yet. Ask the club owner." };
  }

  // Build absolute URLs from the current request host
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  // Check for an existing billing record (to reuse the Stripe customer)
  const { data: existingSub } = await supabase
    .from("billing_subscriptions")
    .select("external_customer_id")
    .eq("membership_id", membershipId)
    .maybeSingle();

  let customerId = existingSub?.external_customer_id ?? null;

  let session: Stripe.Checkout.Session;

  try {
    const stripe = getStripe();
    // Create a Stripe customer if we don't already have one
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          user_id: user.id,
          membership_id: membershipId,
          club_id: club.id,
        },
      });
      customerId = customer.id;
    }

    // Create a Checkout Session in subscription mode
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: `${club.name} — monthly membership`,
            },
            recurring: { interval: "month" },
            unit_amount: club.monthly_fee_pence,
          },
          quantity: 1,
        },
      ],
      // {CHECKOUT_SESSION_ID} is a Stripe-injected template literal — not a JS template
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dashboard`,
      metadata: {
        membership_id: membershipId,
        club_id: club.id,
      },
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "A Stripe error occurred. Please try again.";
    return { error: message };
  }

  // Upsert the billing record before redirecting so we always have the
  // customer ID stored even if the user abandons the checkout.
  await supabase.from("billing_subscriptions").upsert(
    {
      membership_id: membershipId,
      provider: "stripe",
      external_customer_id: customerId,
      status: "incomplete",
    },
    { onConflict: "membership_id" }
  );

  // redirect() must be called outside try/catch
  redirect(session.url!);
}
