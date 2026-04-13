import {
  DrawCycleStatusBadge,
  MembershipStatusBadge,
} from "@/components/status-badges";

/**
 * Reconciliation status for a single member within a specific draw cycle.
 *
 * ─── Active-member statuses ───────────────────────────────────────────────
 *   paid_and_eligible       Active, joined before period_start, succeeded
 *                           payment recorded → in the draw pool.
 *
 *   paid_but_not_eligible   Active, succeeded payment recorded, but joined
 *                           on/after period_start (late joiner). Fee is
 *                           collected and counts toward the pot, but the
 *                           member cannot enter this draw.
 *
 *   unpaid_active           Active, no succeeded payment yet → not eligible.
 *                           Owner/admin needs to follow up.
 *
 * ─── Non-active-member statuses ───────────────────────────────────────────
 *   pending_member          Awaiting approval. Cannot pay or enter draws.
 *
 *   suspended_or_cancelled  Excluded from all draws; payment not expected.
 *
 * ─── Eligibility rule (mirrors lib/clubs/draw-eligibility.ts) ─────────────
 *   isEligible = status==="active" AND joined_at < period_start AND
 *                has a succeeded payment for this cycle.
 */
export type ReconciliationStatus =
  | "pending_member"
  | "suspended_or_cancelled"
  | "paid_and_eligible"
  | "paid_but_not_eligible"
  | "unpaid_active";

export type ReconciliationRow = {
  membershipId: string;
  userId: string;
  displayName: string | null;
  role: string;
  membershipStatus: string;
  joinedAt: string | null;
  hasSucceededPayment: boolean;
  paymentAmountPence: number;
  reconStatus: ReconciliationStatus;
  isEligible: boolean;
};

type ClubReconciliationProps = {
  cycleName: string;
  cycleNumber: number;
  cycleStatus: string;
  /** Club monthly fee in pence — used to compute expected total. */
  monthlyFeePence: number;
  rows: ReconciliationRow[];
  /** True when reconciling the current open cycle (shows a live indicator). */
  isOpenCycle?: boolean;
};

/* ── Helpers ────────────────────────────────────────────────── */

/**
 * Format a pence value as a pound amount.
 * 1000 → "£10.00", 1050 → "£10.50", 0 → "£0.00"
 */
function fmtPence(p: number): string {
  return `£${(p / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type ReconMeta = { label: string; cls: string };

function reconMeta(s: ReconciliationStatus): ReconMeta {
  switch (s) {
    case "paid_and_eligible":
      return {
        label: "Paid & eligible",
        cls: "text-emerald-700 bg-emerald-50 border-emerald-200",
      };
    case "paid_but_not_eligible":
      return {
        label: "Paid · late joiner",
        cls: "text-amber-700 bg-amber-50 border-amber-200",
      };
    case "unpaid_active":
      return {
        label: "Unpaid",
        cls: "text-red-700 bg-red-50 border-red-200",
      };
    case "pending_member":
      return {
        label: "Pending approval",
        cls: "text-slate-600 bg-slate-50 border-slate-200",
      };
    case "suspended_or_cancelled":
      return {
        label: "Excluded",
        cls: "text-slate-400 bg-slate-50 border-slate-100",
      };
  }
}

/** Sort: most-actionable rows first so issues are visible immediately. */
const SORT_ORDER: Record<ReconciliationStatus, number> = {
  unpaid_active: 0,
  paid_but_not_eligible: 1,
  paid_and_eligible: 2,
  pending_member: 3,
  suspended_or_cancelled: 4,
};

/* ── Sub-components ─────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "neutral" | "alert" | "success" | "dim";
}) {
  const valueCls =
    tone === "alert"
      ? "text-red-600"
      : tone === "success"
        ? "text-emerald-700"
        : tone === "dim"
          ? "text-slate-400"
          : "text-slate-900";
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-0.5 text-xl font-semibold tabular-nums ${valueCls}`}>
        {value}
      </p>
      {sub ? <p className="text-xs text-slate-400">{sub}</p> : null}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */

export function ClubReconciliation({
  cycleName,
  cycleNumber,
  cycleStatus,
  monthlyFeePence,
  rows,
  isOpenCycle = false,
}: ClubReconciliationProps) {
  /* ── Derived membership counts ── */
  const activeRows = rows.filter((r) => r.membershipStatus === "active");
  const pendingRows = rows.filter((r) => r.membershipStatus === "pending");
  const suspCancelRows = rows.filter(
    (r) =>
      r.membershipStatus === "suspended" || r.membershipStatus === "cancelled"
  );

  /* ── Derived payment / eligibility counts ── */
  const paidEligibleRows = rows.filter(
    (r) => r.reconStatus === "paid_and_eligible"
  );
  const paidNotEligibleRows = rows.filter(
    (r) => r.reconStatus === "paid_but_not_eligible"
  );
  const unpaidRows = rows.filter((r) => r.reconStatus === "unpaid_active");
  const eligibleRows = rows.filter((r) => r.isEligible);

  /* ── Financial totals ── */
  // Expected = every active member × the monthly fee.
  // Late joiners are still active and still owe the fee; they just can't enter the draw.
  const expectedPence = activeRows.length * monthlyFeePence;
  const collectedPence = rows.reduce((s, r) => s + r.paymentAmountPence, 0);
  const shortfallPence = Math.max(0, expectedPence - collectedPence);
  const hasShortfall = shortfallPence > 0;

  /* ── Needs-attention summary ── */
  const attentionItems: string[] = [];
  if (unpaidRows.length > 0) {
    attentionItems.push(
      `${unpaidRows.length} active ${unpaidRows.length === 1 ? "member has" : "members have"} not paid`
    );
  }
  if (pendingRows.length > 0) {
    attentionItems.push(
      `${pendingRows.length} ${pendingRows.length === 1 ? "member is" : "members are"} pending approval`
    );
  }
  if (hasShortfall) {
    attentionItems.push(`shortfall of ${fmtPence(shortfallPence)}`);
  }
  const needsAttention = attentionItems.length > 0;

  const sorted = [...rows].sort(
    (a, b) => SORT_ORDER[a.reconStatus] - SORT_ORDER[b.reconStatus]
  );

  return (
    <section
      id="reconciliation"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">
              Cycle reconciliation
            </h2>
            {isOpenCycle ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
                Historical
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            Cycle #{cycleNumber}: {cycleName} — who has paid and who qualifies
            for the draw.
          </p>
        </div>
        <DrawCycleStatusBadge status={cycleStatus} />
      </div>

      {/* ── Needs-attention callout ──────────────────────────── */}
      {needsAttention ? (
        <div className="border-b border-amber-100 bg-amber-50 px-6 py-3">
          <p className="text-sm font-medium text-amber-800">
            Needs attention
            {" — "}
            <span className="font-normal text-amber-700">
              {attentionItems.join(" · ")}
            </span>
          </p>
        </div>
      ) : (
        <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-3">
          <p className="text-sm font-medium text-emerald-800">
            All active members paid
            {eligibleRows.length > 0
              ? ` · ${eligibleRows.length} ${eligibleRows.length === 1 ? "entry" : "entries"} eligible for the draw`
              : ""}
          </p>
        </div>
      )}

      {/* ── Metrics ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-5 border-b border-slate-100 px-6 py-5">
        {/* Membership counts */}
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Members
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Total" value={rows.length} />
            <MetricCard
              label="Active"
              value={activeRows.length}
              sub="Can pay and enter draws"
            />
            <MetricCard
              label="Pending"
              value={pendingRows.length}
              tone={pendingRows.length > 0 ? "alert" : "dim"}
              sub="Awaiting approval"
            />
            <MetricCard
              label="Suspended / Cancelled"
              value={suspCancelRows.length}
              tone={suspCancelRows.length > 0 ? "neutral" : "dim"}
              sub="Excluded from draws"
            />
          </div>
        </div>

        {/* Payments & eligibility */}
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Payments &amp; eligibility
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              label="Paid & eligible"
              value={paidEligibleRows.length}
              tone={paidEligibleRows.length > 0 ? "success" : "dim"}
              sub="In the draw pool"
            />
            <MetricCard
              label="Unpaid"
              value={unpaidRows.length}
              tone={unpaidRows.length > 0 ? "alert" : "dim"}
              sub={unpaidRows.length > 0 ? "Needs follow-up" : "None outstanding"}
            />
            <MetricCard
              label="Paid · late joiners"
              value={paidNotEligibleRows.length}
              tone={paidNotEligibleRows.length > 0 ? "neutral" : "dim"}
              sub="Joined after cycle start"
            />
            <MetricCard
              label="Eligible entries"
              value={eligibleRows.length}
              tone={eligibleRows.length > 0 ? "neutral" : "dim"}
              sub="For the draw"
            />
          </div>
        </div>

        {/* Financial summary */}
        <div
          className={`flex flex-wrap items-stretch gap-px overflow-hidden rounded-xl border ${
            hasShortfall
              ? "border-red-200 bg-red-100"
              : "border-slate-200 bg-slate-100"
          }`}
        >
          {/* Expected */}
          <div className="flex flex-1 flex-col gap-0.5 bg-white px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Expected</p>
            <p className="font-mono text-lg font-semibold text-slate-900">
              {fmtPence(expectedPence)}
            </p>
            <p className="text-xs text-slate-400">
              {activeRows.length} active × {fmtPence(monthlyFeePence)}
            </p>
          </div>

          {/* Collected */}
          <div className="flex flex-1 flex-col gap-0.5 bg-white px-5 py-4">
            <p className="text-xs font-medium text-slate-500">Collected</p>
            <p className="font-mono text-lg font-semibold text-emerald-700">
              {fmtPence(collectedPence)}
            </p>
            <p className="text-xs text-slate-400">
              {rows.filter((r) => r.hasSucceededPayment).length} payments
            </p>
          </div>

          {/* Shortfall */}
          <div
            className={`flex flex-1 flex-col gap-0.5 px-5 py-4 ${
              hasShortfall ? "bg-red-50" : "bg-white"
            }`}
          >
            <p className="text-xs font-medium text-slate-500">Shortfall</p>
            <p
              className={`font-mono text-lg font-semibold ${
                hasShortfall ? "text-red-600" : "text-slate-400"
              }`}
            >
              {fmtPence(shortfallPence)}
            </p>
            <p className="text-xs text-slate-400">
              {hasShortfall
                ? `${unpaidRows.length} ${unpaidRows.length === 1 ? "member" : "members"} outstanding`
                : "No shortfall"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Member table ────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Name
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Role
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Membership
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Payment
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Draw eligible
              </th>
              <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Reconciliation state
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const meta = reconMeta(r.reconStatus);
              const rowBg =
                r.reconStatus === "unpaid_active"
                  ? "bg-red-50/50"
                  : r.reconStatus === "suspended_or_cancelled"
                    ? "opacity-60"
                    : "";
              return (
                <tr
                  key={r.membershipId}
                  className={`border-b border-slate-50 last:border-0 ${rowBg}`}
                >
                  {/* Name */}
                  <td className="px-6 py-3.5 font-medium text-slate-900">
                    {r.displayName ?? (
                      <span className="font-normal text-slate-400">
                        Unnamed
                      </span>
                    )}
                  </td>

                  {/* Role */}
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 capitalize">
                      {r.role}
                    </span>
                  </td>

                  {/* Membership status */}
                  <td className="px-4 py-3.5">
                    <MembershipStatusBadge status={r.membershipStatus} />
                  </td>

                  {/* Payment amount */}
                  <td className="px-4 py-3.5">
                    {r.membershipStatus === "active" ? (
                      r.hasSucceededPayment ? (
                        <span className="font-mono text-sm text-slate-900">
                          {fmtPence(r.paymentAmountPence)}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-red-600">
                          Not paid
                        </span>
                      )
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>

                  {/* Draw eligible */}
                  <td className="px-4 py-3.5">
                    {r.isEligible ? (
                      <span className="text-xs font-semibold text-emerald-700">
                        ✓ Yes
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No</span>
                    )}
                  </td>

                  {/* Reconciliation state badge */}
                  <td className="px-4 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}
                    >
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div className="border-t border-slate-100 px-6 py-4">
        <p className="text-xs leading-relaxed text-slate-400">
          <strong className="font-medium text-slate-500">Eligibility rule:</strong>{" "}
          active membership + joined before cycle start + succeeded payment for
          this cycle.{" "}
          <strong className="font-medium text-slate-500">Late joiners</strong>{" "}
          who paid are counted toward the pot but excluded from this draw.{" "}
          <strong className="font-medium text-slate-500">Expected total</strong>{" "}
          = all active members × monthly fee.
        </p>
      </div>
    </section>
  );
}
