"use client";

import { useActionState } from "react";
import { type AuthActionState, signUp } from "@/lib/auth/actions";

const initialState: AuthActionState = { error: null };

type SignUpFormProps = {
  redirectPath?: string;
};

export function SignUpForm({ redirectPath }: SignUpFormProps) {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      {redirectPath ? (
        <input type="hidden" name="redirect" value={redirectPath} />
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="display_name">Display name</label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          autoComplete="name"
          className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="rounded border border-neutral-400 px-2 py-1 dark:border-neutral-600"
        />
      </div>
      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.message ? (
        <p className="text-sm text-green-700 dark:text-green-400">{state.message}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-neutral-900 px-3 py-2 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {pending ? "Creating account…" : "Sign up"}
      </button>
    </form>
  );
}
