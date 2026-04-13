import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import type Stripe from "stripe";

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

/**
 * Landing page after a successful Stripe Checkout.
 *
 * Stripe redirects here with ?session_id=cs_test_... We retrieve the session,
 * pull out the subscription and membership_id from metadata, then update the
 * billing_subscriptions row with the real subscription id and status.
 *
 * This page is idempotent: re-visiting it after a completed checkout just
 * runs the same upsert again with the same values.
 */
export default async function BillingSuccessPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;

  if (!sessionId) {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Retrieve session and expand the subscription object
  let session: Stripe.Checkout.Session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });
  } catch {
    redirect("/dashboard");
  }

  if (session.status !== "complete") {
    redirect("/dashboard");
  }

  const membershipId = session.metadata?.membership_id ?? null;
  const subscription =
    session.subscription && typeof session.subscription !== "string"
      ? (session.subscription as Stripe.Subscription)
      : null;

  // Verify that this session belongs to the authenticated user
  // (session.customer_email or check via our DB — we use membership ownership)
  if (membershipId) {
    const { data: membership } = await supabase
      .from("memberships")
      .select("user_id")
      .eq("id", membershipId)
      .maybeSingle();

    if (membership && membership.user_id === user.id) {
      // Update the billing record with the real subscription id and status.
      // Period fields (current_period_start/end) are not on the top-level
      // Subscription object in this API version; a webhook handler can
      // populate them from invoice events when needed.
      await supabase
        .from("billing_subscriptions")
        .update({
          external_subscription_id: subscription?.id ?? null,
          status: subscription?.status ?? "active",
          updated_at: new Date().toISOString(),
        })
        .eq("membership_id", membershipId);
    }
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-8 py-16 sm:py-20">
      {/* Success icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50">
        <svg
          className="h-7 w-7 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Monthly payment set up
        </h1>
        <p className="text-sm text-slate-500">
          Your recurring payment is now active. You&apos;ll be charged
          automatically each month.
        </p>
        {subscription ? (
          <p className="text-xs text-slate-400">
            Subscription ID: {subscription.id}
          </p>
        ) : null}
      </div>

      <Link
        href="/dashboard"
        className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
