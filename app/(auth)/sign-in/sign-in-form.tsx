"use client";

import { useActionState } from "react";
import { type AuthActionState, signIn } from "@/lib/auth/actions";

const initialState: AuthActionState = { error: null };

type SignInFormProps = {
  redirectPath?: string;
};

export function SignInForm({ redirectPath }: SignInFormProps) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      {redirectPath ? (
        <input type="hidden" name="redirect" value={redirectPath} />
      ) : null}
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
          autoComplete="current-password"
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
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
