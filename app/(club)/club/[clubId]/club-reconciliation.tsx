import {
  DrawCycleStatusBadge,
  MembershipStatusBadge,
} from "@/components/status-badges";

/**
 * Reconciliation status for a single member within a specific draw cycle.
 *
 * Active-member statuses:
 *   paid_eligible        Active, joined before period_start, paid → in the draw.
 *   paid_not_eligible    Active, paid, but joined on/after period_start → fee still
 *                        collected but excluded from this cycle's draw (late joiner).
 *   unpaid               Active, no succeeded payment → not eligible; needs follow-up.
 *
 * Non-active-member statuses:
 *   pending_member          Awaiting approval; cannot pay or enter draws yet.
 *   suspended_or_cancelled  Excluded from all draws; payment not expected.
 *
 * The "eligible" flag mirrors the draw-eligibility rule in lib/clubs/draw-eligibility.ts:
 *   active AND joined_at < period_start AND has a succeeded payment for this cycle.
 */
export type ReconciliationStatus =
  | "pending_member"
  | "suspended_or_cancelled"
  | "paid_eligible"
  | "paid_not_eligible"
  | "unpaid";

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
};

/* ── Helpers ────────────────────────────────────────────────── */

function fmtPence(p: number): string {
  return `${p.toLocaleString("en-GB")}p`;
}

type ReconMeta = { label: string; cls: string };

function reconMeta(s: ReconciliationStatus): ReconMeta {
  switch (s) {
    case "paid_eligible":
      return {
        label: "Paid & eligible",
        cls: "text-emerald-700 bg-emerald-50 border-emerald-200",
      };
    case "paid_not_eligible":
      return {
        label: "Paid (late joiner)",
        cls: "text-amber-700 bg-amber-50 border-amber-200",
      };
    case "unpaid":
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

/** Sort order: most-actionable rows first. */
const SORT_ORDER: Record<ReconciliationStatus, number> = {
  unpaid: 0,
  paid_not_eligible: 1,
  paid_eligible: 2,
  pending_member: 3,
  suspended_or_cancelled: 4,
};

/* ── Sub-components ─────────────────────────────────────────── */

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  tone?: "neutral" | "alert" | "dim";
}) {
  const valueCls =
    tone === "alert"
      ? "text-red-600"
      : tone === "dim"
        ? "text-slate-400"
        : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${valueCls}`}>
        {value}
      </p>
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
}: ClubReconciliationProps) {
  /* ── Derived counts ── */
  const activeRows = rows.filter((r) => r.membershipStatus === "active");
  const pendingRows = rows.filter((r) => r.membershipStatus === "pending");
  const suspCancelRows = rows.filter(
    (r) =>
      r.membershipStatus === "suspended" || r.membershipStatus === "cancelled"
  );
  const paidEligibleRows = rows.filter((r) => r.reconStatus === "paid_eligible");
  const paidNotEligibleRows = rows.filter(
    (r) => r.reconStatus === "paid_not_eligible"
  );
  const unpaidRows = rows.filter((r) => r.reconStatus === "unpaid");
  const eligibleRows = rows.filter((r) => r.isEligible);

  /* ── Financial totals ── */
  const expectedPence = activeRows.length * monthlyFeePence;
  const collectedPence = rows.reduce((s, r) => s + r.paymentAmountPence, 0);
  const shortfallPence = expectedPence - collectedPence;

  const sorted = [...rows].sort(
    (a, b) => SORT_ORDER[a.reconStatus] - SORT_ORDER[b.reconStatus]
  );

  return (
    <section
      id="reconciliation"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Cycle reconciliation
          </h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Cycle #{cycleNumber}: {cycleName} — who has paid and who is eligible
            for the draw.
          </p>
        </div>
        <DrawCycleStatusBadge status={cycleStatus} />
      </div>

      {/* Metrics */}
      <div className="flex flex-col gap-5 border-b border-slate-100 px-6 py-5">
        {/* Members */}
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Members
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Total" value={rows.length} />
            <MetricCard label="Active" value={activeRows.length} />
            <MetricCard
              label="Pending"
              value={pendingRows.length}
              tone={pendingRows.length > 0 ? "alert" : "dim"}
            />
            <MetricCard
              label="Suspended / Cancelled"
              value={suspCancelRows.length}
              tone={suspCancelRows.length === 0 ? "dim" : "neutral"}
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
              label="Paid &amp; eligible"
              value={paidEligibleRows.length}
            />
            <MetricCard
              label="Unpaid"
              value={unpaidRows.length}
              tone={unpaidRows.length > 0 ? "alert" : "dim"}
            />
            {paidNotEligibleRows.length > 0 ? (
              <MetricCard
                label="Paid (late joiners)"
                value={paidNotEligibleRows.length}
                tone="neutral"
              />
            ) : null}
            <MetricCard label="Eligible entries" value={eligibleRows.length} />
          </div>
        </div>

        {/* Financials */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <div>
            <p className="text-xs font-medium text-slate-500">Expected</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-slate-900">
              {fmtPence(expectedPence)}
            </p>
          </div>
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <div>
            <p className="text-xs font-medium text-slate-500">Collected</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-emerald-700">
              {fmtPence(collectedPence)}
            </p>
          </div>
          <div className="hidden h-8 w-px bg-slate-200 sm:block" />
          <div>
            <p className="text-xs font-medium text-slate-500">Shortfall</p>
            <p
              className={`mt-0.5 font-mono text-sm font-semibold ${
                shortfallPence > 0 ? "text-red-600" : "text-slate-900"
              }`}
            >
              {fmtPence(shortfallPence)}
            </p>
          </div>
          <p className="ml-auto hidden text-xs text-slate-400 sm:block">
            {activeRows.length} active × {fmtPence(monthlyFeePence)} fee
          </p>
        </div>
      </div>

      {/* Member table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
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
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const meta = reconMeta(r.reconStatus);
              const rowBg =
                r.reconStatus === "unpaid"
                  ? "bg-red-50/40"
                  : r.reconStatus === "suspended_or_cancelled"
                    ? "bg-slate-50 opacity-60"
                    : "";
              return (
                <tr
                  key={r.membershipId}
                  className={`border-b border-slate-50 last:border-0 ${rowBg}`}
                >
                  <td className="px-6 py-3.5 font-medium text-slate-900">
                    {r.displayName ?? (
                      <span className="font-normal text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {r.role}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <MembershipStatusBadge status={r.membershipStatus} />
                  </td>
                  <td className="px-4 py-3.5 font-mono text-sm text-slate-700">
                    {r.membershipStatus === "active" ? (
                      r.hasSucceededPayment ? (
                        fmtPence(r.paymentAmountPence)
                      ) : (
                        <span className="font-sans text-xs font-medium text-red-500">
                          Unpaid
                        </span>
                      )
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {r.isEligible ? (
                      <span className="text-xs font-medium text-emerald-700">
                        ✓ Yes
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">No</span>
                    )}
                  </td>
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

      {/* Footer */}
      <div className="border-t border-slate-50 px-6 py-3">
        <p className="text-xs text-slate-400">
          Eligible = active membership + joined before cycle start + payment
          recorded for this cycle. Late joiners who paid are excluded from the
          draw but their payment counts toward the pot.
        </p>
      </div>
    </section>
  );
}
