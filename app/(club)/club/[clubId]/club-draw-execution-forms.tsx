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
  closeEligibleCount: number;
  closeTotalPotPence: number;
  runEntryCount: number;
  runTotalPotPence: number;
};

function fmtPence(p: number) {
  return `${p.toLocaleString("en-GB")}p`;
}

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
  const [runState, runAction, runPending] = useActionState(runDrawCycle, initial);

  if (!closeCycleId && !runCycleId) return null;

  const closeBlocked = closeCycleId != null && closeEligibleCount === 0;
  const runBlocked = runCycleId != null && runEntryCount === 0;

  return (
    <section
      id="close-run"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">
          {closeCycleId ? "Close cycle" : "Run draw"}
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {closeCycleId
            ? "Closing locks the entry list and fixes the pot. The draw can only be run after the cycle is closed."
            : "Pick one winner at random from the eligible entries. This cannot be undone or re-run."}
        </p>
      </div>

      <div className="px-6 py-5">
        {/* ── Close ── */}
        {closeCycleId ? (
          <form action={closeAction} className="flex flex-col gap-4">
            <input type="hidden" name="club_id" value={clubId} />
            <input type="hidden" name="draw_cycle_id" value={closeCycleId} />

            {/* Pre-close summary */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Before closing
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Eligible entries
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
                    {closeEligibleCount}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Active, paid, joined before period start
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Total pot
                  </p>
                  <p className="mt-0.5 font-mono text-xl font-semibold text-slate-900">
                    {fmtPence(closeTotalPotPence)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Sum of succeeded payments
                  </p>
                </div>
              </div>
              {closeBlocked ? (
                <p
                  className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  Cannot close: at least one active member must have paid and
                  joined before the period start.
                </p>
              ) : null}
            </div>

            {closeState.error ? (
              <p className="text-sm text-red-600" role="alert">
                {closeState.error}
              </p>
            ) : null}
            {closeState.success ? (
              <p className="text-sm text-emerald-700">{closeState.success}</p>
            ) : null}

            <button
              type="submit"
              disabled={closePending || closeBlocked}
              className="w-fit rounded-lg border border-amber-600 bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {closePending ? "Closing…" : "Close cycle"}
            </button>
          </form>
        ) : null}

        {/* ── Run draw ── */}
        {runCycleId ? (
          <form action={runAction} className="flex flex-col gap-4">
            <input type="hidden" name="club_id" value={clubId} />
            <input type="hidden" name="draw_cycle_id" value={runCycleId} />

            {/* Pre-draw summary */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Draw check
              </p>
              <div className="mt-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Draw entries
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-slate-900">
                    {runEntryCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    Total pot
                  </p>
                  <p className="mt-0.5 font-mono text-xl font-semibold text-slate-900">
                    {fmtPence(runTotalPotPence)}
                  </p>
                </div>
              </div>
              {runBlocked ? (
                <p
                  className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700"
                  role="alert"
                >
                  Cannot run: this cycle has no draw entries. Close the cycle
                  with at least one eligible member first.
                </p>
              ) : null}
              {!runBlocked ? (
                <p className="mt-3 text-xs text-slate-500">
                  Split: 57% club · 35% winner · 8% platform. Cannot be run
                  twice.
                </p>
              ) : null}
            </div>

            {runState.error ? (
              <p className="text-sm text-red-600" role="alert">
                {runState.error}
              </p>
            ) : null}
            {runState.success ? (
              <p className="text-sm text-emerald-700">{runState.success}</p>
            ) : null}

            <button
              type="submit"
              disabled={runPending || runBlocked}
              className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
            >
              {runPending ? "Running draw…" : "Run draw"}
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}
