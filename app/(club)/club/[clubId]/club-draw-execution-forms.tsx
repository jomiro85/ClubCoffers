"use client";

import { useActionState } from "react";
import {
  closeDrawCycle,
  runDrawCycle,
  type DrawExecutionActionState,
} from "@/lib/clubs/draw-execution-actions";

const initial: DrawExecutionActionState = {
  error: null,
  success: null,
};

type ClubDrawExecutionFormsProps = {
  clubId: string;
  closeCycleId: string | null;
  runCycleId: string | null;
  /** Shown next to close action; required when closing. */
  closeEligibleCount: number;
  closeTotalPotPence: number;
  /** Shown next to run action. */
  runEntryCount: number;
  runTotalPotPence: number;
};

export function ClubDrawExecutionForms({
  clubId,
  closeCycleId,
  runCycleId,
  closeEligibleCount,
  closeTotalPotPence,
  runEntryCount,
  runTotalPotPence,
}: ClubDrawExecutionFormsProps) {
  const [closeState, closeAction, closePending] = useActionState(
    closeDrawCycle,
    initial
  );
  const [runState, runAction, runPending] = useActionState(
    runDrawCycle,
    initial
  );

  if (!closeCycleId && !runCycleId) {
    return null;
  }

  const closeBlocked = closeCycleId != null && closeEligibleCount === 0;

  return (
    <div
      id="close-run"
      className="flex scroll-mt-8 flex-col gap-4 rounded-lg border border-neutral-300 p-4 dark:border-neutral-600"
    >
      <h3 className="text-base font-medium">Close or run this cycle</h3>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        Close locks who is in the draw and fixes the pot. Run draw picks the winner and creates settlements — only after close.
      </p>
      {closeCycleId ? (
        <form action={closeAction} className="flex flex-col gap-2">
          <input type="hidden" name="club_id" value={clubId} />
          <input type="hidden" name="draw_cycle_id" value={closeCycleId} />
          <div
            className="rounded border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
            role="status"
          >
            <p className="font-medium text-amber-950 dark:text-amber-100">
              Before closing
            </p>
            <ul className="mt-1 list-inside list-disc text-amber-900 dark:text-amber-200">
              <li>
                Eligible members (will become draw entries):{" "}
                <span className="font-mono">{closeEligibleCount}</span>
              </li>
              <li>
                Total pot (succeeded payments):{" "}
                <span className="font-mono">{closeTotalPotPence}</span> pence
              </li>
            </ul>
            {closeBlocked ? (
              <p className="mt-2 text-red-700 dark:text-red-300" role="alert">
                You cannot close this cycle: there must be at least one eligible
                member (active, paid, joined before period start).
              </p>
            ) : null}
          </div>
          {closeState.error ? (
            <p className="text-sm text-red-600" role="alert">
              {closeState.error}
            </p>
          ) : null}
          {closeState.success ? (
            <p className="text-sm text-green-800 dark:text-green-300">
              {closeState.success}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={closePending || closeBlocked}
            className="w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {closePending ? "Closing…" : "Close cycle"}
          </button>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Locks entries from eligible members with succeeded payments (joined
            before period start), sets the pot total, and closes the cycle.
          </p>
        </form>
      ) : null}
      {runCycleId ? (
        <form action={runAction} className="flex flex-col gap-2">
          <input type="hidden" name="club_id" value={clubId} />
          <input type="hidden" name="draw_cycle_id" value={runCycleId} />
          <div
            className="rounded border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30"
            role="status"
          >
            <p className="font-medium text-amber-950 dark:text-amber-100">
              Draw check
            </p>
            <ul className="mt-1 list-inside list-disc text-amber-900 dark:text-amber-200">
              <li>
                Draw entries:{" "}
                <span className="font-mono">{runEntryCount}</span>
              </li>
              <li>
                Total pot:{" "}
                <span className="font-mono">{runTotalPotPence}</span> pence
              </li>
            </ul>
            {runEntryCount === 0 ? (
              <p className="mt-2 text-red-700 dark:text-red-300" role="alert">
                Cannot run: this cycle has no draw entries. Close the cycle
                first with at least one eligible member.
              </p>
            ) : null}
          </div>
          {runState.error ? (
            <p className="text-sm text-red-600" role="alert">
              {runState.error}
            </p>
          ) : null}
          {runState.success ? (
            <p className="text-sm text-green-800 dark:text-green-300">
              {runState.success}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={runPending || runEntryCount === 0}
            className="w-fit rounded bg-neutral-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {runPending ? "Running…" : "Run draw"}
          </button>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            Picks one winner at random, records settlement splits (57% club, 35%
            winner, 8% platform), and marks the cycle as drawn. Cannot be run
            twice.
          </p>
        </form>
      ) : null}
    </div>
  );
}
