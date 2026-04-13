"use client";

import {
  createCheckoutSession,
  type CheckoutState,
} from "@/lib/clubs/stripe-checkout-actions";
import { useActionState } from "react";

const initial: CheckoutState = { error: null };

export function CheckoutButton({ membershipId }: { membershipId: string }) {
  const [state, formAction, pending] = useActionState(
    createCheckoutSession,
    initial
  );

  return (
    <div className="flex flex-col gap-2">
      <form action={formAction}>
        <input type="hidden" name="membership_id" value={membershipId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "Redirecting to Stripe…" : "Set up monthly payment →"}
        </button>
      </form>
      {state.error ? (
        <p className="text-xs text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
