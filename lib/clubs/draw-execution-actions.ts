"use server";

import {
  getActorDisplayName,
  insertClubAuditEvent,
} from "@/lib/clubs/audit-helpers";
import { createClient } from "@/lib/supabase/server";
import {
  getEligibleForDrawCycle,
  type EligibleRow,
} from "@/lib/clubs/draw-eligibility";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";

export type DrawExecutionActionState = {
  error: string | null;
  success: string | null;
};

const ok = (message: string): DrawExecutionActionState => ({
  error: null,
  success: message,
});

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

/**
 * Audit helper that reuses the caller's Supabase client so audit inserts
 * share the same connection context and don't silently fail independently.
 */
async function insertDrawAuditEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorUserId: string,
  params: {
    clubId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, unknown>;
  }
) {
  const actorDisplayName = await getActorDisplayName(supabase, actorUserId);
  await insertClubAuditEvent(supabase, {
    actorUserId,
    actorDisplayName,
    clubId: params.clubId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata,
  });
}

function buildEligibleSnapshot(
  rows: EligibleRow[],
  joinedAtByMembership: Map<string, string>
): unknown[] {
  return rows.map((r) => ({
    membership_id: r.membership_id,
    payment_id: r.payment_id,
    joined_at: joinedAtByMembership.get(r.membership_id) ?? null,
  }));
}

export async function closeDrawCycle(
  _prevState: DrawExecutionActionState,
  formData: FormData
): Promise<DrawExecutionActionState> {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const drawCycleId = String(formData.get("draw_cycle_id") ?? "").trim();
  if (!clubId || !drawCycleId) {
    return { error: "Missing club or draw cycle.", success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in.", success: null };
  }

  const viewer = await loadViewerMembership(clubId, user.id);
  if (!viewer || !assertOwnerOrAdmin(viewer.role)) {
    return {
      error: "Only owners and admins can close a draw cycle.",
      success: null,
    };
  }
  if (viewer.status !== "active") {
    return { error: "Your membership is not active in this club.", success: null };
  }

  const { data: cycle, error: cycleErr } = await supabase
    .from("draw_cycles")
    .select(
      "id, club_id, status, period_start, cycle_number, name"
    )
    .eq("id", drawCycleId)
    .maybeSingle();

  if (cycleErr || !cycle || cycle.club_id !== clubId) {
    return { error: "Draw cycle not found for this club.", success: null };
  }
  if (cycle.status !== "open") {
    return { error: "Only an open draw cycle can be closed.", success: null };
  }

  const { data: existingEntries } = await supabase
    .from("draw_entries")
    .select("id")
    .eq("draw_cycle_id", drawCycleId)
    .limit(1);

  if (existingEntries && existingEntries.length > 0) {
    return {
      error:
        "This cycle already has draw entries. It may already be closed.",
      success: null,
    };
  }

  const { data: membershipRows } = await supabase
    .from("memberships")
    .select("id, joined_at")
    .eq("club_id", clubId);

  const joinedAtByMembership = new Map(
    (membershipRows ?? []).map((m) => [m.id, m.joined_at as string])
  );

  const { eligible, totalPotPence } = await getEligibleForDrawCycle(
    supabase,
    clubId,
    { id: drawCycleId, period_start: cycle.period_start as string }
  );

  if (eligible.length === 0) {
    return {
      error:
        "Cannot close this cycle: there are no eligible entries. At least one active member must have a succeeded payment and have joined before the period start.",
      success: null,
    };
  }

  const snapshot = buildEligibleSnapshot(eligible, joinedAtByMembership);

  if (eligible.length > 0) {
    const { error: insErr } = await supabase.from("draw_entries").insert(
      eligible.map((e) => ({
        draw_cycle_id: drawCycleId,
        membership_id: e.membership_id,
        payment_id: e.payment_id,
      }))
    );
    if (insErr) {
      return { error: insErr.message, success: null };
    }
  }

  const { data: closedRows, error: updErr } = await supabase
    .from("draw_cycles")
    .update({
      status: "closed",
      total_pot_pence: totalPotPence,
      eligible_entries_snapshot: snapshot,
    })
    .eq("id", drawCycleId)
    .eq("status", "open")
    .select("id");

  if (updErr) {
    return { error: updErr.message, success: null };
  }
  if (!closedRows?.length) {
    await supabase
      .from("draw_entries")
      .delete()
      .eq("draw_cycle_id", drawCycleId);
    return {
      error:
        "Could not close this cycle (it may have been closed already).",
      success: null,
    };
  }

  await insertDrawAuditEvent(supabase, user.id, {
    clubId,
    action: "draw_cycle.closed",
    entityType: "draw_cycle",
    entityId: drawCycleId,
    metadata: {
      draw_cycle_id: drawCycleId,
      eligible_count: eligible.length,
      total_pot_pence: totalPotPence,
      cycle_number: cycle.cycle_number,
      name: cycle.name,
    },
  });

  revalidatePath(`/club/${clubId}`);
  revalidatePath(`/club/${clubId}/cycles/${drawCycleId}`);
  return ok(
    `Cycle “${cycle.name}” closed with ${eligible.length} eligible entries and ${totalPotPence} pence in the pot.`
  );
}

function allocatePotPence(total: number): {
  club: number;
  winner: number;
  platform: number;
} {
  const t = Math.floor(total);
  if (t < 3) {
    throw new Error(
      "Total pot is too small to split into three positive settlements (minimum 3 pence)."
    );
  }
  const club = Math.floor((t * 57) / 100);
  const winner = Math.floor((t * 35) / 100);
  const platform = t - club - winner;
  if (club < 1 || winner < 1 || platform < 1) {
    throw new Error(
      "Pot size does not allow a 57% / 35% / 8% split with three positive amounts."
    );
  }
  return { club, winner, platform };
}

export async function runDrawCycle(
  _prevState: DrawExecutionActionState,
  formData: FormData
): Promise<DrawExecutionActionState> {
  const clubId = String(formData.get("club_id") ?? "").trim();
  const drawCycleId = String(formData.get("draw_cycle_id") ?? "").trim();
  if (!clubId || !drawCycleId) {
    return { error: "Missing club or draw cycle.", success: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in.", success: null };
  }

  const viewer = await loadViewerMembership(clubId, user.id);
  if (!viewer || !assertOwnerOrAdmin(viewer.role)) {
    return {
      error: "Only owners and admins can run the draw.",
      success: null,
    };
  }
  if (viewer.status !== "active") {
    return { error: "Your membership is not active in this club.", success: null };
  }

  const { data: cycle, error: cycleErr } = await supabase
    .from("draw_cycles")
    .select(
      "id, club_id, status, total_pot_pence, cycle_number, name"
    )
    .eq("id", drawCycleId)
    .maybeSingle();

  if (cycleErr || !cycle || cycle.club_id !== clubId) {
    return { error: "Draw cycle not found for this club.", success: null };
  }
  if (cycle.status === "drawn") {
    return {
      error: "This draw has already been completed; it cannot be run again.",
      success: null,
    };
  }
  if (cycle.status !== "closed") {
    return {
      error:
        "The draw can only be run when the cycle is closed and entries exist.",
      success: null,
    };
  }

  const { data: entries, error: entErr } = await supabase
    .from("draw_entries")
    .select("id, membership_id, is_winner")
    .eq("draw_cycle_id", drawCycleId);

  if (entErr) {
    return { error: entErr.message, success: null };
  }
  const entryList = entries ?? [];
  if (entryList.length === 0) {
    return {
      error:
        "There are no draw entries for this cycle. Close the cycle first so entries can be created.",
      success: null,
    };
  }

  const alreadyWon = entryList.some((e) => e.is_winner);
  if (alreadyWon) {
    return {
      error: "A winner has already been recorded for this cycle.",
      success: null,
    };
  }

  const totalPot = Number(cycle.total_pot_pence ?? 0);
  let alloc: { club: number; winner: number; platform: number };
  try {
    alloc = allocatePotPence(totalPot);
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Could not allocate pot.",
      success: null,
    };
  }

  // randomInt(min, max) is exclusive on max, so use entryList.length (not length-1)
  // to give every entry an equal chance.
  const winnerIndex = randomInt(0, entryList.length);
  const winningEntry = entryList[winnerIndex];
  const winnerMembershipId = winningEntry.membership_id as string;

  const { error: winErr } = await supabase
    .from("draw_entries")
    .update({
      is_winner: true,
      winner_rank: 1,
    })
    .eq("id", winningEntry.id);

  if (winErr) {
    return { error: winErr.message, success: null };
  }

  const { data: winnerMem } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("id", winnerMembershipId)
    .maybeSingle();
  const winnerUserId = winnerMem?.user_id ?? null;
  const winnerDisplayName = winnerUserId
    ? await getActorDisplayName(supabase, winnerUserId)
    : null;

  const { error: setErr } = await supabase.from("settlements").insert([
    {
      club_id: clubId,
      draw_cycle_id: drawCycleId,
      recipient_type: "club",
      amount_pence: Number(alloc.club),
      currency: "GBP",
      status: "pending",
      notes: `Draw cycle ${cycle.cycle_number} — club share (57%)`,
    },
    {
      club_id: clubId,
      draw_cycle_id: drawCycleId,
      membership_id: winnerMembershipId,
      recipient_type: "winner",
      amount_pence: Number(alloc.winner),
      currency: "GBP",
      status: "pending",
      notes: `Draw cycle ${cycle.cycle_number} — winner share (35%)`,
    },
    {
      club_id: clubId,
      draw_cycle_id: drawCycleId,
      recipient_type: "platform",
      amount_pence: Number(alloc.platform),
      currency: "GBP",
      status: "pending",
      notes: `Draw cycle ${cycle.cycle_number} — platform fee (8%)`,
    },
  ]);

  if (setErr) {
    await supabase
      .from("draw_entries")
      .update({
        is_winner: false,
        winner_rank: null,
      })
      .eq("id", winningEntry.id);
    return { error: setErr.message, success: null };
  }

  const { data: drawnRows, error: cycleUpdErr } = await supabase
    .from("draw_cycles")
    .update({
      status: "drawn",
      club_share_pence: alloc.club,
      winner_share_pence: alloc.winner,
      platform_fee_pence: alloc.platform,
    })
    .eq("id", drawCycleId)
    .eq("status", "closed")
    .select("id");

  if (cycleUpdErr) {
    await supabase
      .from("settlements")
      .delete()
      .eq("draw_cycle_id", drawCycleId)
      .eq("status", "pending");
    await supabase
      .from("draw_entries")
      .update({
        is_winner: false,
        winner_rank: null,
      })
      .eq("id", winningEntry.id);
    return { error: cycleUpdErr.message, success: null };
  }
  if (!drawnRows?.length) {
    await supabase
      .from("settlements")
      .delete()
      .eq("draw_cycle_id", drawCycleId)
      .eq("status", "pending");
    await supabase
      .from("draw_entries")
      .update({
        is_winner: false,
        winner_rank: null,
      })
      .eq("id", winningEntry.id);
    return {
      error:
        "Could not complete the draw (cycle may have changed). Try again.",
      success: null,
    };
  }

  const baseMeta = {
    draw_cycle_id: drawCycleId,
    cycle_number: cycle.cycle_number,
    cycle_name: cycle.name,
    total_pot_pence: totalPot,
  };

  await insertDrawAuditEvent(supabase, user.id, {
    clubId,
    action: "draw_cycle.draw_run",
    entityType: "draw_cycle",
    entityId: drawCycleId,
    metadata: {
      ...baseMeta,
      entry_count: entryList.length,
    },
  });

  await insertDrawAuditEvent(supabase, user.id, {
    clubId,
    action: "draw_cycle.winner_selected",
    entityType: "draw_entry",
    entityId: winningEntry.id,
    metadata: {
      ...baseMeta,
      membership_id: winnerMembershipId,
      winner_user_id: winnerUserId,
      winner_display_name: winnerDisplayName,
      winner_index: winnerIndex,
      entry_count: entryList.length,
    },
  });

  await insertDrawAuditEvent(supabase, user.id, {
    clubId,
    action: "draw_cycle.settlements_created",
    entityType: "draw_cycle",
    entityId: drawCycleId,
    metadata: {
      ...baseMeta,
      club_share_pence: alloc.club,
      winner_share_pence: alloc.winner,
      platform_fee_pence: alloc.platform,
    },
  });

  revalidatePath(`/club/${clubId}`);
  revalidatePath(`/club/${clubId}/cycles/${drawCycleId}`);
  return ok(
    `Draw completed for “${cycle.name}”. Winner: ${winnerDisplayName ?? winnerMembershipId}. Settlements recorded.`
  );
}
