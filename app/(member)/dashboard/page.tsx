import { DrawCycleStatusBadge, MembershipStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

/* ── Types ──────────────────────────────────────────── */

type ClubRow = { id: string; name: string; monthly_fee_pence: number };

type CycleRow = {
  id: string;
  clubId: string;
  status: string;
  cycleNumber: number;
  name: string;
  periodStart: string;
};

type MembershipCard = {
  membershipId: string;
  role: string;
  status: string;
  joinedAt: string | null;
  club: ClubRow | null;
  latestCycle: CycleRow | null;
  hasPaid: boolean;
  isWinner: boolean;
  isEligible: boolean;
};

/* ── Helpers ────────────────────────────────────────── */

function clubFromRow(
  clubs: ClubRow | ClubRow[] | null
): ClubRow | null {
  if (!clubs) return null;
  return Array.isArray(clubs) ? (clubs[0] ?? null) : clubs;
}

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

function roleBadgeCls(role: string): string {
  if (role === "owner")
    return "bg-violet-100 text-violet-800 border border-violet-200";
  if (role === "admin") return "bg-blue-100 text-blue-800 border border-blue-200";
  return "bg-slate-100 text-slate-700 border border-slate-200";
}

/* ── Metric card ────────────────────────────────────── */

function MetricCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "alert" | "dim";
}) {
  const valCls =
    tone === "alert"
      ? "text-amber-600"
      : tone === "dim"
        ? "text-slate-400"
        : "text-slate-900";
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={`text-2xl font-semibold tabular-nums ${valCls}`}>{value}</p>
    </div>
  );
}

/* ── Cycle status pill ──────────────────────────────── */

function EligibilityPill({
  hasPaid,
  isEligible,
  cycleStatus,
  membershipStatus,
  joinedAt,
  periodStart,
}: {
  hasPaid: boolean;
  isEligible: boolean;
  cycleStatus: string;
  membershipStatus: string;
  joinedAt: string | null;
  periodStart: string;
}) {
  if (membershipStatus !== "active") return null;

  if (cycleStatus !== "open") {
    // Closed/drawn/settled — just note payment state
    return hasPaid ? (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Paid
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
        Not paid
      </span>
    );
  }

  // Open cycle
  if (isEligible) {
    return (
      <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        Paid · Eligible
      </span>
    );
  }

  if (!hasPaid) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        Unpaid
      </span>
    );
  }

  // Paid but joined on/after period start
  const joined = joinedAt ? new Date(joinedAt) : null;
  const period = new Date(periodStart);
  if (joined && joined >= period) {
    return (
      <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500">
        Paid · Late joiner
      </span>
    );
  }

  return null;
}

/* ── Main page ──────────────────────────────────────── */

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  /* 1 — Memberships ─────────────────────────────────── */
  const { data: membershipRows, error } = await supabase
    .from("memberships")
    .select(
      `id, role, status, joined_at,
       clubs ( id, name, monthly_fee_pence )`
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 py-8">
        <h1 className="text-2xl font-semibold">Your clubs</h1>
        <p className="text-sm text-red-600" role="alert">
          Could not load your clubs: {error.message}
        </p>
      </main>
    );
  }

  const rows = membershipRows ?? [];

  /* ── Empty state ─────────────────────────────────── */
  if (rows.length === 0) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-8 py-8 sm:py-10">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Your clubs
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            You&apos;re not part of any club yet. Create one or join with an invite
            link from a club owner.
          </p>
        </header>

        <div className="flex flex-col gap-px overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col gap-3 bg-white px-6 py-6">
            <p className="font-semibold text-slate-900">Start a club</p>
            <p className="text-sm text-slate-500">
              Become the owner, invite members, run draw cycles, and manage payouts.
            </p>
            <Link
              href="/create-club"
              className="w-fit rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
            >
              Create a club
            </Link>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex flex-col gap-3 bg-white px-6 py-6">
            <p className="font-semibold text-slate-900">Join a club</p>
            <p className="text-sm text-slate-500">
              Ask your club owner for an invite link. Open it here, request to join,
              and you&apos;ll be active once they approve you.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* 2 — Enrich with cycle, payment, draw data ────────── */

  const clubIds = rows
    .map((r) => clubFromRow(r.clubs as ClubRow | ClubRow[] | null)?.id)
    .filter((id): id is string => Boolean(id));

  const membershipIds = rows.map((r) => r.id);

  // Latest cycle per club (highest cycle_number wins due to server-side ordering)
  let latestCycleByClub = new Map<string, CycleRow>();
  if (clubIds.length > 0) {
    const { data: cycleData } = await supabase
      .from("draw_cycles")
      .select("id, club_id, status, cycle_number, name, period_start")
      .in("club_id", clubIds)
      .order("cycle_number", { ascending: false });

    for (const c of cycleData ?? []) {
      if (!latestCycleByClub.has(c.club_id)) {
        latestCycleByClub.set(c.club_id, {
          id: c.id,
          clubId: c.club_id,
          status: c.status,
          cycleNumber: c.cycle_number,
          name: c.name,
          periodStart: c.period_start,
        });
      }
    }
  }

  const cycleIds = Array.from(latestCycleByClub.values()).map((c) => c.id);

  // Payments and won draw entries — single query each
  let paidSet = new Set<string>(); // "membershipId:cycleId"
  let wonSet = new Set<string>(); // "membershipId:cycleId"

  if (cycleIds.length > 0 && membershipIds.length > 0) {
    const [{ data: payData }, { data: entryData }] = await Promise.all([
      supabase
        .from("payments")
        .select("membership_id, draw_cycle_id")
        .in("membership_id", membershipIds)
        .in("draw_cycle_id", cycleIds)
        .eq("status", "succeeded"),
      supabase
        .from("draw_entries")
        .select("membership_id, draw_cycle_id")
        .in("membership_id", membershipIds)
        .in("draw_cycle_id", cycleIds)
        .eq("is_winner", true),
    ]);

    for (const p of payData ?? []) {
      paidSet.add(`${p.membership_id}:${p.draw_cycle_id}`);
    }
    for (const e of entryData ?? []) {
      wonSet.add(`${e.membership_id}:${e.draw_cycle_id}`);
    }
  }

  /* 3 — Build enriched cards ─────────────────────────── */

  const cards: MembershipCard[] = rows.map((row) => {
    const club = clubFromRow(row.clubs as ClubRow | ClubRow[] | null);
    const latestCycle = club ? latestCycleByClub.get(club.id) ?? null : null;
    const hasPaid = latestCycle
      ? paidSet.has(`${row.id}:${latestCycle.id}`)
      : false;
    const isWinner = latestCycle
      ? wonSet.has(`${row.id}:${latestCycle.id}`)
      : false;

    const joinedAt = row.joined_at ? new Date(row.joined_at as string) : null;
    const periodStart = latestCycle?.periodStart
      ? new Date(latestCycle.periodStart)
      : null;
    const joinedBeforePeriod =
      joinedAt && periodStart ? joinedAt < periodStart : false;

    const isEligible =
      row.status === "active" &&
      hasPaid &&
      joinedBeforePeriod &&
      latestCycle?.status === "open";

    return {
      membershipId: row.id,
      role: row.role as string,
      status: row.status as string,
      joinedAt: (row.joined_at as string | null) ?? null,
      club,
      latestCycle,
      hasPaid,
      isWinner,
      isEligible,
    };
  });

  /* 4 — Summary stats ────────────────────────────────── */

  const activeCount = cards.filter((c) => c.status === "active").length;
  const pendingCount = cards.filter((c) => c.status === "pending").length;
  const eligibleCount = cards.filter((c) => c.isEligible).length;

  /* 5 — Render ───────────────────────────────────────── */

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 py-8 sm:py-10">
      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Your clubs
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {cards.length === 1 ? "1 club" : `${cards.length} clubs`}
          {pendingCount > 0
            ? ` · ${pendingCount} pending approval`
            : ""}
        </p>
      </header>

      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Active" value={activeCount} />
        <MetricCard
          label="Pending"
          value={pendingCount}
          tone={pendingCount > 0 ? "alert" : "dim"}
        />
        <MetricCard
          label="In the draw"
          value={eligibleCount}
          tone={eligibleCount > 0 ? "neutral" : "dim"}
        />
      </div>

      {/* Club cards */}
      <ul className="flex flex-col gap-4">
        {cards.map((card) => {
          const clubId = card.club?.id ?? "";
          const name = card.club?.name ?? "Unknown club";
          const isPending = card.status === "pending";
          const isSuspended =
            card.status === "suspended" || card.status === "cancelled";

          return (
            <li key={card.membershipId}>
              <div
                className={`overflow-hidden rounded-2xl border shadow-sm ${
                  isPending
                    ? "border-amber-200 bg-amber-50/60"
                    : isSuspended
                      ? "border-slate-200 bg-slate-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-4">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="text-base font-semibold text-slate-900">{name}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeCls(card.role)}`}
                      >
                        {roleLabel(card.role)}
                      </span>
                      <MembershipStatusBadge status={card.status} />
                    </div>
                  </div>
                  {clubId ? (
                    <Link
                      href={`/club/${clubId}`}
                      className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                    >
                      Open club →
                    </Link>
                  ) : null}
                </div>

                {/* Pending notice */}
                {isPending ? (
                  <div className="mx-5 mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-medium text-amber-800">
                      Waiting for approval
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700">
                      A club owner or admin needs to approve your membership before
                      you can pay fees or enter draws.
                    </p>
                  </div>
                ) : null}

                {/* Suspended/cancelled notice */}
                {isSuspended ? (
                  <div className="mx-5 mb-5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3">
                    <p className="text-sm font-medium text-slate-700">
                      Membership {card.status}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Contact the club owner if you believe this is a mistake.
                    </p>
                  </div>
                ) : null}

                {/* Current cycle — active members only */}
                {card.status === "active" && card.latestCycle ? (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                          {card.latestCycle.status === "open"
                            ? "Current cycle"
                            : "Latest cycle"}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            {card.latestCycle.name}
                          </span>
                          <DrawCycleStatusBadge status={card.latestCycle.status} />
                        </div>

                        {/* Payment + eligibility pills */}
                        <div className="flex flex-wrap items-center gap-2">
                          <EligibilityPill
                            hasPaid={card.hasPaid}
                            isEligible={card.isEligible}
                            cycleStatus={card.latestCycle.status}
                            membershipStatus={card.status}
                            joinedAt={card.joinedAt}
                            periodStart={card.latestCycle.periodStart}
                          />
                          {/* Winner badge */}
                          {card.isWinner ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                              You won this draw
                            </span>
                          ) : null}
                        </div>

                        {/* Contextual explanations */}
                        {card.latestCycle.status === "open" && !card.hasPaid ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Pay your fee to become eligible for the draw. Contact your
                            club owner to record your payment.
                          </p>
                        ) : null}
                        {card.latestCycle.status === "open" && card.hasPaid && !card.isEligible ? (
                          <p className="mt-1 text-xs text-slate-500">
                            You paid but joined after the cycle started, so you
                            won&apos;t be in this draw.
                          </p>
                        ) : null}
                        {card.latestCycle.status === "closed" ? (
                          <p className="mt-1 text-xs text-slate-500">
                            The cycle is closed — the draw pool is locked. The owner
                            will run the draw soon.
                          </p>
                        ) : null}
                        {card.latestCycle.status === "drawn" && !card.isWinner ? (
                          <p className="mt-1 text-xs text-slate-500">
                            The draw has been run. You weren&apos;t selected this time.
                          </p>
                        ) : null}
                        {card.latestCycle.status === "settled" && !card.isWinner ? (
                          <p className="mt-1 text-xs text-slate-500">
                            This cycle is complete and settled.
                          </p>
                        ) : null}
                      </div>

                      {/* Link to cycle page */}
                      {clubId ? (
                        <Link
                          href={`/club/${clubId}/cycles/${card.latestCycle.id}`}
                          className="shrink-0 text-xs font-medium text-slate-500 underline underline-offset-2 hover:text-slate-700"
                        >
                          View cycle
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : card.status === "active" && !card.latestCycle ? (
                  <div className="border-t border-slate-100 px-5 py-4">
                    <p className="text-xs text-slate-400">
                      No draw cycle has been started yet.
                    </p>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer CTA */}
      {activeCount > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-sm font-medium text-slate-900">
            Want to start another club?
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            You can run multiple clubs independently.
          </p>
          <Link
            href="/create-club"
            className="mt-3 inline-flex text-sm font-medium text-slate-900 underline underline-offset-2 hover:text-slate-700"
          >
            Create another club →
          </Link>
        </div>
      ) : null}
    </main>
  );
}
