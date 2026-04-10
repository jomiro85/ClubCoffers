"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  type JoinClubActionState,
  joinClubByInvite,
} from "@/lib/clubs/join-actions";

type JoinClubPanelProps = {
  clubId: string;
  clubName: string;
  inviteToken: string;
  alreadyMember: boolean;
  membershipStatus: string | null;
};

const initialState: JoinClubActionState = { error: null };

export function JoinClubPanel({
  clubId,
  clubName,
  inviteToken,
  alreadyMember,
  membershipStatus,
}: JoinClubPanelProps) {
  const [state, formAction, pending] = useActionState(
    joinClubByInvite,
    initialState
  );

  /* ── Already a member ── */
  if (alreadyMember) {
    const isPending = membershipStatus === "pending";

    return (
      <div className="flex flex-col gap-5">
        <div
          className={`rounded-xl border p-5 ${
            isPending
              ? "border-amber-200 bg-amber-50/80 dark:border-amber-800/50 dark:bg-amber-950/25"
              : "border-emerald-200 bg-emerald-50/80 dark:border-emerald-800/50 dark:bg-emerald-950/25"
          }`}
        >
          {isPending ? (
            <>
              <p className="font-semibold text-amber-900 dark:text-amber-100">
                Your request is pending
              </p>
              <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
                You&apos;ve already requested to join{" "}
                <strong>{clubName}</strong>. An owner or admin still needs to
                approve you. Until then you can&apos;t pay fees or enter a draw.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                You&apos;re already a member
              </p>
              <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
                You&apos;re already in <strong>{clubName}</strong>. Head to the
                club to see draws, payments, and members.
              </p>
            </>
          )}
        </div>
        <Link
          href={`/club/${clubId}`}
          className="w-fit rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          Open {clubName} →
        </Link>
      </div>
    );
  }

  /* ── Joined successfully ── */
  if (state.success) {
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-800/50 dark:bg-emerald-950/25">
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">
            Request sent
          </p>
          <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
            Your membership in <strong>{clubName}</strong> is{" "}
            <strong>pending approval</strong>. An owner or admin will review
            your request — you&apos;ll be able to pay fees and enter draws once
            activated.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-900/40">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            What happens next
          </p>
          <ol className="flex flex-col gap-1.5 pl-4 text-sm text-neutral-600 dark:text-neutral-400">
            <li className="list-decimal">The club owner or admin reviews your request.</li>
            <li className="list-decimal">Once approved, your status changes to <strong className="font-medium text-neutral-800 dark:text-neutral-200">Active</strong>.</li>
            <li className="list-decimal">You can then pay fees and be entered into draws.</li>
          </ol>
        </div>
        <Link
          href={`/club/${clubId}`}
          className="w-fit rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          Go to {clubName} →
        </Link>
      </div>
    );
  }

  /* ── Ready to request ── */
  return (
    <div className="flex flex-col gap-5">
      {/* What you're joining */}
      <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-700 dark:bg-neutral-900/40">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          How it works
        </p>
        <ol className="mt-3 flex flex-col gap-1.5 pl-4 text-sm text-neutral-600 dark:text-neutral-400">
          <li className="list-decimal">
            You submit a join request for <strong className="font-medium text-neutral-800 dark:text-neutral-200">{clubName}</strong>.
          </li>
          <li className="list-decimal">
            An owner or admin approves you — your status becomes <strong className="font-medium text-neutral-800 dark:text-neutral-200">Active</strong>.
          </li>
          <li className="list-decimal">
            You pay into draw cycles and are eligible to win a share of the pot.
          </li>
        </ol>
      </div>

      {/* Action */}
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="invite_token" value={inviteToken} />
        {state.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/25 dark:text-red-300" role="alert">
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          {pending ? "Sending request…" : `Request to join ${clubName}`}
        </button>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          You&apos;ll be pending until the owner approves you. Submit once only.
        </p>
      </form>
    </div>
  );
}
