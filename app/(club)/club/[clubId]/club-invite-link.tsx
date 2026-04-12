"use client";

import { rotateInviteToken } from "@/lib/clubs/club-admin-actions";
import { useCallback, useActionState, useState } from "react";

type ClubInviteLinkProps = {
  clubId: string;
  inviteUrl: string;
  /** Raw token — shown only to owner/admin. */
  inviteToken: string;
  /** True for owner/admin — shows rotate button and token. */
  canManage: boolean;
};

const initial = { error: null, success: null };

export function ClubInviteLink({
  clubId,
  inviteUrl,
  inviteToken,
  canManage,
}: ClubInviteLinkProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle"
  );
  const [rotateState, rotateAction] = useActionState(rotateInviteToken, initial);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
    }
  }, [inviteUrl]);

  return (
    <section
      id="invite"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">
          Invite members
        </h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Share this link with people you want to invite.{" "}
          {canManage
            ? "New joiners are pending until you approve them in Members."
            : "The club owner will approve your request."}
        </p>
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        {/* Link display + copy */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="min-w-0 flex-1 break-all font-mono text-sm text-slate-800">
            {inviteUrl}
          </p>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300"
          >
            {copyStatus === "copied" ? "Copied!" : "Copy link"}
          </button>
        </div>
        {copyStatus === "error" ? (
          <p className="text-xs text-red-600" role="alert">
            Could not copy automatically — select the link above and copy
            manually.
          </p>
        ) : null}

        {/* Rotate — owner/admin only */}
        {canManage ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  Token:&nbsp;
                </span>
                <span className="font-mono">{inviteToken}</span>
              </p>
              <form
                action={rotateAction}
                onSubmit={(e) => {
                  const confirmed = window.confirm(
                    "Rotate the invite link?\n\nThe current link will stop working immediately. Existing members are not affected."
                  );
                  if (!confirmed) e.preventDefault();
                }}
              >
                <input type="hidden" name="club_id" value={clubId} />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 shadow-sm transition-colors hover:bg-amber-100"
                >
                  Rotate link
                </button>
              </form>
            </div>
            <p className="text-xs text-slate-400">
              Rotating the link invalidates the previous invite. Use this if the
              link was shared too widely or with the wrong people.
            </p>

            {/* Feedback */}
            {rotateState.error ? (
              <p className="text-xs text-red-600" role="alert">
                {rotateState.error}
              </p>
            ) : null}
            {rotateState.success ? (
              <p className="text-xs text-emerald-700">{rotateState.success}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
