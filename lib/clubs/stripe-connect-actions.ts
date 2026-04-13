"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

export type StripeConnectState = {
  error: string | null;
};

/**
 * Create (or reuse) a Stripe Connect Express account for a club, generate an
 * Account Link, and redirect the owner/admin to Stripe's hosted onboarding.
 *
 * Permission rules:
 *   - Caller must be authenticated.
 *   - Caller must be an owner or admin of the target club.
 *   - Caller's membership must be active.
 *
 * Idempotency: if the club already has a stripe_account_id we skip account
 * creation and go straight to generating a new Account Link. This means the
 * button also acts as "continue onboarding" or "re-open Stripe dashboard".
 */
export async function beginStripeOnboarding(
  _prev: StripeConnectState,
  formData: FormData
): Promise<StripeConnectState> {
  const clubId = String(formData.get("club_id") ?? "").trim();
  if (!clubId) return { error: "Invalid request — club ID is missing." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be signed in." };

  // Verify caller is an active owner or admin of this club
  const { data: membership } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Only club owners or admins can set up payouts." };
  }
  if (membership.status !== "active") {
    return { error: "Your membership must be active to do this." };
  }

  // Load the club, including any existing Stripe account id
  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, stripe_account_id")
    .eq("id", clubId)
    .maybeSingle();

  if (clubError || !club) return { error: "Club not found." };

  // Build absolute redirect URLs from the current request host
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;
  const clubUrl = `${origin}/club/${clubId}`;

  let stripeAccountId = (club.stripe_account_id as string | null) ?? null;
  let accountLink: Stripe.AccountLink;

  try {
    const stripe = getStripe();
    // Create a Connect Express account only if the club doesn't have one yet
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: "express",
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          club_id: clubId,
          club_name: String(club.name),
        },
      });

      stripeAccountId = account.id;

      const { error: updateError } = await supabase
        .from("clubs")
        .update({ stripe_account_id: stripeAccountId })
        .eq("id", clubId);

      if (updateError) {
        return {
          error:
            "Stripe account created but could not be saved. Please try again.",
        };
      }

      revalidatePath(`/club/${clubId}`);
    }

    // Create a fresh Account Link (links expire, so always generate a new one)
    accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: clubUrl,
      return_url: clubUrl,
      type: "account_onboarding",
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "A Stripe error occurred. Please try again.";
    return { error: message };
  }

  // redirect() must be called outside try/catch (throws NEXT_REDIRECT internally)
  redirect(accountLink.url);
}
