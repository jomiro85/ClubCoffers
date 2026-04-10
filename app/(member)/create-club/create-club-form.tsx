"use client";

import { useActionState } from "react";
import { type CreateClubState, createClub } from "@/lib/clubs/actions";

const initialState: CreateClubState = { error: null };

export function CreateClubForm() {
  const [state, formAction, pending] = useActionState(createClub, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name">Club name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={200}
          className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="slug">Slug</label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          maxLength={100}
          placeholder="my-club"
          className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
        />
        <span className="text-xs text-neutral-500">
          Lowercase letters, numbers, and hyphens only.
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="monthly_fee_pence">Monthly fee (pence)</label>
        <input
          id="monthly_fee_pence"
          name="monthly_fee_pence"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
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
        {pending ? "Creating…" : "Create club"}
      </button>
    </form>
  );
}
