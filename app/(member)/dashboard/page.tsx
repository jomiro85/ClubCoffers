import { CheckoutButton } from "@/components/checkout-button";
import { DrawCycleStatusBadge, MembershipStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

/* ── Types ──────────────────────────────────────────── */

type ClubRow = {
  id: string;
  name: string;
  monthly_fee_pence: number;
  stripe_account_id: string | null;
};

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
  hasEntry: boolean;
  isWinner: boolean;
  isEligible: boolean;
  billingStatus: string | null;
};

/* ── Helpers ────────────────────────────────────────── */

function clubFromRow(clubs: ClubRow | ClubRow[] | null): ClubRow | null {
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
    return "bg-[#0f2444] text-white";
  if (role === "admin")
    return "bg-slate-700 text-white";
  return "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/15";
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
        ? "text-slate-300"
        : "text-[#0c1526]";

  const topBorder =
    tone === "neutral"
      ? "border-t-2 border-t-[#0f2444]"
      : tone === "alert"
        ? "border-t-2 border-t-amber-400"
        : "";

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm ${topBorder}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        {label}
      </p>
      <p className={`text-3xl font-bold tabular-nums ${valCls}`}>{value}</p>
    </div>
  );
}

/* ── Eligibility / draw state pill ─────────────────── */

function EligibilityPill({
  hasPaid,
  hasEntry,
  isWinner,
  isEligible,
  cycleStatus,
  membershipStatus,
  joinedAt,
  periodStart,
}: {
  hasPaid: boolean;
  hasEntry: boolean;
  isWinner: boolean;
  isEligible: boolean;
  cycleStatus: string;
  membershipStatus: string;
  joinedAt: string | null;
  periodStart: string;
}) {
  if (membershipStatus !== "active") return null;

  if (cycleStatus !== "open") {
    if (cycleStatus === "closed") {
      return hasEntry ? (
        <Pill tone="info">In draw pool</Pill>
      ) : (
        <Pill tone="muted">Not in draw</Pill>
      );
    }
    if (cycleStatus === "drawn" || cycleStatus === "settled") {
      if (isWinner) return <Pill tone="success">Won this draw</Pill>;
      return hasEntry ? (
        <Pill tone="muted">Participated</Pill>
      ) : (
        <Pill tone="muted">Not in draw</Pill>
      );
    }
    return hasPaid ? (
      <Pill tone="success">Paid</Pill>
    ) : (
      <Pill tone="muted">Not paid</Pill>
    );
  }

  if (isEligible) return <Pill tone="success">Eligible</Pill>;
  if (!hasPaid)   return <Pill tone="warning">Unpaid</Pill>;

  const joined = joinedAt ? new Date(joinedAt) : null;
  const period = new Date(periodStart);
  if (joined && joined >= period) return <Pill tone="muted">Late joiner</Pill>;

  return null;
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "warning" | "info" | "muted";
}) {
  const cls = {
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
    warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
    info:    "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
    muted:   "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-500/10",
  }[tone];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

/* ── Main page ──────────────────────────────────────── */

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  /* 1 — Memberships */
  const { data: membershipRows, error } = await supabase
    .from("memberships")
    .select(
      `id, role, status, joined_at,
       clubs ( id, name, monthly_fee_pence, stripe_account_id )`
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (error) {
    return (
      <main className="flex flex-col gap-4 py-10">
        <h1 className="text-2xl font-semibold text-[#0c1526]">Your clubs</h1>
        <p className="text-sm text-red-600" role="alert">
          Could not load your clubs: {error.message}
        </p>
      </main>
    );
  }

  const rows = membershipRows ?? [];

  /* ── Empty state ──────────────────────────────────── */
  if (rows.length === 0) {
    return (
      <main className="flex flex-col gap-10 py-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0c1526]">
            Your clubs
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            You&apos;re not part of any club yet.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 border-t-2 border-t-[#0f2444] bg-white p-7 shadow-sm">
            <p className="font-semibold text-[#0c1526]">Start a club</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Become the owner. Invite members, run draw cycles, and manage
              payments.
            </p>
            <Link
              href="/create-club"
              className="mt-5 inline-flex rounded-lg bg-[#0f2444] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a1834]"
            >
              Create a club
            </Link>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
            <p className="font-semibold text-[#0c1526]">Join a club</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Ask your club owner for an invite link. Open it, request to join,
              and you&apos;ll be active once approved.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /* 2 — Enrich with cycle, payment, draw data */

  const clubIds = rows
    .map((r) => clubFromRow(r.clubs as ClubRow | ClubRow[] | null)?.id)
    .filter((id): id is string => Boolean(id));

  const membershipIds = rows.map((r) => r.id);

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

  let paidSet   = new Set<string>();
  let entrySet  = new Set<string>();
  let wonSet    = new Set<string>();

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
        .select("membership_id, draw_cycle_id, is_winner")
        .in("membership_id", membershipIds)
        .in("draw_cycle_id", cycleIds),
    ]);

    for (const p of payData ?? []) paidSet.add(`${p.membership_id}:${p.draw_cycle_id}`);
    for (const e of entryData ?? []) {
      const key = `${e.membership_id}:${e.draw_cycle_id}`;
      entrySet.add(key);
      if (e.is_winner) wonSet.add(key);
    }
  }

  /* 3 — Billing subscriptions */

  let billingStatusByMembership = new Map<string, string>();
  if (membershipIds.length > 0) {
    const { data: subData } = await supabase
      .from("billing_subscriptions")
      .select("membership_id, status")
      .in("membership_id", membershipIds);

    for (const s of subData ?? []) {
      billingStatusByMembership.set(s.membership_id, s.status);
    }
  }

  /* 4 — Build enriched cards */

  const cards: MembershipCard[] = rows.map((row) => {
    const club = clubFromRow(row.clubs as ClubRow | ClubRow[] | null);
    const latestCycle = club ? latestCycleByClub.get(club.id) ?? null : null;
    const hasPaid     = latestCycle ? paidSet.has(`${row.id}:${latestCycle.id}`)  : false;
    const hasEntry    = latestCycle ? entrySet.has(`${row.id}:${latestCycle.id}`) : false;
    const isWinner    = latestCycle ? wonSet.has(`${row.id}:${latestCycle.id}`)   : false;

    const joinedAt    = row.joined_at ? new Date(row.joined_at as string) : null;
    const periodStart = latestCycle?.periodStart ? new Date(latestCycle.periodStart) : null;

    const isEligible =
      row.status === "active" &&
      hasPaid &&
      joinedAt !== null &&
      periodStart !== null &&
      joinedAt < periodStart &&
      latestCycle?.status === "open";

    return {
      membershipId: row.id,
      role:         row.role as string,
      status:       row.status as string,
      joinedAt:     (row.joined_at as string | null) ?? null,
      club,
      latestCycle,
      hasPaid,
      hasEntry,
      isWinner,
      isEligible,
      billingStatus: billingStatusByMembership.get(row.id) ?? null,
    };
  });

  /* 5 — Summary stats */

  const activeCount   = cards.filter((c) => c.status === "active").length;
  const pendingCount  = cards.filter((c) => c.status === "pending").length;
  const eligibleCount = cards.filter((c) => c.isEligible).length;

  /* 6 — Render */

  return (
    <main className="flex flex-col gap-10 py-2">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0c1526]">
          Your clubs
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {cards.length === 1 ? "1 club" : `${cards.length} clubs`}
          {pendingCount > 0 ? ` · ${pendingCount} pending approval` : ""}
        </p>
      </div>

      {/* Summary metrics */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Active" value={activeCount} />
          <MetricCard label="Pending" value={pendingCount} tone={pendingCount > 0 ? "alert" : "dim"} />
          <MetricCard label="Eligible" value={eligibleCount} tone={eligibleCount > 0 ? "neutral" : "dim"} />
        </div>
        {eligibleCount > 0 ? (
          <p className="text-xs text-slate-400">
            Eligible = active membership + fee paid + joined before the cycle started.
          </p>
        ) : null}
      </div>

      {/* Club cards */}
      <ul className="flex flex-col gap-4">
        {cards.map((card) => {
          const clubId   = card.club?.id ?? "";
          const clubName = card.club?.name ?? "Unknown club";
          const isPending   = card.status === "pending";
          const isSuspended = card.status === "suspended" || card.status === "cancelled";

          return (
            <li key={card.membershipId}>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

                {/* Card header */}
                <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5">
                  <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-semibold tracking-tight text-[#0c1526]">
                      {clubName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleBadgeCls(card.role)}`}
                      >
                        {roleLabel(card.role)}
                      </span>
                      <MembershipStatusBadge status={card.status} />
                    </div>
                  </div>
                  {clubId ? (
                    <Link
                      href={`/club/${clubId}`}
                      className="shrink-0 rounded-lg bg-[#0f2444] px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0a1834]"
                    >
                      Open →
                    </Link>
                  ) : null}
                </div>

                {/* Pending approval notice */}
                {isPending ? (
                  <div className="mx-6 mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                    <p className="text-sm font-semibold text-amber-800">
                      Awaiting approval
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-700">
                      A club owner or admin needs to approve your membership before
                      you can pay fees or be entered into draws.
                    </p>
                  </div>
                ) : null}

                {/* Suspended / cancelled notice */}
                {isSuspended ? (
                  <div className="mx-6 mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                    <p className="text-sm font-semibold text-slate-700 capitalize">
                      Membership {card.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Contact the club owner if you believe this is a mistake.
                    </p>
                  </div>
                ) : null}

                {/* Current cycle — active members only */}
                {card.status === "active" && card.latestCycle ? (
                  <div className="border-t border-slate-100 px-6 py-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                          {card.latestCycle.status === "open" ? "Current cycle" : "Latest cycle"}
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
                            hasEntry={card.hasEntry}
                            isWinner={card.isWinner}
                            isEligible={card.isEligible}
                            cycleStatus={card.latestCycle.status}
                            membershipStatus={card.status}
                            joinedAt={card.joinedAt}
                            periodStart={card.latestCycle.periodStart}
                          />
                        </div>

                        {/* Contextual explanations */}
                        {card.latestCycle.status === "open" && !card.hasPaid ? (
                          <p className="text-xs text-slate-500">
                            Pay your fee to be eligible. Ask your club owner to record it.
                          </p>
                        ) : null}
                        {card.latestCycle.status === "open" && card.hasPaid && !card.isEligible ? (
                          <p className="text-xs text-slate-500">
                            You paid, but joined after this cycle started — you won&apos;t
                            be in this draw.
                          </p>
                        ) : null}
                        {card.latestCycle.status === "closed" && card.hasEntry ? (
                          <p className="text-xs text-slate-500">
                            The draw pool is locked. You&apos;re in it — the draw runs soon.
                          </p>
                        ) : null}
                        {card.latestCycle.status === "closed" && !card.hasEntry ? (
                          <p className="text-xs text-slate-500">
                            The cycle is closed. You weren&apos;t eligible when the pool locked.
                          </p>
                        ) : null}
                        {(card.latestCycle.status === "drawn" || card.latestCycle.status === "settled") &&
                        !card.isWinner ? (
                          <p className="text-xs text-slate-500">
                            {card.hasEntry
                              ? "You were in the draw but weren\u2019t selected this time."
                              : "You didn\u2019t have an entry in this draw."}
                          </p>
                        ) : null}
                      </div>
                      {clubId ? (
                        <Link
                          href={`/club/${clubId}/cycles/${card.latestCycle.id}`}
                          className="shrink-0 text-xs font-medium text-slate-400 underline underline-offset-2 hover:text-slate-700"
                        >
                          View cycle
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : card.status === "active" && !card.latestCycle ? (
                  <div className="border-t border-slate-100 px-6 py-4">
                    <p className="text-xs text-slate-400">
                      No draw cycle has been started yet.
                    </p>
                  </div>
                ) : null}

                {/* Billing — active members whose club has Stripe set up */}
                {card.status === "active" && card.club?.stripe_account_id ? (
                  <div className="border-t border-slate-100 px-6 py-4">
                    {card.billingStatus === "active" || card.billingStatus === "trialing" ? (
                      <Pill tone="success">Monthly payment active</Pill>
                    ) : card.billingStatus === "past_due" || card.billingStatus === "unpaid" ? (
                      <div className="flex flex-col gap-2">
                        <Pill tone="warning">Payment past due</Pill>
                        <CheckoutButton membershipId={card.membershipId} />
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-xs text-slate-500">
                          Set up recurring billing to pay your fee automatically each month.
                        </p>
                        <CheckoutButton membershipId={card.membershipId} />
                      </div>
                    )}
                  </div>
                ) : null}

              </div>
            </li>
          );
        })}
      </ul>

      {/* Footer CTA */}
      {activeCount > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <p className="font-semibold text-[#0c1526]">Start another club</p>
          <p className="mt-1 text-sm text-slate-500">
            You can run multiple clubs independently on Coffers.
          </p>
          <Link
            href="/create-club"
            className="mt-4 inline-flex text-sm font-medium text-[#0f2444] underline underline-offset-2 hover:text-[#0a1834]"
          >
            Create a club →
          </Link>
        </div>
      ) : null}

    </main>
  );
}
