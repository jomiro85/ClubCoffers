import Link from "next/link";

type ClubNextActionsProps = {
  clubId: string;
  latestCycleId: string | null;
  pendingCount: number;
  hasOpenCycle: boolean;
  canCreateCycle: boolean;
  canCloseCycle: boolean;
  canRunDraw: boolean;
};

function actionClass(enabled: boolean): string {
  const base =
    "inline-flex items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors";
  if (enabled) {
    return `${base} border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-800 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white`;
  }
  return `${base} cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-500`;
}

export function ClubNextActions({
  clubId,
  latestCycleId,
  pendingCount,
  hasOpenCycle,
  canCreateCycle,
  canCloseCycle,
  canRunDraw,
}: ClubNextActionsProps) {
  return (
    <section
      className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-5 dark:border-neutral-700 dark:bg-neutral-900/40"
      aria-labelledby="next-actions-heading"
    >
      <h2
        id="next-actions-heading"
        className="text-base font-semibold text-neutral-900 dark:text-neutral-100"
      >
        Next actions
      </h2>
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        <strong className="font-medium text-neutral-800 dark:text-neutral-200">
          Pending
        </strong>{" "}
        means the person has requested to join but isn&apos;t active yet — they
        can&apos;t pay or enter a draw until approved.{" "}
        <strong className="font-medium text-neutral-800 dark:text-neutral-200">
          Closing
        </strong>{" "}
        a cycle locks who is in the draw and fixes the pot. The{" "}
        <strong className="font-medium text-neutral-800 dark:text-neutral-200">
          draw
        </strong>{" "}
        can only run after close, with at least one entry (eligible, paid
        members).
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        <li>
          <a href="#members" className={actionClass(true)}>
            Approve pending members
            {pendingCount > 0 ? (
              <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">
                {pendingCount}
              </span>
            ) : null}
          </a>
        </li>
        <li>
          {canCreateCycle ? (
            <a href="#create-cycle" className={actionClass(true)}>
              Create cycle
            </a>
          ) : (
            <span
              className={actionClass(false)}
              title="There is already an open cycle, or you cannot create one."
            >
              Create cycle
            </span>
          )}
        </li>
        <li>
          {hasOpenCycle ? (
            <a href="#mark-paid" className={actionClass(true)}>
              Mark as paid
            </a>
          ) : (
            <span
              className={actionClass(false)}
              title="Open a cycle first to record payments."
            >
              Mark as paid
            </span>
          )}
        </li>
        <li>
          {canCloseCycle ? (
            <a href="#close-run" className={actionClass(true)}>
              Close cycle
            </a>
          ) : (
            <span
              className={actionClass(false)}
              title="Requires an open cycle."
            >
              Close cycle
            </span>
          )}
        </li>
        <li>
          {canRunDraw ? (
            <a href="#close-run" className={actionClass(true)}>
              Run draw
            </a>
          ) : (
            <span
              className={actionClass(false)}
              title="Requires a closed cycle with entries."
            >
              Run draw
            </span>
          )}
        </li>
        <li>
          {latestCycleId ? (
            <Link
              href={`/club/${clubId}/cycles/${latestCycleId}`}
              className={actionClass(true)}
            >
              View cycle details
            </Link>
          ) : (
            <span className={actionClass(false)}>View cycle details</span>
          )}
        </li>
      </ul>
    </section>
  );
}
