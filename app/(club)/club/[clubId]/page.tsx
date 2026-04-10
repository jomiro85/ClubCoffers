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
  type ReconciliationRow,
} from "./club-reconciliation";
import { ClubMembersTable } from "./club-members-table";
import { ClubNextActions } from "./club-next-actions";

type ClubPageProps = {
  params: Promise<{ clubId: string }>;
};

function AccessDenied() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="text-neutral-700 dark:text-neutral-300">
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

function buildReconciliationLabel(
  membershipStatus: string,
  hasSucceededPayment: boolean
): ReconciliationRow["reconciliationLabel"] {
  if (membershipStatus === "pending") {
    return "pending_member";
  }
  if (membershipStatus === "active") {
    return hasSucceededPayment ? "eligible_candidate" : "unpaid";
  }
  if (
    membershipStatus === "suspended" ||
    membershipStatus === "cancelled"
  ) {
    return "suspended_or_cancelled";
  }
  return "suspended_or_cancelled";
}

function formatPeriodDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { clubId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AccessDenied />;
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, slug, monthly_fee_pence, invite_token")
    .eq("id", clubId)
    .maybeSingle();

  if (clubError || !club) {
    return <AccessDenied />;
  }

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
  const openCycle =
    allCycles.find((c) => c.status === "open") ?? null;

  let latestEligibleCount = 0;
  let latestTotalPotDisplay = 0;
  if (latestCycle) {
    if (latestCycle.status === "open") {
      const { eligible, totalPotPence } = await getEligibleForDrawCycle(
        supabase,
        club.id,
        {
          id: latestCycle.id,
          period_start: latestCycle.period_start,
        }
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
        <h1 className="text-xl font-semibold">{club.name}</h1>
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
  }));

  const pendingCount = members.filter((m) => m.status === "pending").length;
  const suspendedCancelledCount = members.filter(
    (m) => m.status === "suspended" || m.status === "cancelled"
  ).length;

  let winnerDisplayName: string | null = null;
  if (
    latestCycle &&
    (latestCycle.status === "drawn" || latestCycle.status === "settled")
  ) {
    const { data: winEntry } = await supabase
      .from("draw_entries")
      .select("membership_id")
      .eq("draw_cycle_id", latestCycle.id)
      .eq("is_winner", true)
      .maybeSingle();
    if (winEntry?.membership_id) {
      winnerDisplayName =
        members.find((m) => m.membershipId === winEntry.membership_id)
          ?.displayName ?? null;
    }
  }

  let succeededPayments: { membership_id: string; amount_pence: number }[] =
    [];
  if (openCycle) {
    const { data: payData } = await supabase
      .from("payments")
      .select("membership_id, amount_pence")
      .eq("draw_cycle_id", openCycle.id)
      .eq("status", "succeeded");
    succeededPayments = payData ?? [];
  }

  const paidMembershipIds = new Set(
    succeededPayments.map((p) => p.membership_id)
  );

  const reconciliationRows: ReconciliationRow[] = members.map((m) => {
    const hasSucceededPayment = paidMembershipIds.has(m.membershipId);
    return {
      membershipId: m.membershipId,
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
      membershipStatus: m.status,
      hasSucceededPayment,
      reconciliationLabel: buildReconciliationLabel(
        m.status,
        hasSucceededPayment
      ),
    };
  });

  const manualPaymentRows = reconciliationRows
    .filter((r) => r.reconciliationLabel === "unpaid")
    .map((r) => ({
      membershipId: r.membershipId,
      displayName: r.displayName,
    }));

  const showSensitive = viewerRole === "owner" || viewerRole === "admin";

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
  const canCloseCycle = Boolean(
    latestCycle?.status === "open" && canManage
  );
  const canRunDraw = Boolean(
    latestCycle?.status === "closed" && canManage
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 pb-12">
      {/* Summary */}
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
              {club.name}
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Slug <span className="font-mono text-neutral-700 dark:text-neutral-300">{club.slug}</span>
              {" · "}
              Fee{" "}
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {club.monthly_fee_pence}p
              </span>{" "}
              / month
            </p>
          </div>
          {latestCycle ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                Latest cycle
              </span>
              <DrawCycleStatusBadge status={latestCycle.status} />
            </div>
          ) : (
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              No cycles yet
            </span>
          )}
        </div>
        <dl className="mt-6 grid gap-4 border-t border-neutral-100 pt-6 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Active members
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {activeMemberCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Pending approval
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {pendingCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              Suspended / cancelled
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {suspendedCancelledCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
              {openCycle ? "Current pot (open)" : "Pot (latest cycle)"}
            </dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {summaryPotPence != null ? (
                <>{summaryPotPence}p</>
              ) : (
                <span className="text-lg text-neutral-400">—</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* Your membership */}
      <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Your membership
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">Status</span>
          <MembershipStatusBadge status={viewerStatus} />
          <span className="text-neutral-400">·</span>
          <span className="text-neutral-600 dark:text-neutral-400">Role</span>
          <span className="font-mono text-xs">{viewerRole}</span>
        </div>
        {viewerStatus === "pending" ? (
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            <strong className="font-medium">Pending</strong> means an owner or
            admin still needs to approve you before you can pay or enter a draw.
          </p>
        ) : null}
        {viewerStatus === "active" ? (
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            When a cycle is open, your payment for that cycle is recorded below
            for each member. Eligibility uses active status, payment, and join
            date vs period start.
          </p>
        ) : null}
        {(viewerStatus === "suspended" || viewerStatus === "cancelled") ? (
          <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">
            You&apos;re not eligible for new draws in this state.
          </p>
        ) : null}
      </section>

      {/* Current cycle */}
      <section
        id="current-cycle"
        className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-700"
      >
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Current cycle
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          The latest cycle drives fees and the draw. Only one cycle can be open
          at a time.
        </p>
        {latestCycle ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                  {latestCycle.name}
                </p>
                <p className="font-mono text-sm text-neutral-500 dark:text-neutral-400">
                  Cycle #{latestCycle.cycle_number}
                </p>
              </div>
              <DrawCycleStatusBadge status={latestCycle.status} />
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Period start
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-neutral-900 dark:text-neutral-100">
                  {formatPeriodDate(latestCycle.period_start)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Period end
                </dt>
                <dd className="mt-0.5 font-mono text-sm text-neutral-900 dark:text-neutral-100">
                  {formatPeriodDate(latestCycle.period_end)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Total pot
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {latestTotalPotDisplay}p
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                  Eligible entries
                </dt>
                <dd className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                  {latestEligibleCount}
                </dd>
              </div>
            </dl>
            {(latestCycle.status === "drawn" ||
              latestCycle.status === "settled") &&
            winnerDisplayName ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/35">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                  Result
                </p>
                <p className="mt-1 text-lg font-semibold text-emerald-950 dark:text-emerald-50">
                  Winner: {winnerDisplayName}
                </p>
              </div>
            ) : null}
            {(latestCycle.status === "drawn" ||
              latestCycle.status === "settled") &&
            !winnerDisplayName ? (
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Draw completed — open cycle details for full results.
              </p>
            ) : null}
            <Link
              href={`/club/${club.id}/cycles/${latestCycle.id}`}
              className="inline-flex text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-100 dark:hover:text-neutral-300"
            >
              View full cycle details →
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            No draw cycles yet.{" "}
            {canManage
              ? "Create a cycle below to start collecting fees for a period."
              : "An owner or admin will create the first cycle."}
          </p>
        )}
      </section>

      {canManage ? (
        <ClubNextActions
          clubId={club.id}
          latestCycleId={latestCycle?.id ?? null}
          pendingCount={pendingCount}
          hasOpenCycle={Boolean(openCycle)}
          canCreateCycle={canCreateCycle}
          canCloseCycle={canCloseCycle}
          canRunDraw={canRunDraw}
        />
      ) : null}

      {canCreateCycle ? (
        <ClubDrawCycleCreateForm
          clubId={club.id}
          defaultCycleNumber={nextCycleNumber}
        />
      ) : null}

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

      <ClubInviteLink
        inviteUrl={inviteUrl}
        inviteToken={club.invite_token}
        showToken={showSensitive}
      />

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

      {openCycle && canManage ? (
        <section
          id="mark-paid"
          className="scroll-mt-8 rounded-xl border border-neutral-200 p-5 dark:border-neutral-700"
        >
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Mark as paid
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Record that an <strong className="font-medium text-neutral-800 dark:text-neutral-200">active</strong> member has paid the fee for the open cycle. Each member once per cycle.
          </p>
          <div className="mt-4">
            <ClubManualPaymentList
              clubId={club.id}
              drawCycleId={openCycle.id}
              rows={manualPaymentRows}
            />
          </div>
        </section>
      ) : null}

      {/* All cycles */}
      <section className="rounded-xl border border-neutral-200 p-5 dark:border-neutral-700">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          All cycles
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          History of every cycle. Open → closed → drawn. Follow a name for the
          full audit trail.
        </p>
        {allCycles.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-600">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/80">
                  <th className="px-3 py-2.5 font-medium">#</th>
                  <th className="px-3 py-2.5 font-medium">Name</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {allCycles.map((c) => {
                  const isLatest = c.id === latestCycle?.id;
                  return (
                    <tr
                      key={c.id}
                      className={
                        isLatest
                          ? "border-b border-neutral-100 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/50"
                          : "border-b border-neutral-100 dark:border-neutral-800"
                      }
                    >
                      <td className="px-3 py-2.5 font-mono text-neutral-600 dark:text-neutral-400">
                        {c.cycle_number}
                      </td>
                      <td className="px-3 py-2.5">
                        <Link
                          href={`/club/${club.id}/cycles/${c.id}`}
                          className="font-medium text-neutral-900 underline underline-offset-2 dark:text-neutral-100"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <DrawCycleStatusBadge status={c.status} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-neutral-500 dark:text-neutral-400">
                        {isLatest ? "Latest" : ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            No cycles yet.
          </p>
        )}
      </section>

      <ClubAuditLog clubId={club.id} />
    </main>
  );
}
