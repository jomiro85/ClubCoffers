import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
    .select("role")
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

  return (
    <main className="flex flex-col gap-8">
      <nav className="text-sm">
        <Link
          href={`/club/${clubId}`}
          className="text-neutral-600 underline dark:text-neutral-400"
        >
          ← {club.name}
        </Link>
      </nav>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{cycle.name}</h1>
        <p className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          Cycle #{cycle.cycle_number}
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Cycle details</h2>
        <dl className="grid max-w-xl grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-neutral-500">Status</dt>
          <dd className="font-mono">{cycle.status}</dd>
          <dt className="text-neutral-500">Period start</dt>
          <dd className="font-mono">
            {new Date(cycle.period_start).toISOString()}
          </dd>
          <dt className="text-neutral-500">Period end</dt>
          <dd className="font-mono">
            {new Date(cycle.period_end).toISOString()}
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
        {(entryRows ?? []).length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            No draw entries yet. Entries are created when the cycle is closed.
          </p>
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
                  return (
                    <tr
                      key={e.id}
                      className="border-b border-neutral-200 dark:border-neutral-700"
                    >
                      <td className="p-2">
                        {m?.display_name ?? (
                          <span className="text-neutral-500">—</span>
                        )}
                      </td>
                      <td className="p-2 font-mono">{m?.role ?? "—"}</td>
                      <td className="p-2 font-mono">
                        {e.is_winner ? "yes" : "no"}
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
        {(settlementRows ?? []).length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            No settlements for this cycle yet.
          </p>
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
                    <td className="p-2 font-mono">{s.status}</td>
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
