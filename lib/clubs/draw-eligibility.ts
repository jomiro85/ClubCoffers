import type { SupabaseClient } from "@supabase/supabase-js";

export type EligibleRow = {
  membership_id: string;
  payment_id: string;
};

/**
 * Eligible entries for a cycle: active membership, succeeded payment for the cycle,
 * joined before period_start. Total pot = sum of all succeeded payment amounts.
 */
export async function getEligibleForDrawCycle(
  supabase: SupabaseClient,
  clubId: string,
  cycle: { id: string; period_start: string }
): Promise<{ eligible: EligibleRow[]; totalPotPence: number }> {
  const periodStart = new Date(cycle.period_start);

  const { data: paymentRows } = await supabase
    .from("payments")
    .select("id, membership_id, amount_pence")
    .eq("draw_cycle_id", cycle.id)
    .eq("status", "succeeded");

  const { data: membershipRows } = await supabase
    .from("memberships")
    .select("id, joined_at, status")
    .eq("club_id", clubId);

  const totalPotPence = (paymentRows ?? []).reduce(
    (s, p) => s + Number(p.amount_pence ?? 0),
    0
  );

  const paymentByMembership = new Map<string, string>();
  for (const p of paymentRows ?? []) {
    if (!paymentByMembership.has(p.membership_id)) {
      paymentByMembership.set(p.membership_id, p.id);
    }
  }

  const eligible: EligibleRow[] = [];
  for (const m of membershipRows ?? []) {
    if (m.status !== "active") continue;
    if (new Date(m.joined_at as string) >= periodStart) continue;
    const paymentId = paymentByMembership.get(m.id);
    if (!paymentId) continue;
    eligible.push({ membership_id: m.id, payment_id: paymentId });
  }

  return { eligible, totalPotPence };
}
