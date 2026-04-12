"use server";

import {
  getActorDisplayName,
  insertClubAuditEvent,
} from "@/lib/clubs/audit-helpers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type DrawCycleActionState = {
  error: string | null;
  success?: string | null;
};

const ok: DrawCycleActionState = { error: null, success: null };

function err(message: string): DrawCycleActionState {
  return { error: message, success: null };
}

type MembershipRole = "owner" | "admin" | "member";

async function loadViewerMembership(
  clubId: string,
  userId: string
): Promise<{ role: MembershipRole; status: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("role, status")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const role = data.role as MembershipRole;
  if (role !== "owner" && role !== "admin" && role !== "member") return null;
  return { role, status: data.status };
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
    return err("All fields are required.");
  }

  const cycleNumber = Number.parseInt(cycleNumberRaw, 10);
  if (!Number.isFinite(cycleNumber) || cycleNumber < 1) {
    return err("Cycle number must be a positive integer.");
  }

  const periodStart = new Date(periodStartRaw);
  const periodEnd = new Date(periodEndRaw);
  if (
    Number.isNaN(periodStart.getTime()) ||
    Number.isNaN(periodEnd.getTime())
  ) {
    return err("Invalid period dates.");
  }
  if (periodEnd <= periodStart) {
    return err("Period end must be after period start.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  const viewer = await loadViewerMembership(clubId, user.id);
  if (!viewer || !assertOwnerOrAdmin(viewer.role)) {
    return err("Only owners and admins can create draw cycles.");
  }
  if (viewer.status !== "active") {
    return err("Your membership is not active in this club.");
  }

  // Safety: no more than one open cycle at a time
  const { data: openRows } = await supabase
    .from("draw_cycles")
    .select("id")
    .eq("club_id", clubId)
    .eq("status", "open")
    .limit(1);

  if (openRows && openRows.length > 0) {
    return err(
      "An open draw cycle already exists. Close and run the draw before creating another."
    );
  }

  // Safety: no overlapping periods with any existing cycle.
  // Overlap condition: newStart < existingEnd AND newEnd > existingStart.
  // Touching endpoints (newStart === existingEnd) are allowed — that is the
  // normal case when using "create next cycle".
  const { data: overlapping } = await supabase
    .from("draw_cycles")
    .select("id, name, cycle_number")
    .eq("club_id", clubId)
    .lt("period_start", periodEnd.toISOString())
    .gt("period_end", periodStart.toISOString())
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    const ex = overlapping[0] as { cycle_number: number; name: string };
    return err(
      `The period overlaps with Cycle ${ex.cycle_number} ("${ex.name}"). Cycles cannot have overlapping periods.`
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("draw_cycles")
    .insert({
      club_id: clubId,
      cycle_number: cycleNumber,
      name,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      status: "open",
    })
    .select("id")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") {
      return err("A cycle with this number already exists for this club.");
    }
    return err(insertError.message);
  }

  const actorDisplayName = await getActorDisplayName(supabase, user.id);
  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName,
    clubId,
    action: "draw_cycle.created",
    entityType: "draw_cycle",
    entityId: inserted?.id ?? null,
    metadata: {
      cycle_number: cycleNumber,
      name,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    },
  });

  revalidatePath(`/club/${clubId}`);
  return { error: null, success: `Cycle "${name}" created.` };
}

export async function markMemberPaidForCycle(
  _prevState: DrawCycleActionState,
  formData: FormData
): Promise<DrawCycleActionState> {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const drawCycleId = String(formData.get("draw_cycle_id") ?? "").trim();
  const membershipId = String(formData.get("membership_id") ?? "").trim();

  if (!clubId || !drawCycleId || !membershipId) {
    return err("Missing required fields.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  const viewer = await loadViewerMembership(clubId, user.id);
  if (!viewer || !assertOwnerOrAdmin(viewer.role)) {
    return err("Only owners and admins can mark members as paid.");
  }
  if (viewer.status !== "active") {
    return err("Your membership is not active in this club.");
  }

  const { data: club, error: clubErr } = await supabase
    .from("clubs")
    .select("id, monthly_fee_pence")
    .eq("id", clubId)
    .maybeSingle();

  if (clubErr || !club) return err("Club not found.");

  const { data: cycle, error: cycleErr } = await supabase
    .from("draw_cycles")
    .select("id, club_id, status")
    .eq("id", drawCycleId)
    .maybeSingle();

  if (cycleErr || !cycle || cycle.club_id !== clubId) {
    return err("Draw cycle not found for this club.");
  }
  if (cycle.status !== "open") {
    return err(
      "Members can only be marked paid for the current open draw cycle."
    );
  }

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("id, club_id, status")
    .eq("id", membershipId)
    .maybeSingle();

  if (memErr || !membership || membership.club_id !== clubId) {
    return err("Membership not found for this club.");
  }
  if (membership.status !== "active") {
    return err("Only active members can be marked as paid for this cycle.");
  }

  const { data: existingPay } = await supabase
    .from("payments")
    .select("id")
    .eq("draw_cycle_id", drawCycleId)
    .eq("membership_id", membershipId)
    .eq("status", "succeeded")
    .maybeSingle();

  if (existingPay) {
    return err("This member is already marked paid for this draw cycle.");
  }

  const paidAt = new Date().toISOString();

  const { data: insertedPayment, error: payErr } = await supabase
    .from("payments")
    .insert({
      draw_cycle_id: drawCycleId,
      membership_id: membershipId,
      amount_pence: club.monthly_fee_pence,
      currency: "GBP",
      status: "succeeded",
      provider: "manual_test",
      paid_at: paidAt,
    })
    .select("id")
    .maybeSingle();

  if (payErr) return err(payErr.message);

  const actorDisplayName = await getActorDisplayName(supabase, user.id);
  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName,
    clubId,
    action: "payment.manual_recorded",
    entityType: "payment",
    entityId: insertedPayment?.id ?? null,
    metadata: {
      membership_id: membershipId,
      draw_cycle_id: drawCycleId,
      amount_pence: club.monthly_fee_pence,
      provider: "manual_test",
      paid_at: paidAt,
    },
  });

  revalidatePath(`/club/${clubId}`);
  return ok;
}
