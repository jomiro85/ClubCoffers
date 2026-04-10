"use client";

import { useActionState } from "react";
import {
  type JoinClubActionState,
  joinClubByInvite,
} from "@/lib/clubs/join-actions";

type JoinClubPanelProps = {
  clubName: string;
  inviteToken: string;
  alreadyMember: boolean;
};

const initialState: JoinClubActionState = { error: null };

export function JoinClubPanel({
  clubName,
  inviteToken,
  alreadyMember,
}: JoinClubPanelProps) {
  const [state, formAction, pending] = useActionState(
    joinClubByInvite,
    initialState
  );

  if (alreadyMember) {
    return (
      <p className="text-neutral-700 dark:text-neutral-300">
        You are already a member of this club.
      </p>
    );
  }

  if (state.success) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-green-700 dark:text-green-400">
          Your request to join <strong>{clubName}</strong> has been submitted.
          Your membership is pending.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-4">
      <input type="hidden" name="invite_token" value={inviteToken} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Join <strong>{clubName}</strong> as a member.
      </p>
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
        {pending ? "Joining…" : "Join club"}
      </button>
    </form>
  );
}
