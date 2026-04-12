"use client";

import { updateDisplayName, type ProfileActionState } from "@/lib/auth/actions";
import { useActionState } from "react";

const initial: ProfileActionState = { error: null, success: null };

export function ProfileForm({ currentDisplayName }: { currentDisplayName: string | null }) {
  const [state, formAction, pending] = useActionState(updateDisplayName, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="display_name" className="text-sm font-medium text-slate-700">
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          maxLength={200}
          defaultValue={currentDisplayName ?? ""}
          placeholder="Your name"
          className="w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-slate-400 focus:outline-none"
        />
        <p className="text-xs text-slate-400">
          Visible to other members of your clubs.
        </p>
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
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
