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
          className={`rounded-2xl border p-6 ${
            isPending
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50"
          }`}
        >
          {isPending ? (
            <>
              <p className="font-semibold text-amber-800">
                Your request is pending
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-700">
                You&apos;ve already requested to join{" "}
                <strong>{clubName}</strong>. An owner or admin still needs to
                approve you. Until then you can&apos;t pay fees or enter draws.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold text-emerald-800">
                You&apos;re already a member
              </p>
              <p className="mt-2 text-sm leading-relaxed text-emerald-700">
                You&apos;re already in <strong>{clubName}</strong>. Head to the
                club to see draws, payments, and cycle history.
              </p>
            </>
          )}
        </div>
        <Link
          href={`/club/${clubId}`}
          className="inline-flex w-fit rounded-lg bg-[#0f2444] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a1834]"
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="font-semibold text-emerald-800">Request sent</p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-700">
            Your membership in <strong>{clubName}</strong> is{" "}
            <strong>pending approval</strong>. Once approved, you&apos;ll be able
            to pay fees and enter draws.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-[#0c1526]">What happens next</p>
          <ol className="mt-3 flex flex-col gap-2 pl-4 text-sm text-slate-500">
            <li className="list-decimal">The club owner or admin reviews your request.</li>
            <li className="list-decimal">Once approved, your status becomes <strong className="font-medium text-slate-700">Active</strong>.</li>
            <li className="list-decimal">You can then pay fees and be entered into draws.</li>
          </ol>
        </div>
        <Link
          href={`/club/${clubId}`}
          className="inline-flex w-fit rounded-lg bg-[#0f2444] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a1834]"
        >
          Go to {clubName} →
        </Link>
      </div>
    );
  }

  /* ── Ready to request ── */
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm font-semibold text-[#0c1526]">How joining works</p>
        <ol className="mt-3 flex flex-col gap-2 pl-4 text-sm text-slate-500">
          <li className="list-decimal">
            Submit a join request for{" "}
            <strong className="font-medium text-slate-700">{clubName}</strong>.
          </li>
          <li className="list-decimal">
            An owner or admin approves you — your status becomes{" "}
            <strong className="font-medium text-slate-700">Active</strong>.
          </li>
          <li className="list-decimal">
            You pay into draw cycles and are eligible to win a share of the pot.
          </li>
        </ol>
      </div>

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="invite_token" value={inviteToken} />
        {state.error ? (
          <p
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="w-fit rounded-lg bg-[#0f2444] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#0a1834] disabled:opacity-50"
        >
          {pending ? "Sending request…" : `Request to join ${clubName}`}
        </button>
        <p className="text-xs text-slate-400">
          You&apos;ll be pending until an owner approves you.
        </p>
      </form>
    </div>
  );
}
