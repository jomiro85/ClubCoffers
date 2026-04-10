import {
  DrawCycleStatusBadge,
  MembershipStatusBadge,
  PaymentStatusBadge,
  SettlementStatusBadge,
  WinnerBadge,
} from "@/components/status-badges";
import { getEligibleForDrawCycle } from "@/lib/clubs/draw-eligibility";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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

type CyclePageProps = {
  params: Promise<{ clubId: string; cycleId: string }>;
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

function isMemberRole(r: string): r is (typeof MEMBER_ROLES)[number] {
  return (MEMBER_ROLES as readonly string[]).includes(r);
}

export default async function ClubCyclePage({ params }: CyclePageProps) {
  const { clubId, cycleId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AccessDenied />;
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, slug")
    .eq("id", clubId)
    .maybeSingle();

  if (clubError || !club) {
    return <AccessDenied />;
  }

  const { data: viewerMembership } = await supabase
    .from("memberships")
    .select("id, role, status, joined_at")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!viewerMembership || !isMemberRole(viewerMembership.role)) {
    return <AccessDenied />;
  }

  const { data: cycle, error: cycleError } = await supabase
    .from("draw_cycles")
    .select(
      "id, cycle_number, name, period_start, period_end, status, total_pot_pence, club_share_pence, winner_share_pence, platform_fee_pence"
    )
    .eq("id", cycleId)
    .eq("club_id", club.id)
    .maybeSingle();

  if (cycleError || !cycle) {
    notFound();
  }

  const { data: entryRows } = await supabase
    .from("draw_entries")
    .select("id, membership_id, is_winner, winner_rank")
    .eq("draw_cycle_id", cycle.id)
    .order("created_at", { ascending: true });

  const membershipIds = Array.from(
    new Set((entryRows ?? []).map((e) => e.membership_id))
  );

  let memberById = new Map<
    string,
    { role: string; display_name: string | null }
  >();

  if (membershipIds.length > 0) {
    const { data: mems } = await supabase
      .from("memberships")
      .select("id, role, user_id")
      .in("id", membershipIds);

    const userIds = Array.from(
      new Set((mems ?? []).map((m) => m.user_id))
    );

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    const nameByUser = new Map(
      (profiles ?? []).map((p) => [p.id, p.display_name])
    );

    memberById = new Map(
      (mems ?? []).map((m) => [
        m.id,
        {
          role: m.role,
          display_name: nameByUser.get(m.user_id) ?? null,
        },
      ])
    );
  }

  const { data: settlementRows } = await supabase
    .from("settlements")
    .select(
      "id, recipient_type, amount_pence, status, payment_reference"
    )
    .eq("draw_cycle_id", cycle.id)
    .order("recipient_type", { ascending: true });

  const { data: viewerPaymentRow } = await supabase
    .from("payments")
    .select("id")
    .eq("draw_cycle_id", cycle.id)
    .eq("membership_id", viewerMembership.id)
    .eq("status", "succeeded")
    .maybeSingle();

  const hasSucceededPayment = Boolean(viewerPaymentRow);

  let eligibleWhileOpen = false;
  if (cycle.status === "open") {
    const { eligible } = await getEligibleForDrawCycle(supabase, club.id, {
      id: cycle.id,
      period_start: cycle.period_start,
    });
    eligibleWhileOpen = eligible.some(
      (e) => e.membership_id === viewerMembership.id
    );
  }

  const viewerEntry = (entryRows ?? []).find(
    (e) => e.membership_id === viewerMembership.id
  );

  const winnerEntry = (entryRows ?? []).find((e) => e.is_winner);
  const winnerName = winnerEntry
    ? memberById.get(winnerEntry.membership_id)?.display_name
    : null;

  const showWinnerBanner =
    (cycle.status === "drawn" || cycle.status === "settled") && winnerEntry;

  const periodStartDate = new Date(cycle.period_start);
  const joinedAt = viewerMembership.joined_at
    ? new Date(viewerMembership.joined_at as string)
    : null;
  const joinedBeforePeriod =
    joinedAt != null && !Number.isNaN(joinedAt.getTime())
      ? joinedAt < periodStartDate
      : false;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8">
      <nav className="text-sm">
        <Link
          href={`/club/${clubId}`}
          className="text-neutral-600 underline dark:text-neutral-400"
        >
          ← {club.name}
        </Link>
      </nav>

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{cycle.name}</h1>
        <p className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          Cycle #{cycle.cycle_number}
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          One <strong className="font-medium text-neutral-800 dark:text-neutral-200">cycle</strong> covers collecting fees for a period, closing the list of who&apos;s in the draw, running the draw, then recording payouts.
        </p>
      </header>

      {showWinnerBanner ? (
        <section
          className="rounded-lg border border-emerald-200 bg-emerald-50/90 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/35"
          aria-label="Draw result"
        >
          <p className="text-sm font-medium text-emerald-950 dark:text-emerald-100">
            Winner
          </p>
          <p className="mt-1 text-xl font-semibold text-emerald-950 dark:text-emerald-50">
            {winnerName ?? "—"}
          </p>
          <p className="mt-2 text-sm text-emerald-900/90 dark:text-emerald-200/90">
            Pot split and settlement rows are below. This result is final for this cycle.
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
        <h2 className="text-lg font-medium">You in this cycle</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-neutral-600 dark:text-neutral-400">
            Membership
          </span>
          <MembershipStatusBadge status={viewerMembership.status} />
          <span className="text-neutral-400">·</span>
          <span className="text-neutral-600 dark:text-neutral-400">Role</span>
          <span className="font-mono text-xs">{viewerMembership.role}</span>
        </div>
        {viewerMembership.status === "pending" ? (
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            You need to be <strong className="font-medium">active</strong> before you can pay for this cycle or be eligible for the draw.
          </p>
        ) : null}
        {cycle.status === "open" && viewerMembership.status === "active" ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-600 dark:text-neutral-400">
              Payment (this cycle)
            </span>
            <PaymentStatusBadge
              membershipStatus={viewerMembership.status}
              hasSucceededPayment={hasSucceededPayment}
            />
          </div>
        ) : null}
        {cycle.status === "open" ? (
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {eligibleWhileOpen ? (
              <>
                You&apos;re <strong className="font-medium">eligible</strong> for this draw if the cycle closes as-is (active, paid, joined before period start).
              </>
            ) : viewerMembership.status === "active" ? (
              !hasSucceededPayment ? (
                <>
                  Pay the fee for this cycle to be counted. You must also have joined before{" "}
                  <span className="font-mono text-xs">
                    {formatPeriodDate(cycle.period_start)}
                  </span>{" "}
                  to enter the draw.
                </>
              ) : !joinedBeforePeriod ? (
                <>
                  You paid for this cycle, but you joined on or after the period start, so you&apos;re{" "}
                  <strong className="font-medium">not eligible</strong> for this draw.
                </>
              ) : (
                <>
                  You should be eligible — if this looks wrong, ask your club admin to check your payment.
                </>
              )
            ) : (
              <>
                When you&apos;re <strong className="font-medium">active</strong> and your fee is recorded, you can become eligible for this cycle.
              </>
            )}
          </p>
        ) : null}
        {cycle.status === "closed" ? (
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            {viewerEntry ? (
              <>
                This cycle is <strong className="font-medium">closed</strong>. You&apos;re in the draw pool ({(entryRows ?? []).length} entries).
              </>
            ) : (
              <>
                This cycle is closed. You don&apos;t have an entry in this draw (you weren&apos;t eligible when it closed).
              </>
            )}
          </p>
        ) : null}
        {(cycle.status === "drawn" || cycle.status === "settled") &&
        viewerEntry ? (
          <p className="text-sm text-neutral-700 dark:text-neutral-300">
            Your result:{" "}
            <WinnerBadge isWinner={viewerEntry.is_winner} />
            {viewerEntry.is_winner ? (
              <span className="ml-1 text-emerald-800 dark:text-emerald-200">
                You won this draw.
              </span>
            ) : (
              <span className="ml-1">You were in the pool but weren&apos;t selected.</span>
            )}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Cycle details</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Status shows where things are: open (collecting) → closed (entries locked) → drawn (winner picked) → settled (payouts done).
        </p>
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-neutral-500">Status</dt>
          <dd>
            <DrawCycleStatusBadge status={cycle.status} />
          </dd>
          <dt className="text-neutral-500">Period start</dt>
          <dd className="font-mono text-xs sm:text-sm">
            {formatPeriodDate(cycle.period_start)}
          </dd>
          <dt className="text-neutral-500">Period end</dt>
          <dd className="font-mono text-xs sm:text-sm">
            {formatPeriodDate(cycle.period_end)}
          </dd>
          <dt className="text-neutral-500">Total pot</dt>
          <dd className="font-mono">{Number(cycle.total_pot_pence ?? 0)} pence</dd>
          <dt className="text-neutral-500">Club share</dt>
          <dd className="font-mono">
            {Number(cycle.club_share_pence ?? 0)} pence
          </dd>
          <dt className="text-neutral-500">Winner share</dt>
          <dd className="font-mono">
            {Number(cycle.winner_share_pence ?? 0)} pence
          </dd>
          <dt className="text-neutral-500">Platform fee</dt>
          <dd className="font-mono">
            {Number(cycle.platform_fee_pence ?? 0)} pence
          </dd>
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Draw entries</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          After <strong className="font-medium text-neutral-800 dark:text-neutral-200">close</strong>, one row per eligible member becomes the draw pool. The draw picks one winner from these rows.
        </p>
        {(entryRows ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
            No entries yet. Entries appear when an owner or admin <strong className="font-medium text-neutral-800 dark:text-neutral-200">closes</strong> the cycle with at least one eligible, paid member.
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-300 dark:border-neutral-600">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-300 dark:border-neutral-600">
                  <th className="p-2 font-medium">Member</th>
                  <th className="p-2 font-medium">Role</th>
                  <th className="p-2 font-medium">Winner</th>
                  <th className="p-2 font-medium">Winner rank</th>
                </tr>
              </thead>
              <tbody>
                {(entryRows ?? []).map((e) => {
                  const m = memberById.get(e.membership_id);
                  const isViewerRow = e.membership_id === viewerMembership.id;
                  return (
                    <tr
                      key={e.id}
                      className={
                        isViewerRow
                          ? "border-b border-neutral-200 bg-sky-50/80 dark:border-neutral-700 dark:bg-sky-950/30"
                          : "border-b border-neutral-200 dark:border-neutral-700"
                      }
                    >
                      <td className="p-2">
                        {m?.display_name ?? (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="p-2 font-mono">{m?.role ?? "—"}</td>
                      <td className="p-2">
                        <WinnerBadge isWinner={e.is_winner} />
                      </td>
                      <td className="p-2 font-mono">
                        {e.winner_rank != null ? e.winner_rank : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Settlements</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          How the pot is allocated after the draw (club, winner, platform). <strong className="font-medium text-neutral-800 dark:text-neutral-200">Status</strong> tracks whether each slice has been paid out.
        </p>
        {(settlementRows ?? []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
            No settlement rows yet. They are created when the draw is <strong className="font-medium text-neutral-800 dark:text-neutral-200">run</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto border border-neutral-300 dark:border-neutral-600">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-300 dark:border-neutral-600">
                  <th className="p-2 font-medium">Recipient</th>
                  <th className="p-2 font-medium">Amount (pence)</th>
                  <th className="p-2 font-medium">Status</th>
                  <th className="p-2 font-medium">Payment ref</th>
                </tr>
              </thead>
              <tbody>
                {(settlementRows ?? []).map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-neutral-200 dark:border-neutral-700"
                  >
                    <td className="p-2 font-mono">{s.recipient_type}</td>
                    <td className="p-2 font-mono">
                      {Number(s.amount_pence ?? 0)}
                    </td>
                    <td className="p-2">
                      <SettlementStatusBadge status={s.status} />
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {s.payment_reference ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
