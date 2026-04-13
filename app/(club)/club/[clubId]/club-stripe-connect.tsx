"use client";

import {
  beginStripeOnboarding,
  type StripeConnectState,
} from "@/lib/clubs/stripe-connect-actions";
import { useActionState } from "react";

const initial: StripeConnectState = { error: null };

export function ClubStripeConnect({
  clubId,
  stripeAccountId,
}: {
  clubId: string;
  stripeAccountId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    beginStripeOnboarding,
    initial
  );

  const isConnected = Boolean(stripeAccountId);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Stripe payouts
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {isConnected
                ? "A Stripe account is linked to this club. You can continue or update the setup below."
                : "Connect a Stripe account to enable real payouts for draw winners."}
            </p>
          </div>
          {isConnected ? (
            <span className="shrink-0 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              Connected
            </span>
          ) : (
            <span className="shrink-0 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
              Not set up
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-5">
        {!isConnected ? (
          <p className="mb-4 text-sm text-slate-500">
            You&apos;ll be taken to Stripe to create an Express account. This
            takes a few minutes. When done, you&apos;ll be returned here
            automatically.
          </p>
        ) : null}

        <form action={formAction}>
          <input type="hidden" name="club_id" value={clubId} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {pending
              ? "Redirecting to Stripe…"
              : isConnected
                ? "Continue Stripe setup →"
                : "Set up club payouts →"}
          </button>
        </form>

        {state.error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}

        <p className="mt-4 text-xs text-slate-400">
          Stripe is used only in test mode. No real money moves during testing.
        </p>
      </div>
    </div>
  );
}
