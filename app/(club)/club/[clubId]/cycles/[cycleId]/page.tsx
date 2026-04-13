import {
  DrawCycleStatusBadge,
  MembershipStatusBadge,
  SettlementStatusBadge,
  WinnerBadge,
} from "@/components/status-badges";
import { getEligibleForDrawCycle } from "@/lib/clubs/draw-eligibility";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/* ── Helpers ────────────────────────────────────────── */

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

function fmtPence(p: number): string {
  if (p === 0) return "—";
  const pounds = p / 100;
  return pounds % 1 === 0
    ? `£${pounds.toLocaleString("en-GB")}`
    : `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/* ── Layout helpers ─────────────────────────────────── */

function Card({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section
      id={id}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {children}
    </section>
  );
}

function CardHeader({
  title,
  description,
  badge,
}: {
  title: string;
  description?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
      <div>
        <h2 className="text-base font-semibold text-[#0c1526]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {badge ?? null}
    </div>
  );
}

/* ── Access denied ──────────────────────────────────── */

function AccessDenied() {
  return (
    <main className="flex flex-col gap-4 py-8">
      <h1 className="text-xl font-semibold text-slate-900">Access denied</h1>
      <p className="text-sm text-slate-600">
        You don&apos;t have access to this club, or it doesn&apos;t exist.
      </p>
    </main>
  );
}

const MEMBER_ROLES = ["owner", "admin", "member"] as const;
function isMemberRole(r: string): r is (typeof MEMBER_ROLES)[number] {
  return (MEMBER_ROLES as readonly string[]).includes(r);
}

/* ── Page ───────────────────────────────────────────── */

type CyclePageProps = {
  params: Promise<{ clubId: string; cycleId: string }>;
};

export default async function ClubCyclePage({ params }: CyclePageProps) {
  const { clubId, cycleId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return <AccessDenied />;

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, slug, monthly_fee_pence")
    .eq("id", clubId)
    .maybeSingle();

  if (clubError || !club) return <AccessDenied />;

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

  if (cycleError || !cycle) notFound();

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

    const userIds = Array.from(new Set((mems ?? []).map((m) => m.user_id)));

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
        { role: m.role, display_name: nameByUser.get(m.user_id) ?? null },
      ])
    );
  }

  const { data: settlementRows } = await supabase
    .from("settlements")
    .select("id, recipient_type, amount_pence, status, payment_reference")
    .eq("draw_cycle_id", cycle.id)
    .order("recipient_type", { ascending: true });

  const { data: viewerPaymentRow } = await supabase
    .from("payments")
    .select("id, amount_pence")
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

  const totalPot = Number(cycle.total_pot_pence ?? 0);
  const clubShare = Number(cycle.club_share_pence ?? 0);
  const winnerShare = Number(cycle.winner_share_pence ?? 0);
  const platformFee = Number(cycle.platform_fee_pence ?? 0);

  /* ── Viewer's status label ─────────────────────────── */
  function viewerStatusLine(): string {
    if (!viewerMembership || !cycle) return "";
    if (viewerMembership.status === "pending") {
      return "You need to be approved before you can pay or enter draws.";
    }
    if (viewerMembership.status === "suspended") {
      return "Your membership is suspended. Contact the club owner.";
    }
    if (viewerMembership.status === "cancelled") {
      return "Your membership has been cancelled.";
    }
    // active
    if (cycle.status === "open") {
      if (eligibleWhileOpen) {
        return "You're eligible for this draw — active, paid, and joined before the cycle started.";
      }
      if (!hasSucceededPayment) {
        return "You haven't paid for this cycle yet. Ask the club owner to record your payment.";
      }
      if (!joinedBeforePeriod) {
        return "You joined after the cycle started, so you're not eligible for this draw even though you've paid.";
      }
      return "You should be eligible — if something looks wrong, ask your club admin.";
    }
    if (cycle.status === "closed") {
      if (viewerEntry) {
        return `The entry list is locked. You're in the draw pool (${(entryRows ?? []).length} entries total).`;
      }
      return "The cycle is closed. You weren't eligible when it closed and don't have a draw entry.";
    }
    if (cycle.status === "drawn" || cycle.status === "settled") {
      if (viewerEntry?.is_winner) {
        return "You won this draw! The pot split is shown below.";
      }
      if (viewerEntry) {
        return "You were in the draw pool but weren't selected this time.";
      }
      return "You didn't have an entry in this draw.";
    }
    return "";
  }

  return (
    <main className="flex flex-col gap-6 pb-16">
      {/* Breadcrumb */}
      <nav className="pt-1 text-sm">
        <Link
          href={`/club/${clubId}`}
          className="font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          ← {club.name}
        </Link>
      </nav>

      {/* Page header */}
      <div className="flex flex-col gap-2 border-l-[3px] border-[#0f2444] pl-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-[#0c1526]">
            {cycle.name}
          </h1>
          <DrawCycleStatusBadge status={cycle.status} />
        </div>
        <p className="text-sm text-slate-500">
          Cycle #{cycle.cycle_number}
          <span className="mx-2 text-slate-300">·</span>
          {formatPeriodDate(cycle.period_start)}
          <span className="mx-1.5 text-slate-300">–</span>
          {formatPeriodDate(cycle.period_end)}
        </p>
      </div>

      {/* Winner banner */}
      {showWinnerBanner ? (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">
            Draw result
          </p>
          <p className="text-2xl font-bold text-emerald-900">
            {winnerName ?? "—"}
          </p>
          <p className="text-sm text-emerald-700">
            This result is final. The full pot split is recorded below.
          </p>
        </div>
      ) : null}

      {/* Your status in this cycle */}
      <Card id="your-status">
        <CardHeader
          title="Your status"
          badge={<MembershipStatusBadge status={viewerMembership.status} />}
        />
        <div className="px-6 py-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4 text-sm">
            <dt className="font-medium text-slate-400">Role</dt>
            <dd className="font-medium capitalize text-[#0c1526]">{viewerMembership.role}</dd>

            {viewerMembership.status === "active" ? (
              <>
                <dt className="font-medium text-slate-400">Payment</dt>
                <dd>
                  {hasSucceededPayment ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      Paid{viewerPaymentRow?.amount_pence
                        ? ` · ${fmtPence(Number(viewerPaymentRow.amount_pence))}`
                        : ""}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
                      Not paid
                    </span>
                  )}
                </dd>

                {cycle.status === "open" || viewerEntry ? (
                  <>
                    <dt className="font-medium text-slate-400">Eligible</dt>
                    <dd>
                      {cycle.status === "open" ? (
                        eligibleWhileOpen ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                            Yes — in the draw
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500 ring-1 ring-inset ring-slate-500/10">
                            No
                          </span>
                        )
                      ) : viewerEntry ? (
                        <WinnerBadge isWinner={viewerEntry.is_winner} />
                      ) : (
                        <span className="text-sm text-slate-400">No entry</span>
                      )}
                    </dd>
                  </>
                ) : null}
              </>
            ) : null}
          </dl>

          {/* Contextual explanation */}
          {(() => {
            const line = viewerStatusLine();
            if (!line) return null;
            const isPositive =
              line.startsWith("You're eligible") ||
              line.startsWith("You won");
            const isWarning =
              line.startsWith("You haven't") ||
              line.startsWith("Your membership is suspended") ||
              line.startsWith("Your membership has been cancelled");
            return (
              <p
                className={`mt-5 rounded-xl border px-4 py-3.5 text-sm leading-relaxed ${
                  isPositive
                    ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                    : isWarning
                      ? "border-amber-100 bg-amber-50 text-amber-800"
                      : "border-slate-100 bg-slate-50 text-slate-600"
                }`}
              >
                {line}
              </p>
            );
          })()}
        </div>
      </Card>

      {/* How draws work — plain-language explainer for members */}
      {viewerMembership.role === "member" ? (
        <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer select-none items-center justify-between px-6 py-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            How draws work
            <svg
              className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="border-t border-slate-100 px-6 pb-6 pt-5">
            <ol className="flex flex-col gap-5 text-sm text-slate-600">
              {[
                {
                  n: "1",
                  title: "The cycle opens",
                  body: "Members pay their monthly fee. You must pay before the cycle closes to get a draw entry.",
                },
                {
                  n: "2",
                  title: "Eligibility is checked",
                  body: "To be eligible: active membership, fee paid, and joined before the cycle started.",
                },
                {
                  n: "3",
                  title: "The cycle closes and the draw runs",
                  body: "The club owner locks the entry pool, then runs the draw. One eligible member is picked at random.",
                },
                {
                  n: "4",
                  title: "The pot is settled",
                  body: "The winner receives the majority of the pot. A share goes to the club and a Coffers fee is deducted.",
                },
              ].map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#e8eef7] text-xs font-bold text-[#0f2444]">
                    {step.n}
                  </span>
                  <div>
                    <p className="font-semibold text-[#0c1526]">{step.title}</p>
                    <p className="mt-1 leading-relaxed text-slate-500">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </details>
      ) : null}

      {/* Cycle details */}
      <Card id="cycle-details">
        <CardHeader
          title="Cycle details"
          description="Open → closed → drawn → settled. Each step is one-way and irreversible."
        />
        <div className="px-6 py-5">
          <dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-4 text-sm">
            <dt className="font-medium text-slate-400">Period</dt>
            <dd className="font-medium text-[#0c1526]">
              {formatPeriodDate(cycle.period_start)}
              <span className="mx-1.5 text-slate-300">–</span>
              {formatPeriodDate(cycle.period_end)}
            </dd>
            {totalPot > 0 ? (
              <>
                <dt className="font-medium text-slate-400">Total pot</dt>
                <dd className="font-mono font-semibold text-[#0c1526]">{fmtPence(totalPot)}</dd>
              </>
            ) : null}
            {winnerShare > 0 ? (
              <>
                <dt className="font-medium text-slate-400">Winner receives</dt>
                <dd className="font-mono font-semibold text-emerald-700">
                  {fmtPence(winnerShare)}
                </dd>
                <dt className="font-medium text-slate-400">Club keeps</dt>
                <dd className="font-mono font-semibold text-[#0c1526]">
                  {fmtPence(clubShare)}
                </dd>
                <dt className="font-medium text-slate-400">Coffers fee</dt>
                <dd className="font-mono text-slate-500">
                  {fmtPence(platformFee)}
                </dd>
              </>
            ) : null}
          </dl>
          {totalPot === 0 && cycle.status === "open" ? (
            <p className="mt-5 text-xs text-slate-400">
              The pot grows as members pay their fees. The final amount will be
              shown here once the cycle closes.
            </p>
          ) : null}
        </div>
      </Card>

      {/* Draw entries */}
      <Card id="entries">
        <CardHeader
          title="Draw entries"
          description={
            cycle.status === "open"
              ? "Who will be in the draw if the cycle closes now."
              : cycle.status === "closed"
                ? "The entry list is locked. One winner will be picked from these entries."
                : "The pool of entries for this draw."
          }
        />
        <div className="px-6 py-5">
          {(entryRows ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">
              {cycle.status === "open"
                ? "No eligible entries yet. Members need to pay their fee and have joined before the cycle start date."
                : "No entries were recorded for this cycle."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Member
                    </th>
                    <th className="pb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                      Result
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(entryRows ?? []).map((e) => {
                    const m = memberById.get(e.membership_id);
                    const isViewerRow = e.membership_id === viewerMembership.id;
                    return (
                      <tr
                        key={e.id}
                        className={`border-b border-slate-50 last:border-0 ${
                          isViewerRow ? "bg-[#f7f9fc]" : ""
                        }`}
                      >
                        <td className="py-3.5 pr-4 font-medium text-[#0c1526]">
                          {m?.display_name ?? (
                            <span className="font-normal text-slate-400">—</span>
                          )}
                          {isViewerRow ? (
                            <span className="ml-2 text-xs font-normal text-[#0f2444]">
                              (you)
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3.5">
                          {cycle.status === "drawn" ||
                          cycle.status === "settled" ? (
                            <WinnerBadge isWinner={e.is_winner} />
                          ) : (
                            <span className="text-xs text-slate-400">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Settlements — only show when they exist */}
      {(settlementRows ?? []).length > 0 ? (
        <Card id="settlements">
          <CardHeader
            title="Pot settlement"
            description="How the pot is distributed after the draw: winner, club, and Coffers."
          />
          <div className="px-6 py-5">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["Recipient", "Amount", "Status"].map((h) => (
                      <th
                        key={h}
                        className="pb-3 pr-4 text-xs font-semibold uppercase tracking-widest text-slate-400"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(settlementRows ?? []).map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-slate-50 last:border-0"
                    >
                      <td className="py-3.5 pr-4 font-medium text-[#0c1526] capitalize">
                        {s.recipient_type === "platform" ? "Coffers" : s.recipient_type}
                      </td>
                      <td className="py-3.5 pr-4 font-mono font-semibold text-[#0c1526]">
                        {fmtPence(Number(s.amount_pence ?? 0))}
                      </td>
                      <td className="py-3.5">
                        <SettlementStatusBadge status={s.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      ) : null}
    </main>
  );
}
