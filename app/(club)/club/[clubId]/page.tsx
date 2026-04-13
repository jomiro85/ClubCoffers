import {
  DrawCycleStatusBadge,
  MembershipStatusBadge,
} from "@/components/status-badges";
import { getEligibleForDrawCycle } from "@/lib/clubs/draw-eligibility";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import Link from "next/link";
import { ClubAuditLog } from "./club-audit-log";
import { ClubInviteLink } from "./club-invite-link";
import { ClubDrawCycleCreateForm } from "./club-draw-cycle-create-form";
import { ClubDrawExecutionForms } from "./club-draw-execution-forms";
import { ClubManualPaymentList } from "./club-manual-payment-list";
import {
  ClubReconciliation,
  type ReconciliationRow,
  type ReconciliationStatus,
} from "./club-reconciliation";
import { ClubMembersTable } from "./club-members-table";
import { ClubNextActions } from "./club-next-actions";
import { ClubStripeConnect } from "./club-stripe-connect";

type ClubPageProps = {
  params: Promise<{ clubId: string }>;
};

function AccessDenied() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
      <p className="text-slate-600">
        You don&apos;t have access to this club, or it doesn&apos;t exist.
      </p>
    </main>
  );
}

const MEMBER_ROLES = ["owner", "admin", "member"] as const;
type MemberRole = (typeof MEMBER_ROLES)[number];

function isMemberRole(r: string): r is MemberRole {
  return (MEMBER_ROLES as readonly string[]).includes(r);
}

/**
 * Derive a reconciliation status for one member in a specific cycle.
 * Mirrors the eligibility logic in lib/clubs/draw-eligibility.ts.
 *
 * Status model:
 *   pending_member          – not yet approved; no payments or draws possible.
 *   suspended_or_cancelled  – excluded; payment not expected.
 *   paid_and_eligible       – active, paid, joined before period_start → in draw.
 *   paid_but_not_eligible   – active, paid, but joined on/after period_start → pot
 *                             counts but not eligible for draw.
 *   unpaid_active           – active, no succeeded payment → follow-up required.
 */
function computeReconStatus(
  membershipStatus: string,
  joinedAt: string | null,
  periodStart: string,
  hasSucceededPayment: boolean
): ReconciliationStatus {
  if (membershipStatus === "pending") return "pending_member";
  if (
    membershipStatus === "suspended" ||
    membershipStatus === "cancelled"
  )
    return "suspended_or_cancelled";
  if (!hasSucceededPayment) return "unpaid_active";
  // Has payment — check join-date eligibility
  if (!joinedAt || !periodStart) return "paid_and_eligible"; // fallback: assume eligible
  if (new Date(joinedAt) >= new Date(periodStart)) return "paid_but_not_eligible";
  return "paid_and_eligible";
}

/**
 * Format a pence integer as a pound string for display.
 * 1000 → "£10.00", 0 → "£0.00"
 */
function fmtPence(p: number): string {
  return `£${(p / 100).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPeriodDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** Format a Date as a datetime-local string (YYYY-MM-DDTHH:mm) in UTC.
 *  Predictable across server environments; users can adjust after seeing the value. */
function toDatetimeLocal(d: Date): string {
  return d.toISOString().slice(0, 16);
}

/**
 * Derive smart defaults for the NEXT cycle based on the previous one.
 *
 * Rule (simple and predictable for v1):
 *   - nextStart = prevEnd         (starts exactly where the previous cycle ended)
 *   - nextEnd   = prevEnd + Δ    (where Δ = prevEnd − prevStart — same duration)
 *   - name      = "Cycle N – Month YYYY" based on nextStart
 *
 * Using the exact same duration (not calendar months) keeps the logic simple
 * and deterministic regardless of month length. Owners can always adjust.
 */
function computeNextCycleDefaults(prevCycle: {
  period_start: string;
  period_end: string;
  cycle_number: number;
}): { name: string; periodStart: string; periodEnd: string } {
  const prevStart = new Date(prevCycle.period_start);
  const prevEnd = new Date(prevCycle.period_end);
  const durationMs = prevEnd.getTime() - prevStart.getTime();

  const nextStart = new Date(prevEnd);
  const nextEnd = new Date(prevEnd.getTime() + durationMs);
  const nextNumber = prevCycle.cycle_number + 1;

  const monthName = nextStart.toLocaleString("en-GB", {
    month: "long",
    timeZone: "UTC",
  });
  const year = nextStart.getUTCFullYear();

  return {
    name: `Cycle ${nextNumber} – ${monthName} ${year}`,
    periodStart: toDatetimeLocal(nextStart),
    periodEnd: toDatetimeLocal(nextEnd),
  };
}

function rolePill(role: string) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  if (role === "owner")
    return <span className={`${base} bg-[#0f2444] text-white`}>Owner</span>;
  if (role === "admin")
    return <span className={`${base} bg-slate-700 text-white`}>Admin</span>;
  return (
    <span className={`${base} bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/15`}>
      Member
    </span>
  );
}

/* ── Card wrapper ─────────────────────────────────────────── */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
      <div>
        <h2 className="text-base font-semibold text-[#0c1526]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="ml-4 shrink-0">{action}</div> : null}
    </div>
  );
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { clubId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <AccessDenied />;

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, slug, monthly_fee_pence, invite_token, stripe_account_id")
    .eq("id", clubId)
    .maybeSingle();

  if (clubError || !club) return <AccessDenied />;

  const { data: viewerMembership } = await supabase
    .from("memberships")
    .select("id, role, status")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!viewerMembership || !isMemberRole(viewerMembership.role)) {
    return <AccessDenied />;
  }

  const viewerRole = viewerMembership.role;
  const canManage = viewerRole === "owner" || viewerRole === "admin";

  const { data: maxCycleRow } = await supabase
    .from("draw_cycles")
    .select("cycle_number")
    .eq("club_id", club.id)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextCycleNumber = (maxCycleRow?.cycle_number ?? 0) + 1;

  const { data: allCyclesRaw } = await supabase
    .from("draw_cycles")
    .select(
      "id, cycle_number, name, period_start, period_end, status, total_pot_pence, club_share_pence, winner_share_pence, platform_fee_pence, eligible_entries_snapshot"
    )
    .eq("club_id", club.id)
    .order("cycle_number", { ascending: false });

  const allCycles = allCyclesRaw ?? [];
  const latestCycle = allCycles[0] ?? null;
  const openCycle = allCycles.find((c) => c.status === "open") ?? null;

  let latestEligibleCount = 0;
  let latestTotalPotDisplay = 0;
  if (latestCycle) {
    if (latestCycle.status === "open") {
      const { eligible, totalPotPence } = await getEligibleForDrawCycle(
        supabase,
        club.id,
        { id: latestCycle.id, period_start: latestCycle.period_start }
      );
      latestEligibleCount = eligible.length;
      latestTotalPotDisplay = totalPotPence;
    } else {
      const snap = latestCycle.eligible_entries_snapshot;
      latestEligibleCount = Array.isArray(snap) ? snap.length : 0;
      latestTotalPotDisplay = Number(latestCycle.total_pot_pence ?? 0);
    }
  }

  const { data: membershipRows, error: membershipsError } = await supabase
    .from("memberships")
    .select("id, user_id, role, status, joined_at")
    .eq("club_id", club.id)
    .order("joined_at", { ascending: true });

  if (membershipsError) {
    return (
      <main className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-slate-900">{club.name}</h1>
        <p className="text-red-600" role="alert">
          Could not load members: {membershipsError.message}
        </p>
      </main>
    );
  }

  const userIds = Array.from(
    new Set((membershipRows ?? []).map((m) => m.user_id))
  );

  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", userIds);

  const displayNameByUserId = new Map(
    (profileRows ?? []).map((p) => [p.id, p.display_name])
  );

  const members = (membershipRows ?? []).map((m) => ({
    membershipId: m.id,
    userId: m.user_id,
    displayName: displayNameByUserId.get(m.user_id) ?? null,
    role: m.role,
    status: m.status,
    joinedAt: (m.joined_at as string | null) ?? null,
  }));

  const pendingCount = members.filter((m) => m.status === "pending").length;
  const suspendedCancelledCount = members.filter(
    (m) => m.status === "suspended" || m.status === "cancelled"
  ).length;

  // Build a map of cycleId → winner display name for ALL drawn/settled cycles.
  // This is used by both the current-cycle card and the cycle history table.
  const drawnCycleIds = allCycles
    .filter((c) => c.status === "drawn" || c.status === "settled")
    .map((c) => c.id);

  const winnerNameByCycleId = new Map<string, string | null>();

  if (drawnCycleIds.length > 0) {
    const { data: winEntries } = await supabase
      .from("draw_entries")
      .select("draw_cycle_id, membership_id")
      .in("draw_cycle_id", drawnCycleIds)
      .eq("is_winner", true);

    for (const e of winEntries ?? []) {
      // Look up winner name from the members we already fetched for this page.
      // `members` includes all memberships (even cancelled) so the lookup is safe.
      const name =
        members.find((m) => m.membershipId === e.membership_id)?.displayName ??
        null;
      winnerNameByCycleId.set(e.draw_cycle_id as string, name);
    }

    // Ensure every drawn cycle has an entry (null = draw run but no winner found)
    for (const id of drawnCycleIds) {
      if (!winnerNameByCycleId.has(id)) winnerNameByCycleId.set(id, null);
    }
  }

  const winnerDisplayName = latestCycle
    ? (winnerNameByCycleId.get(latestCycle.id) ?? null)
    : null;

  // Fetch succeeded payments for the latest cycle (covers open, closed, drawn, settled).
  // If the latest cycle IS the open cycle the data is the same; we just widen the scope
  // so the reconciliation panel can show historical data too.
  let latestCyclePayments: { membership_id: string; amount_pence: number }[] =
    [];
  if (latestCycle) {
    const { data: payData } = await supabase
      .from("payments")
      .select("membership_id, amount_pence")
      .eq("draw_cycle_id", latestCycle.id)
      .eq("status", "succeeded");
    latestCyclePayments = payData ?? [];
  }

  // For the members-table payment column we only show payment status when there is an
  // open cycle; an empty set is correct when the payment column is hidden anyway.
  const paidMembershipIds = new Set(
    openCycle ? latestCyclePayments.map((p) => p.membership_id) : []
  );

  const paymentByMembershipId = new Map(
    latestCyclePayments.map((p) => [p.membership_id, Number(p.amount_pence ?? 0)])
  );

  const reconciliationRows: ReconciliationRow[] = members.map((m) => {
    const paymentAmountPence = paymentByMembershipId.get(m.membershipId) ?? 0;
    const hasSucceededPayment = paymentAmountPence > 0;
    const reconStatus = computeReconStatus(
      m.status,
      m.joinedAt,
      latestCycle?.period_start ?? "",
      hasSucceededPayment
    );
    return {
      membershipId: m.membershipId,
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
      membershipStatus: m.status,
      joinedAt: m.joinedAt,
      hasSucceededPayment,
      paymentAmountPence,
      reconStatus,
      isEligible: reconStatus === "paid_and_eligible",
    };
  });

  // Members who are active but haven't paid — shown in the "Mark as paid" form.
  const manualPaymentRows = reconciliationRows
    .filter((r) => r.reconStatus === "unpaid_active")
    .map((r) => ({ membershipId: r.membershipId, displayName: r.displayName }));

  const activeMemberCount = members.filter((m) => m.status === "active").length;

  const summaryPotPence =
    openCycle != null
      ? latestTotalPotDisplay
      : latestCycle != null
        ? Number(latestCycle.total_pot_pence ?? 0)
        : null;

  const closedSnapshotLen =
    latestCycle?.status === "closed" &&
    Array.isArray(latestCycle.eligible_entries_snapshot)
      ? latestCycle.eligible_entries_snapshot.length
      : 0;
  const runPotClosed =
    latestCycle?.status === "closed"
      ? Number(latestCycle.total_pot_pence ?? 0)
      : 0;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const inviteUrl = `${proto}://${host}/join/${club.invite_token}`;

  const viewerStatus = viewerMembership?.status ?? "";
  const canCreateCycle = !openCycle && canManage;

  // Smart defaults for the "create next cycle" form — derived from the previous cycle.
  // Only computed when the form will actually be shown (canCreateCycle).
  const nextCycleDefaults =
    canCreateCycle && latestCycle
      ? computeNextCycleDefaults(latestCycle)
      : null;
  const canCloseCycle = Boolean(latestCycle?.status === "open" && canManage);
  const canRunDraw = Boolean(latestCycle?.status === "closed" && canManage);

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── Page header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2 border-l-[3px] border-[#0f2444] pl-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#0c1526]">
              {club.name}
            </h1>
            {rolePill(viewerRole)}
          </div>
          <p className="text-sm text-slate-500">
            <span className="font-mono text-xs">{club.slug}</span>
            <span className="mx-2 text-slate-300">·</span>
            {fmtPence(club.monthly_fee_pence)} / month
          </p>
        </div>
        {latestCycle ? (
          <Link
            href={`/club/${club.id}/cycles/${latestCycle.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
          >
            View latest cycle →
          </Link>
        ) : null}
      </div>

      {/* ── Membership status (non-active warning) ── */}
      {viewerStatus === "pending" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-semibold text-amber-800">
            Your membership is pending approval
          </p>
          <p className="mt-1 text-sm text-amber-700">
            An owner or admin needs to approve you before you can pay fees or
            enter a draw.
          </p>
        </div>
      ) : null}
      {viewerStatus === "suspended" || viewerStatus === "cancelled" ? (
        <div className="rounded-xl border border-red-100 bg-red-50 px-5 py-4">
          <p className="text-sm font-semibold text-red-800">
            Your membership is <MembershipStatusBadge status={viewerStatus} />
          </p>
          <p className="mt-1 text-sm text-red-700">
            You&apos;re not eligible for new draws in this state.
          </p>
        </div>
      ) : null}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Active members",
            value: activeMemberCount,
            accent: false,
            primary: true,
          },
          {
            label: "Pending approval",
            value: pendingCount,
            accent: pendingCount > 0,
            primary: false,
          },
          {
            label: "Inactive",
            value: suspendedCancelledCount,
            accent: false,
            primary: false,
          },
          {
            label: openCycle ? "Current pot" : "Latest pot",
            value: summaryPotPence != null ? fmtPence(summaryPotPence) : "—",
            accent: false,
            primary: false,
          },
        ].map((s) => (
          <Card
            key={s.label}
            className={`p-5 ${s.primary ? "border-t-2 border-t-[#0f2444]" : ""}`}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {s.label}
            </p>
            <p
              className={`mt-2.5 text-2xl font-bold tabular-nums ${
                s.accent ? "text-amber-600" : "text-[#0c1526]"
              }`}
            >
              {s.value}
            </p>
          </Card>
        ))}
      </div>

      {/* ── Current cycle ── */}
      <Card>
        <CardHeader
          title="Current cycle"
          description="The active cycle drives fee collection and the draw."
          action={
            latestCycle ? (
              <Link
                href={`/club/${club.id}/cycles/${latestCycle.id}`}
                className="text-sm font-medium text-slate-500 underline underline-offset-2 hover:text-slate-900"
              >
                Full details
              </Link>
            ) : undefined
          }
        />
        <div className="px-6 py-6">
          {latestCycle ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-[#0c1526]">
                    {latestCycle.name}
                  </p>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Cycle #{latestCycle.cycle_number}
                  </p>
                </div>
                <DrawCycleStatusBadge status={latestCycle.status} />
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    label: "Period start",
                    value: formatPeriodDate(latestCycle.period_start),
                    mono: false,
                  },
                  {
                    label: "Period end",
                    value: formatPeriodDate(latestCycle.period_end),
                    mono: false,
                  },
                  {
                    label: "Total pot",
                    value: fmtPence(latestTotalPotDisplay),
                    mono: true,
                  },
                  {
                    label: "Eligible entries",
                    value: String(latestEligibleCount),
                    mono: true,
                  },
                ].map((d) => (
                  <div key={d.label}>
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {d.label}
                    </p>
                    <p
                      className={`mt-1.5 text-base font-semibold text-[#0c1526] ${d.mono ? "font-mono" : ""}`}
                    >
                      {d.value}
                    </p>
                  </div>
                ))}
              </div>

              {(latestCycle.status === "drawn" ||
                latestCycle.status === "settled") &&
              winnerDisplayName ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
                    Draw result
                  </p>
                  <p className="mt-1.5 text-xl font-bold text-emerald-900">
                    {winnerDisplayName}
                  </p>
                  <p className="mt-0.5 text-sm text-emerald-700">
                    Winner of this cycle
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <p className="text-sm font-medium text-slate-600">
                No draw cycles yet
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {canManage
                  ? "Create your first cycle below when you're ready."
                  : "An owner or admin will create the first cycle."}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ── Ready-for-next-cycle banner (owner/admin) ── */}
      {canManage &&
      canCreateCycle &&
      latestCycle &&
      (latestCycle.status === "drawn" || latestCycle.status === "settled") ? (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              {latestCycle.name} is complete — ready for the next cycle
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Dates are pre-filled based on the previous cycle&apos;s cadence.
              Scroll down to review and create.
            </p>
          </div>
          <a
            href="#create-cycle"
            className="shrink-0 rounded-lg bg-[#0f2444] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0a1834]"
          >
            Create Cycle {latestCycle.cycle_number + 1} ↓
          </a>
        </div>
      ) : null}

      {/* ── Reconciliation (owner/admin) ── */}
      {canManage && latestCycle ? (
        <ClubReconciliation
          cycleName={latestCycle.name}
          cycleNumber={latestCycle.cycle_number}
          cycleStatus={latestCycle.status}
          monthlyFeePence={club.monthly_fee_pence}
          rows={reconciliationRows}
          isOpenCycle={Boolean(openCycle)}
        />
      ) : null}

      {/* ── Next actions (owner/admin) ── */}
      {canManage ? (
        <ClubNextActions
          clubId={club.id}
          latestCycleId={latestCycle?.id ?? null}
          latestCycleNumber={latestCycle?.cycle_number ?? null}
          latestCycleName={latestCycle?.name ?? null}
          latestCycleStatus={latestCycle?.status ?? null}
          pendingCount={pendingCount}
          hasOpenCycle={Boolean(openCycle)}
          canCreateCycle={canCreateCycle}
          canCloseCycle={canCloseCycle}
          canRunDraw={canRunDraw}
        />
      ) : null}

      {/* ── Create cycle ── */}
      {canCreateCycle ? (
        <ClubDrawCycleCreateForm
          clubId={club.id}
          defaultCycleNumber={nextCycleNumber}
          defaultName={nextCycleDefaults?.name}
          defaultPeriodStart={nextCycleDefaults?.periodStart}
          defaultPeriodEnd={nextCycleDefaults?.periodEnd}
        />
      ) : null}

      {/* ── Close / run draw ── */}
      {canManage ? (
        <ClubDrawExecutionForms
          clubId={club.id}
          closeCycleId={
            latestCycle?.status === "open" ? latestCycle.id : null
          }
          runCycleId={
            latestCycle?.status === "closed" ? latestCycle.id : null
          }
          closeEligibleCount={
            latestCycle?.status === "open" ? latestEligibleCount : 0
          }
          closeTotalPotPence={
            latestCycle?.status === "open" ? latestTotalPotDisplay : 0
          }
          runEntryCount={closedSnapshotLen}
          runTotalPotPence={runPotClosed}
        />
      ) : null}

      {/* ── Invite link ── */}
      <ClubInviteLink
        clubId={club.id}
        inviteUrl={inviteUrl}
        inviteToken={club.invite_token}
        canManage={canManage}
      />

      {/* ── Members ── */}
      <ClubMembersTable
        clubId={club.id}
        viewerUserId={user.id}
        viewerRole={viewerRole}
        hasOpenCycle={Boolean(openCycle)}
        paidMembershipIds={Array.from(paidMembershipIds)}
        members={members.map((m) => ({
          membershipId: m.membershipId,
          userId: m.userId,
          displayName: m.displayName,
          role: m.role,
          status: m.status,
        }))}
      />

      {/* ── Mark as paid ── */}
      {openCycle && canManage ? (
        <Card>
          <CardHeader
            title="Mark as paid"
            description="Record that an active member has paid the fee for the open cycle. Each member once per cycle."
          />
          <div
            id="mark-paid"
            className="scroll-mt-8 px-6 py-5"
          >
            <ClubManualPaymentList
              clubId={club.id}
              drawCycleId={openCycle.id}
              rows={manualPaymentRows}
            />
          </div>
        </Card>
      ) : null}

      {/* ── Stripe Connect (owner/admin) ── */}
      {canManage ? (
        <ClubStripeConnect
          clubId={club.id}
          stripeAccountId={(club.stripe_account_id as string | null) ?? null}
        />
      ) : null}

      {/* ── All cycles ── */}
      <Card>
        <CardHeader
          title="Cycle history"
          description="All draw cycles for this club, most recent first."
        />
        <div className="px-6 py-5">
          {allCycles.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["#", "Name", "Period", "Pot", "Status", "Winner", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-slate-400"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {allCycles.map((c) => {
                    const isLatest = c.id === latestCycle?.id;
                    const potPence = Number(c.total_pot_pence ?? 0);
                    const winner = winnerNameByCycleId.get(c.id);
                    const showWinner =
                      c.status === "drawn" || c.status === "settled";
                    return (
                      <tr
                        key={c.id}
                        className={`border-b border-slate-50 last:border-0 ${
                          isLatest ? "bg-[#f7f9fc]" : ""
                        }`}
                      >
                        <td className="py-3.5 pr-4 font-mono text-xs text-slate-400">
                          {c.cycle_number}
                        </td>
                        <td className="py-3.5 pr-4 font-medium text-[#0c1526]">
                          <Link
                            href={`/club/${club.id}/cycles/${c.id}`}
                            className="underline underline-offset-2 hover:text-[#0f2444]"
                          >
                            {c.name}
                          </Link>
                        </td>
                        <td className="py-3.5 pr-4 text-sm text-slate-500">
                          {formatPeriodDate(c.period_start)}
                          <span className="mx-1.5 text-slate-300">–</span>
                          {formatPeriodDate(c.period_end)}
                        </td>
                        <td className="py-3.5 pr-4 font-mono text-sm text-slate-700">
                          {potPence > 0 ? fmtPence(potPence) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="py-3.5 pr-4">
                          <DrawCycleStatusBadge status={c.status} />
                        </td>
                        <td className="py-3.5 pr-4 text-sm">
                          {showWinner ? (
                            winner != null ? (
                              <span className="font-medium text-emerald-700">
                                {winner}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="py-3.5">
                          {isLatest ? (
                            <span className="rounded-full bg-[#e8eef7] px-2 py-0.5 text-xs font-medium text-[#0f2444]">
                              Current
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400">No cycles yet.</p>
          )}
        </div>
      </Card>

      {/* ── Audit log — owner/admin only ── */}
      {canManage ? <ClubAuditLog clubId={club.id} /> : null}
    </div>
  );
}
