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
  /** Pre-filled cycle name derived from the previous cycle's number and start month. */
  defaultName?: string;
  /**
   * Pre-filled period start in YYYY-MM-DDTHH:mm (UTC).
   * Rule: nextStart = prevEnd — the new cycle picks up exactly where the last one ended.
   */
  defaultPeriodStart?: string;
  /**
   * Pre-filled period end in YYYY-MM-DDTHH:mm (UTC).
   * Rule: nextEnd = nextStart + (prevEnd − prevStart) — same duration as the previous cycle.
   */
  defaultPeriodEnd?: string;
};

const labelCls = "text-sm font-medium text-slate-700";
const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-slate-400 focus:outline-none";

function formatPreviewDate(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return new Date(raw).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return raw;
  }
}

export function ClubDrawCycleCreateForm({
  clubId,
  defaultCycleNumber,
  defaultName,
  defaultPeriodStart,
  defaultPeriodEnd,
}: ClubDrawCycleCreateFormProps) {
  const [state, formAction, pending] = useActionState(createDrawCycle, initial);

  // When previous cycle data is available, we're creating a "next" cycle (not the first).
  const isNextCycle = Boolean(defaultPeriodStart && defaultPeriodEnd);
  const title = isNextCycle
    ? `Create cycle ${defaultCycleNumber}`
    : "Create first cycle";

  return (
    <section
      id="create-cycle"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          One cycle = one fee period + one draw. Only one cycle can be{" "}
          <span className="font-medium text-slate-700">open</span> at a time.
          Members who join after the period start date are not eligible for
          that cycle&apos;s draw.
        </p>
      </div>

      <form action={formAction} className="px-6 py-5">
        <div className="flex max-w-md flex-col gap-4">
          <input type="hidden" name="club_id" value={clubId} />

          {/* Cadence preview — shown when pre-filling from a previous cycle */}
          {isNextCycle ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-medium text-slate-700">Pre-filled from previous cycle</p>
              <ul className="mt-1.5 space-y-0.5 text-slate-500">
                <li>
                  <span className="font-medium text-slate-600">Start:</span>{" "}
                  {formatPreviewDate(defaultPeriodStart)} — picks up where the
                  last cycle ended
                </li>
                <li>
                  <span className="font-medium text-slate-600">End:</span>{" "}
                  {formatPreviewDate(defaultPeriodEnd)} — same duration as
                  previous
                </li>
              </ul>
              <p className="mt-2 text-xs text-slate-400">
                Adjust the dates below if your club runs on a different schedule.
              </p>
            </div>
          ) : null}

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
            {pending ? "Creating…" : title}
          </button>
        </div>
      </form>
    </section>
  );
}
