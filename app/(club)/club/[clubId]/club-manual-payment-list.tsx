"use client";

import { useActionState } from "react";
import {
  type DrawCycleActionState,
  markMemberPaidForCycle,
} from "@/lib/clubs/draw-cycle-actions";

const initial: DrawCycleActionState = { error: null };

type PaymentRow = {
  membershipId: string;
  displayName: string | null;
};

type ClubManualPaymentListProps = {
  clubId: string;
  drawCycleId: string;
  rows: PaymentRow[];
};

export function ClubManualPaymentList({
  clubId,
  drawCycleId,
  rows,
}: ClubManualPaymentListProps) {
  const [state, formAction, pending] = useActionState(
    markMemberPaidForCycle,
    initial
  );

  if (rows.length === 0) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        No active unpaid members to mark for this cycle.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li
            key={r.membershipId}
            className="flex flex-wrap items-center gap-2 border border-neutral-200 px-2 py-1 dark:border-neutral-700"
          >
            <span className="text-sm">{r.displayName ?? "—"}</span>
            <form action={formAction} className="inline">
              <input type="hidden" name="club_id" value={clubId} />
              <input type="hidden" name="draw_cycle_id" value={drawCycleId} />
              <input
                type="hidden"
                name="membership_id"
                value={r.membershipId}
              />
              <button
                type="submit"
                disabled={pending}
                className="text-xs underline disabled:opacity-50"
              >
                Mark as paid
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
