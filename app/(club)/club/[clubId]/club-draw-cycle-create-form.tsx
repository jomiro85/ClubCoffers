"use client";

import { useActionState } from "react";
import {
  type DrawCycleActionState,
  createDrawCycle,
} from "@/lib/clubs/draw-cycle-actions";

const initial: DrawCycleActionState = { error: null, success: null };

type ClubDrawCycleCreateFormProps = {
  clubId: string;
  defaultCycleNumber: number;
  /** Pre-filled from previous cycle's name pattern. User can still edit. */
  defaultName?: string;
  /** Pre-filled from previous cycle end date (UTC, YYYY-MM-DDTHH:mm). */
  defaultPeriodStart?: string;
  /** Pre-filled as previous cycle start + same duration. */
  defaultPeriodEnd?: string;
};

const labelCls = "text-sm font-medium text-slate-700";
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-slate-400 focus:outline-none";

export function ClubDrawCycleCreateForm({
  clubId,
  defaultCycleNumber,
  defaultName,
  defaultPeriodStart,
  defaultPeriodEnd,
}: ClubDrawCycleCreateFormProps) {
  const [state, formAction, pending] = useActionState(createDrawCycle, initial);

  const hasPrefill = Boolean(defaultName || defaultPeriodStart);

  return (
    <section
      id="create-cycle"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">
          Create draw cycle
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          One cycle covers one fee period and one draw. Only one cycle can be{" "}
          <span className="font-medium text-slate-700">open</span> at a time.
          Members who join after the period starts won&apos;t be eligible for
          that draw.
          {hasPrefill ? (
            <>
              {" "}
              Dates are pre-filled using the same cadence as the previous cycle
              — adjust if needed.
            </>
          ) : null}
        </p>
      </div>

      <form action={formAction} className="px-6 py-5">
        <div className="flex max-w-md flex-col gap-4">
          <input type="hidden" name="club_id" value={clubId} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="dc_name" className={labelCls}>
              Name
            </label>
            <input
              id="dc_name"
              name="name"
              type="text"
              required
              maxLength={200}
              defaultValue={defaultName ?? ""}
              placeholder={`Cycle ${defaultCycleNumber}`}
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="dc_cycle_number" className={labelCls}>
              Cycle number
            </label>
            <input
              id="dc_cycle_number"
              name="cycle_number"
              type="number"
              min={1}
              step={1}
              required
              defaultValue={defaultCycleNumber}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dc_period_start" className={labelCls}>
                Period start
              </label>
              <input
                id="dc_period_start"
                name="period_start"
                type="datetime-local"
                required
                defaultValue={defaultPeriodStart ?? ""}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="dc_period_end" className={labelCls}>
                Period end
              </label>
              <input
                id="dc_period_end"
                name="period_end"
                type="datetime-local"
                required
                defaultValue={defaultPeriodEnd ?? ""}
                className={inputCls}
              />
            </div>
          </div>

          {state.error ? (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className="text-sm text-emerald-700">{state.success}</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create draw cycle"}
          </button>
        </div>
      </form>
    </section>
  );
}
