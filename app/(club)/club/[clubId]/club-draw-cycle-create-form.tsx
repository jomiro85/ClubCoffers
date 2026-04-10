"use client";

import { useActionState } from "react";
import {
  type DrawCycleActionState,
  createDrawCycle,
} from "@/lib/clubs/draw-cycle-actions";

const initial: DrawCycleActionState = { error: null };

type ClubDrawCycleCreateFormProps = {
  clubId: string;
  defaultCycleNumber: number;
};

export function ClubDrawCycleCreateForm({
  clubId,
  defaultCycleNumber,
}: ClubDrawCycleCreateFormProps) {
  const [state, formAction, pending] = useActionState(
    createDrawCycle,
    initial
  );

  return (
    <section id="create-cycle" className="flex flex-col gap-3 scroll-mt-8">
      <h2 className="text-lg font-medium">Create draw cycle</h2>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        A cycle is the fee period for one draw. Only one cycle can be <strong className="font-medium text-neutral-800 dark:text-neutral-200">open</strong> at a time. Set the period dates — members who join after the period starts won&apos;t be eligible for that draw.
      </p>
      <form
        action={formAction}
        className="flex max-w-md flex-col gap-3 border border-neutral-300 p-4 dark:border-neutral-600"
      >
        <input type="hidden" name="club_id" value={clubId} />
        <div className="flex flex-col gap-1">
          <label htmlFor="dc_name">Name</label>
          <input
            id="dc_name"
            name="name"
            type="text"
            required
            maxLength={200}
            className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dc_cycle_number">Cycle number</label>
          <input
            id="dc_cycle_number"
            name="cycle_number"
            type="number"
            min={1}
            step={1}
            required
            defaultValue={defaultCycleNumber}
            className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dc_period_start">Period start</label>
          <input
            id="dc_period_start"
            name="period_start"
            type="datetime-local"
            required
            className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="dc_period_end">Period end</label>
          <input
            id="dc_period_end"
            name="period_end"
            type="datetime-local"
            required
            className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
          />
        </div>
        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {pending ? "Creating…" : "Create draw cycle"}
        </button>
      </form>
    </section>
  );
}
