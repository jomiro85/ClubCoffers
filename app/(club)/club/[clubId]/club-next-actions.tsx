import Link from "next/link";

type ClubNextActionsProps = {
  clubId: string;
  latestCycleId: string | null;
  latestCycleNumber: number | null;
  latestCycleName: string | null;
  latestCycleStatus: string | null;
  pendingCount: number;
  hasOpenCycle: boolean;
  canCreateCycle: boolean;
  canCloseCycle: boolean;
  canRunDraw: boolean;
};

const enabledBtn =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300";

const disabledBtn =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-400 cursor-not-allowed select-none";

const primaryBtn =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800";

function stateDescription({
  latestCycleNumber,
  latestCycleName,
  latestCycleStatus,
  hasOpenCycle,
  canCreateCycle,
}: Pick<
  ClubNextActionsProps,
  | "latestCycleNumber"
  | "latestCycleName"
  | "latestCycleStatus"
  | "hasOpenCycle"
  | "canCreateCycle"
>): { text: string; tone: "neutral" | "action" | "complete" } {
  if (!latestCycleStatus) {
    return {
      text: "No cycles yet. Create the first cycle to begin collecting fees.",
      tone: "action",
    };
  }
  const label = latestCycleName ?? `Cycle ${latestCycleNumber}`;
  if (hasOpenCycle) {
    return {
      text: `${label} is open — collect fees, mark payments, then close the cycle.`,
      tone: "neutral",
    };
  }
  if (latestCycleStatus === "closed") {
    return {
      text: `${label} is closed — the entry list is locked. Run the draw to pick a winner.`,
      tone: "action",
    };
  }
  if (latestCycleStatus === "drawn" || latestCycleStatus === "settled") {
    if (canCreateCycle) {
      const next = latestCycleNumber != null ? latestCycleNumber + 1 : null;
      return {
        text: `${label} is complete. ${next != null ? `Create Cycle ${next}` : "Create the next cycle"} when you're ready to run another round.`,
        tone: "complete",
      };
    }
    return {
      text: `${label} is complete.`,
      tone: "complete",
    };
  }
  return { text: "", tone: "neutral" };
}

export function ClubNextActions({
  clubId,
  latestCycleId,
  latestCycleNumber,
  latestCycleName,
  latestCycleStatus,
  pendingCount,
  hasOpenCycle,
  canCreateCycle,
  canCloseCycle,
  canRunDraw,
}: ClubNextActionsProps) {
  const { text: stateText, tone } = stateDescription({
    latestCycleNumber,
    latestCycleName,
    latestCycleStatus,
    hasOpenCycle,
    canCreateCycle,
  });

  const stateBorderCls =
    tone === "action"
      ? "border-amber-100 bg-amber-50 text-amber-800"
      : tone === "complete"
        ? "border-emerald-100 bg-emerald-50 text-emerald-800"
        : "border-slate-100 bg-slate-50 text-slate-600";

  return (
    <section
      id="next-actions"
      className="scroll-mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-base font-semibold text-slate-900">Next actions</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Actions available based on the current club state.
        </p>
      </div>

      <div className="px-6 py-5">
        {/* Current state description */}
        {stateText ? (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm font-medium ${stateBorderCls}`}
          >
            {stateText}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {/* Approve pending */}
          <a
            href="#members"
            className={pendingCount > 0 ? primaryBtn : enabledBtn}
          >
            {pendingCount > 0 ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {pendingCount}
              </span>
            ) : null}
            Approve members
          </a>

          {/* Create cycle */}
          {canCreateCycle ? (
            <a href="#create-cycle" className={enabledBtn}>
              {latestCycleStatus === "drawn" || latestCycleStatus === "settled"
                ? `Create Cycle ${latestCycleNumber != null ? latestCycleNumber + 1 : ""}`
                : "Create cycle"}
            </a>
          ) : (
            <span
              className={disabledBtn}
              title="Close or finish the current open cycle first."
            >
              Create cycle
            </span>
          )}

          {/* Mark paid */}
          {hasOpenCycle ? (
            <a href="#mark-paid" className={enabledBtn}>
              Mark as paid
            </a>
          ) : (
            <span className={disabledBtn} title="Requires an open cycle.">
              Mark as paid
            </span>
          )}

          {/* Close cycle */}
          {canCloseCycle ? (
            <a href="#close-run" className={enabledBtn}>
              Close cycle
            </a>
          ) : (
            <span className={disabledBtn} title="Requires an open cycle.">
              Close cycle
            </span>
          )}

          {/* Run draw */}
          {canRunDraw ? (
            <a href="#close-run" className={primaryBtn}>
              Run draw
            </a>
          ) : (
            <span
              className={disabledBtn}
              title="Requires a closed cycle with entries."
            >
              Run draw
            </span>
          )}

          {/* View cycle details */}
          {latestCycleId ? (
            <Link
              href={`/club/${clubId}/cycles/${latestCycleId}`}
              className={enabledBtn}
            >
              View cycle details
            </Link>
          ) : (
            <span className={disabledBtn}>View cycle details</span>
          )}
        </div>
      </div>
    </section>
  );
}
