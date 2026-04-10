"use client";

import { useCallback, useState } from "react";

type ClubInviteLinkProps = {
  inviteUrl: string;
  /** Raw token — shown only to owner/admin. */
  inviteToken: string;
  showToken: boolean;
};

export function ClubInviteLink({
  inviteUrl,
  inviteToken,
  showToken,
}: ClubInviteLinkProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  }, [inviteUrl]);

  return (
    <section className="flex max-w-2xl flex-col gap-3 rounded border border-neutral-300 p-4 dark:border-neutral-600">
      <h2 className="text-lg font-medium">Invite members</h2>
      <p className="text-sm text-neutral-700 dark:text-neutral-300">
        Share this link with your club members to join.
      </p>
      <p className="break-all font-mono text-sm text-neutral-900 dark:text-neutral-100">
        <a href={inviteUrl} className="underline">
          {inviteUrl}
        </a>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="rounded border border-neutral-400 bg-neutral-100 px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          Copy link
        </button>
        {status === "copied" ? (
          <span className="text-sm text-green-800 dark:text-green-300">
            Copied to clipboard.
          </span>
        ) : null}
        {status === "error" ? (
          <span className="text-sm text-red-600" role="alert">
            Could not copy. Select the link and copy manually.
          </span>
        ) : null}
      </div>
      {showToken ? (
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Invite token
          </span>
          :{" "}
          <span className="break-all font-mono">{inviteToken}</span>
        </p>
      ) : null}
    </section>
  );
}
