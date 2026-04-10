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
} from "./club-reconciliation";
import { ClubMembersTable } from "./club-members-table";

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
    .select("id, role")
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
  const totalPotPence = succeededPayments.reduce(
    (s, p) => s + p.amount_pence,
    0
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

  let currentCycleLabel = "No cycles yet";
  if (openCycle) {
    currentCycleLabel = `${openCycle.name} (${openCycle.status})`;
  } else if (latestCycle) {
    currentCycleLabel = `No open cycle — latest: ${latestCycle.name} (${latestCycle.status})`;
  }

  const potLabel = openCycle ? `${latestTotalPotDisplay} pence` : "—";
  const eligibleLabel = openCycle ? String(latestEligibleCount) : "—";

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

  return (
    <main className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{club.name}</h1>
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-neutral-500">Slug</dt>
          <dd className="font-mono">{club.slug}</dd>
          <dt className="text-neutral-500">Monthly fee</dt>
          <dd>{club.monthly_fee_pence.toString()} pence</dd>
        </dl>
      </header>

      <ClubInviteLink
        inviteUrl={inviteUrl}
        inviteToken={club.invite_token}
        showToken={showSensitive}
      />

      <section className="flex flex-col gap-3 rounded border border-neutral-300 p-4 dark:border-neutral-600">
        <h2 className="text-lg font-medium">Overview</h2>
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-neutral-500">Current cycle</dt>
          <dd>{currentCycleLabel}</dd>
          <dt className="text-neutral-500">Pot (open cycle)</dt>
          <dd className="font-mono">{potLabel}</dd>
          <dt className="text-neutral-500">Eligible members (open cycle)</dt>
          <dd className="font-mono">{eligibleLabel}</dd>
          <dt className="text-neutral-500">Active members</dt>
          <dd className="font-mono">{activeMemberCount}</dd>
        </dl>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Draw cycles</h2>
        {allCycles.length > 0 ? (
          <div className="overflow-x-auto border border-neutral-300 dark:border-neutral-600">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-300 dark:border-neutral-600">
                  <th className="p-2 font-medium">#</th>
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {allCycles.map((c) => {
                  const isLatest = c.id === latestCycle?.id;
                  const isOpen = c.status === "open";
                  return (
                    <tr
                      key={c.id}
                      className={
                        isLatest
                          ? "border-b border-neutral-200 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/50"
                          : "border-b border-neutral-200 dark:border-neutral-700"
                      }
                    >
                      <td className="p-2 font-mono">{c.cycle_number}</td>
                      <td className="p-2">
                        <Link
                          href={`/club/${club.id}/cycles/${c.id}`}
                          className="text-neutral-900 underline dark:text-neutral-100"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="p-2 font-mono">{c.status}</td>
                      <td className="p-2 text-xs text-neutral-600 dark:text-neutral-400">
                        {isLatest ? (
                          <span className="mr-2 rounded bg-neutral-200 px-1.5 py-0.5 dark:bg-neutral-700">
                            Latest
                          </span>
                        ) : null}
                        {isOpen ? (
                          <span className="rounded bg-neutral-200 px-1.5 py-0.5 dark:bg-neutral-700">
                            Open
                          </span>
                        ) : null}
                        {!isLatest && !isOpen ? "—" : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            No draw cycles yet.
          </p>
        )}
        {latestCycle ? (
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-neutral-600 dark:text-neutral-400">
              Latest cycle snapshot:{" "}
              <span className="font-mono text-neutral-900 dark:text-neutral-100">
                {latestTotalPotDisplay} pence
              </span>{" "}
              pot ·{" "}
              <span className="font-mono text-neutral-900 dark:text-neutral-100">
                {latestEligibleCount}
              </span>{" "}
              eligible entries.
            </p>
            <p>
              <Link
                href={`/club/${club.id}/cycles/${latestCycle.id}`}
                className="text-neutral-900 underline dark:text-neutral-100"
              >
                View full details for {latestCycle.name}
              </Link>
            </p>
          </div>
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
        {!openCycle && canManage ? (
          <ClubDrawCycleCreateForm
            clubId={club.id}
            defaultCycleNumber={nextCycleNumber}
          />
        ) : null}
      </section>

      <ClubAuditLog clubId={club.id} />

      {openCycle ? (
        <>
          <ClubReconciliation
            totalPotPence={totalPotPence}
            rows={reconciliationRows}
          />
          {canManage ? (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-medium">Mark as paid</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                For the open draw cycle only: mark an active, unpaid member as
                paid (monthly fee). Each member can only be marked once per
                cycle.
              </p>
              <ClubManualPaymentList
                clubId={club.id}
                drawCycleId={openCycle.id}
                rows={manualPaymentRows}
              />
            </section>
          ) : null}
        </>
      ) : null}

      <ClubMembersTable
        clubId={club.id}
        viewerUserId={user.id}
        viewerRole={viewerRole}
        members={members.map((m) => ({
          userId: m.userId,
          displayName: m.displayName,
          role: m.role,
          status: m.status,
        }))}
      />
    </main>
  );
}
