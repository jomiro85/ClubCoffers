"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type DrawCycleActionState = {
  error: string | null;
};

const ok: DrawCycleActionState = { error: null };

type MembershipRole = "owner" | "admin" | "member";

async function loadViewerMembership(
  clubId: string,
  userId: string
): Promise<{ role: MembershipRole } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const role = data.role as MembershipRole;
  if (role !== "owner" && role !== "admin" && role !== "member") return null;
  return { role };
}

function assertOwnerOrAdmin(role: MembershipRole): boolean {
  return role === "owner" || role === "admin";
}

export async function createDrawCycle(
  _prevState: DrawCycleActionState,
  formData: FormData
): Promise<DrawCycleActionState> {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const cycleNumberRaw = String(formData.get("cycle_number") ?? "").trim();
  const periodStartRaw = String(formData.get("period_start") ?? "").trim();
  const periodEndRaw = String(formData.get("period_end") ?? "").trim();

  if (!clubId || !name || !cycleNumberRaw || !periodStartRaw || !periodEndRaw) {
    return { error: "All fields are required." };
  }

  const cycleNumber = Number.parseInt(cycleNumberRaw, 10);
  if (!Number.isFinite(cycleNumber) || cycleNumber < 1) {
    return { error: "Cycle number must be a positive integer." };
  }

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
    return { error: "Invalid period dates." };
  }
  if (periodEnd <= periodStart) {
    return { error: "Period end must be after period start." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const viewer = await loadViewerMembership(clubId, user.id);
  if (!viewer || !assertOwnerOrAdmin(viewer.role)) {
    return { error: "Only owners and admins can create draw cycles." };
  }

  const { data: openRows } = await supabase
    .from("draw_cycles")
    .select("id")
    .eq("club_id", clubId)
    .eq("status", "open")
    .limit(1);

  if (openRows && openRows.length > 0) {
    return {
      error:
        "An open draw cycle already exists. Close or settle it before creating another.",
    };
  }

  const { error: insertError } = await supabase.from("draw_cycles").insert({
    club_id: clubId,
    cycle_number: cycleNumber,
    name,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    status: "open",
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        error: "A cycle with this number already exists for this club.",
      };
    }
    return { error: insertError.message };
  }

  revalidatePath(`/club/${clubId}`);
  return ok;
}

export async function markMemberPaidForCycle(
  _prevState: DrawCycleActionState,
  formData: FormData
): Promise<DrawCycleActionState> {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const drawCycleId = String(formData.get("draw_cycle_id") ?? "").trim();
  const membershipId = String(formData.get("membership_id") ?? "").trim();

  if (!clubId || !drawCycleId || !membershipId) {
    return { error: "Missing required fields." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const viewer = await loadViewerMembership(clubId, user.id);
  if (!viewer || !assertOwnerOrAdmin(viewer.role)) {
    return { error: "Only owners and admins can mark members as paid." };
  }

  const { data: club, error: clubErr } = await supabase
    .from("clubs")
    .select("id, monthly_fee_pence")
    .eq("id", clubId)
    .maybeSingle();

  if (clubErr || !club) {
    return { error: "Club not found." };
  }

  const { data: cycle, error: cycleErr } = await supabase
    .from("draw_cycles")
    .select("id, club_id, status")
    .eq("id", drawCycleId)
    .maybeSingle();

  if (cycleErr || !cycle || cycle.club_id !== clubId) {
    return { error: "Draw cycle not found for this club." };
  }
  if (cycle.status !== "open") {
    return {
      error: "Members can only be marked paid for the current open draw cycle.",
    };
  }

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("id, club_id, status")
    .eq("id", membershipId)
    .maybeSingle();

  if (memErr || !membership || membership.club_id !== clubId) {
    return { error: "Membership not found for this club." };
  }
  if (membership.status !== "active") {
    return {
      error: "Only active members can be marked as paid for this cycle.",
    };
  }

  const { data: existingPay } = await supabase
    .from("payments")
    .select("id")
    .eq("draw_cycle_id", drawCycleId)
    .eq("membership_id", membershipId)
    .eq("status", "succeeded")
    .maybeSingle();

  if (existingPay) {
    return {
      error: "This member is already marked paid for this draw cycle.",
    };
  }

  const paidAt = new Date().toISOString();

  const { error: payErr } = await supabase.from("payments").insert({
    draw_cycle_id: drawCycleId,
    membership_id: membershipId,
    amount_pence: club.monthly_fee_pence,
    currency: "GBP",
    status: "succeeded",
    provider: "manual_test",
    paid_at: paidAt,
  });

  if (payErr) {
    return { error: payErr.message };
  }

  revalidatePath(`/club/${clubId}`);
  return ok;
}
