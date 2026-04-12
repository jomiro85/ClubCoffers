"use server";

import {
  getActorDisplayName,
  insertClubAuditEvent,
} from "@/lib/clubs/audit-helpers";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ClubAdminActionState = {
  error: string | null;
  success?: string | null;
};

const ok: ClubAdminActionState = { error: null };

function err(message: string): ClubAdminActionState {
  return { error: message, success: null };
}

function success(message: string): ClubAdminActionState {
  return { error: null, success: message };
}

function getClubId(formData: FormData) {
  return String(formData.get("club_id") ?? "").trim();
}

function getTargetUserId(formData: FormData) {
  return String(formData.get("target_user_id") ?? "").trim();
}

type MembershipRole = "owner" | "admin" | "member";

type MembershipRow = {
  id: string;
  role: MembershipRole;
  status: string;
};

async function loadMembership(
  clubId: string,
  userId: string
): Promise<MembershipRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, role, status")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  const role = data.role as MembershipRole;
  if (role !== "owner" && role !== "admin" && role !== "member") return null;
  return { role, status: data.status, id: data.id };
}

/**
 * Whether the viewer is allowed to act on the target's lifecycle.
 * - Owner can act on admins and members (not themselves, not other owners).
 * - Admin can act on members only.
 */
function canActOnTarget(
  viewerRole: MembershipRole,
  targetRole: MembershipRole
): boolean {
  if (viewerRole === "owner") return targetRole !== "owner";
  if (viewerRole === "admin") return targetRole === "member";
  return false;
}

/* ── Role changes ──────────────────────────────────────────────── */

export async function promoteMemberToAdmin(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) return err("Missing club or member.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  // Self-action guard: promoting yourself is a no-op / nonsensical
  if (targetUserId === user.id) return err("You cannot change your own role.");

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || viewer.role !== "owner")
    return err("Only the club owner can promote members to admin.");
  // Suspended/cancelled owner shouldn't be able to act
  if (viewer.status !== "active")
    return err("Your membership is not active in this club.");

  const target = await loadMembership(clubId, targetUserId);
  if (!target) return err("That user is not a member of this club.");
  if (target.role !== "member")
    return err("Only members with the member role can be promoted to admin.");
  if (target.status !== "active")
    return err("Only active members can be promoted to admin.");

  // Optimistic lock: include current role in WHERE to guard against concurrent changes
  const { data: updatedRows, error: updateError } = await supabase
    .from("memberships")
    .update({ role: "admin" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId)
    .eq("role", "member")
    .select("id");

  if (updateError) return err(updateError.message);
  if (!updatedRows?.length)
    return err(
      "Could not promote: member's role may have changed. Please refresh."
    );

  const actorDisplayName = await getActorDisplayName(supabase, user.id);
  const targetDisplayName = await getActorDisplayName(supabase, targetUserId);

  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName,
    clubId,
    action: "membership.role_promoted",
    entityType: "membership",
    entityId: target.id,
    metadata: {
      target_user_id: targetUserId,
      target_display_name: targetDisplayName,
      membership_id: target.id,
      previous_role: "member",
      new_role: "admin",
    },
  });

  revalidatePath(`/club/${clubId}`);
  return success(`${targetDisplayName ?? "Member"} promoted to admin.`);
}

export async function demoteAdminToMember(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) return err("Missing club or member.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  if (targetUserId === user.id) return err("You cannot change your own role.");

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || viewer.role !== "owner")
    return err("Only the club owner can demote an admin to member.");
  if (viewer.status !== "active")
    return err("Your membership is not active in this club.");

  const target = await loadMembership(clubId, targetUserId);
  if (!target) return err("That user is not a member of this club.");
  if (target.role === "owner") return err("The owner cannot be demoted.");
  if (target.role !== "admin")
    return err("Only admins can be demoted to members.");

  // Optimistic lock: include current role in WHERE
  const { data: updatedRows, error: updateError } = await supabase
    .from("memberships")
    .update({ role: "member" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId)
    .eq("role", "admin")
    .select("id");

  if (updateError) return err(updateError.message);
  if (!updatedRows?.length)
    return err(
      "Could not demote: admin's role may have changed. Please refresh."
    );

  const actorDisplayName = await getActorDisplayName(supabase, user.id);
  const targetDisplayName = await getActorDisplayName(supabase, targetUserId);

  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName,
    clubId,
    action: "membership.role_demoted",
    entityType: "membership",
    entityId: target.id,
    metadata: {
      target_user_id: targetUserId,
      target_display_name: targetDisplayName,
      membership_id: target.id,
      previous_role: "admin",
      new_role: "member",
    },
  });

  revalidatePath(`/club/${clubId}`);
  return success(`${targetDisplayName ?? "Admin"} demoted to member.`);
}

/* ── Membership lifecycle ──────────────────────────────────────── */

export async function approvePendingMember(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) return err("Missing club or member.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  // Explicit self-approval guard: the "someone else must approve you" invariant
  if (targetUserId === user.id)
    return err("You cannot approve your own membership.");

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "owner"))
    return err("You do not have permission to approve members.");
  if (viewer.status !== "active")
    return err("Your membership is not active in this club.");

  const target = await loadMembership(clubId, targetUserId);
  if (!target) return err("That user is not a member of this club.");
  if (target.status !== "pending")
    return err("Only pending memberships can be approved.");
  if (target.role !== "member")
    return err("This membership cannot be approved.");

  // Optimistic lock: only update if still pending — guards against concurrent
  // approvals and ensures exactly one actor succeeds
  const { data: updatedRows, error: updateError } = await supabase
    .from("memberships")
    .update({ status: "active" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId)
    .eq("status", "pending")
    .select("id");

  if (updateError) return err(updateError.message);
  if (!updatedRows?.length)
    return err("Membership was already actioned. Please refresh.");

  const actorDisplayName = await getActorDisplayName(supabase, user.id);
  const targetDisplayName = await getActorDisplayName(supabase, targetUserId);

  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName,
    clubId,
    action: "membership.approved",
    entityType: "membership",
    entityId: target.id,
    metadata: {
      target_user_id: targetUserId,
      target_display_name: targetDisplayName,
      membership_id: target.id,
      previous_status: "pending",
      new_status: "active",
    },
  });

  revalidatePath(`/club/${clubId}`);
  return success("Member approved.");
}

export async function suspendMember(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) return err("Missing club or member.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  if (targetUserId === user.id)
    return err("You cannot suspend your own membership.");

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "owner"))
    return err("You do not have permission to suspend members.");
  if (viewer.status !== "active")
    return err("Your membership is not active in this club.");

  const target = await loadMembership(clubId, targetUserId);
  if (!target) return err("That user is not a member of this club.");
  if (target.role === "owner") return err("The club owner cannot be suspended.");
  if (!canActOnTarget(viewer.role, target.role))
    return err("You do not have permission to suspend this member.");
  // Valid transition: only active → suspended
  if (target.status !== "active")
    return err("Only active members can be suspended.");

  // Optimistic lock: include current status in WHERE
  const { data: updatedRows, error: updateError } = await supabase
    .from("memberships")
    .update({ status: "suspended" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId)
    .eq("status", "active")
    .select("id");

  if (updateError) return err(updateError.message);
  if (!updatedRows?.length)
    return err(
      "Membership status has already changed. Please refresh and try again."
    );

  const actorDisplayName = await getActorDisplayName(supabase, user.id);
  const targetDisplayName = await getActorDisplayName(supabase, targetUserId);

  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName,
    clubId,
    action: "membership.suspended",
    entityType: "membership",
    entityId: target.id,
    metadata: {
      target_user_id: targetUserId,
      target_display_name: targetDisplayName,
      membership_id: target.id,
      previous_status: "active",
      new_status: "suspended",
    },
  });

  revalidatePath(`/club/${clubId}`);
  return success("Member suspended.");
}

export async function reactivateMember(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) return err("Missing club or member.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  if (targetUserId === user.id)
    return err("You cannot reactivate your own membership this way.");

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "owner"))
    return err("You do not have permission to reactivate members.");
  if (viewer.status !== "active")
    return err("Your membership is not active in this club.");

  const target = await loadMembership(clubId, targetUserId);
  if (!target) return err("That user is not a member of this club.");
  if (target.role === "owner")
    return err("The owner's membership cannot be changed this way.");
  if (!canActOnTarget(viewer.role, target.role))
    return err("You do not have permission to reactivate this member.");
  // Valid transition: only suspended → active
  if (target.status !== "suspended")
    return err("Only suspended memberships can be reactivated.");

  // Optimistic lock: include current status in WHERE
  const { data: updatedRows, error: updateError } = await supabase
    .from("memberships")
    .update({ status: "active" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId)
    .eq("status", "suspended")
    .select("id");

  if (updateError) return err(updateError.message);
  if (!updatedRows?.length)
    return err(
      "Membership status has already changed. Please refresh and try again."
    );

  const actorDisplayName = await getActorDisplayName(supabase, user.id);
  const targetDisplayName = await getActorDisplayName(supabase, targetUserId);

  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName,
    clubId,
    action: "membership.reactivated",
    entityType: "membership",
    entityId: target.id,
    metadata: {
      target_user_id: targetUserId,
      target_display_name: targetDisplayName,
      membership_id: target.id,
      previous_status: "suspended",
      new_status: "active",
    },
  });

  revalidatePath(`/club/${clubId}`);
  return success("Member reactivated.");
}

/**
 * Remove a member from the club.
 *
 * Status-transition model:
 *   - pending  → hard DELETE: the join request was never accepted; there is no
 *     payment or draw-entry history to preserve, so deleting the row is safe
 *     and keeps the table clean.
 *   - active / suspended → status = "cancelled": the membership has a real
 *     history (payments, draw entries may reference the membership id).
 *     Soft-deletion via "cancelled" preserves referential integrity and lets
 *     the audit trail and draw-eligibility checks continue to function
 *     correctly.  Cancelled memberships are already excluded from all
 *     eligibility queries.
 *   - cancelled → no-op / error: already removed.
 */
export async function removeMemberFromClub(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) return err("Missing club or member.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  if (targetUserId === user.id)
    return err("You cannot remove yourself from the club.");

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "owner"))
    return err("You do not have permission to remove members.");
  if (viewer.status !== "active")
    return err("Your membership is not active in this club.");

  const target = await loadMembership(clubId, targetUserId);
  if (!target) return err("That user is not a member of this club.");
  if (target.role === "owner") return err("The club owner cannot be removed.");
  if (viewer.role === "admin" && target.role !== "member")
    return err("Admins can only remove members with the member role.");
  if (target.status === "cancelled")
    return err("This membership has already been removed.");

  const actorDisplayName = await getActorDisplayName(supabase, user.id);
  const targetDisplayName = await getActorDisplayName(supabase, targetUserId);

  if (target.status === "pending") {
    // Hard delete: pending requests have no payment or draw-entry history.
    // Optimistic lock: scope DELETE to the pending status so a concurrent
    // approval can't be silently undone.
    const { data: deletedRows, error: deleteError } = await supabase
      .from("memberships")
      .delete()
      .eq("club_id", clubId)
      .eq("user_id", targetUserId)
      .eq("status", "pending")
      .select("id");

    if (deleteError) return err(deleteError.message);
    if (!deletedRows?.length)
      return err("Membership has already been actioned. Please refresh.");

    await insertClubAuditEvent(supabase, {
      actorUserId: user.id,
      actorDisplayName,
      clubId,
      action: "membership.rejected",
      entityType: "membership",
      entityId: target.id,
      metadata: {
        target_user_id: targetUserId,
        target_display_name: targetDisplayName,
        membership_id: target.id,
        previous_status: "pending",
        new_status: null,
      },
    });
  } else {
    // Soft delete: set cancelled to preserve history (payments, draw entries).
    // Optimistic lock: match the current status we verified above.
    const { data: updatedRows, error: updateError } = await supabase
      .from("memberships")
      .update({ status: "cancelled" })
      .eq("club_id", clubId)
      .eq("user_id", targetUserId)
      .eq("status", target.status)
      .select("id");

    if (updateError) return err(updateError.message);
    if (!updatedRows?.length)
      return err(
        "Membership status has already changed. Please refresh and try again."
      );

    await insertClubAuditEvent(supabase, {
      actorUserId: user.id,
      actorDisplayName,
      clubId,
      action: "membership.removed",
      entityType: "membership",
      entityId: target.id,
      metadata: {
        target_user_id: targetUserId,
        target_display_name: targetDisplayName,
        membership_id: target.id,
        previous_status: target.status,
        new_status: "cancelled",
      },
    });
  }

  revalidatePath(`/club/${clubId}`);
  return success("Member removed.");
}

/**
 * Transfer club ownership to another active member.
 *
 * Atomicity: Supabase JS does not expose a client-side transaction API, so we
 * perform two sequential updates and rollback the first if the second fails.
 * The order is deliberate:
 *   1. Promote the target to "owner" — if this fails, nothing has changed.
 *   2. Demote the former owner to "admin" — if this fails, we undo step 1 so
 *      the club never ends up with zero owners.
 *
 * Former owner becomes "admin" (not "member") so they retain management
 * capability. The new owner can demote them further if desired.
 */
export async function transferOwnership(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) return err("Missing club or member.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  if (targetUserId === user.id)
    return err("You cannot transfer ownership to yourself.");

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || viewer.role !== "owner")
    return err("Only the current club owner can transfer ownership.");
  if (viewer.status !== "active")
    return err("Your membership is not active in this club.");

  const target = await loadMembership(clubId, targetUserId);
  if (!target) return err("That user is not a member of this club.");
  if (target.role === "owner") return err("That member is already the owner.");
  if (target.status !== "active")
    return err("Ownership can only be transferred to an active member.");
  if (target.role !== "member" && target.role !== "admin")
    return err("Target must be an active member or admin.");

  // Step 1: promote target to owner.
  // Optimistic lock: match the target's current role so a concurrent
  // demotion/removal cannot produce an inconsistent state.
  const { data: promoteRows, error: promoteErr } = await supabase
    .from("memberships")
    .update({ role: "owner" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId)
    .eq("role", target.role)
    .eq("status", "active")
    .select("id");

  if (promoteErr) return err(promoteErr.message);
  if (!promoteRows?.length)
    return err(
      "Target membership changed before transfer could complete. Please refresh."
    );

  // Step 2: demote current owner to admin.
  // Optimistic lock: we must still be the owner.
  const { data: demoteRows, error: demoteErr } = await supabase
    .from("memberships")
    .update({ role: "admin" })
    .eq("club_id", clubId)
    .eq("user_id", user.id)
    .eq("role", "owner")
    .select("id");

  if (demoteErr || !demoteRows?.length) {
    // Rollback step 1 — restore the target's previous role
    await supabase
      .from("memberships")
      .update({ role: target.role })
      .eq("club_id", clubId)
      .eq("user_id", targetUserId);

    return err(
      "Transfer failed partway through and has been rolled back. Please try again."
    );
  }

  const actorDisplayName = await getActorDisplayName(supabase, user.id);
  const targetDisplayName = await getActorDisplayName(supabase, targetUserId);

  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName,
    clubId,
    action: "ownership.transferred",
    entityType: "membership",
    entityId: target.id,
    metadata: {
      previous_owner_user_id: user.id,
      previous_owner_display_name: actorDisplayName,
      previous_owner_membership_id: viewer.id,
      new_owner_user_id: targetUserId,
      new_owner_display_name: targetDisplayName,
      new_owner_membership_id: target.id,
      former_owner_new_role: "admin",
    },
  });

  revalidatePath(`/club/${clubId}`);
  return success(
    `Ownership transferred to ${targetDisplayName ?? "the selected member"}. You are now an admin.`
  );
}

/**
 * Rotate the club's invite token.
 *
 * Generates a new UUID token on the club row. The old invite link stops
 * working immediately because the join page looks up the token at request
 * time. Existing memberships are completely unaffected.
 *
 * Only owner or admin can rotate. The new token prefix (first 8 chars) is
 * logged in the audit trail so rotations are traceable without exposing
 * the full token in logs.
 */
export async function rotateInviteToken(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  if (!clubId) return err("Missing club.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return err("You must be signed in.");

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || (viewer.role !== "owner" && viewer.role !== "admin"))
    return err("Only owners and admins can rotate the invite link.");
  if (viewer.status !== "active")
    return err("Your membership is not active in this club.");

  const newToken = crypto.randomUUID();

  const { error: updateError } = await supabase
    .from("clubs")
    .update({ invite_token: newToken })
    .eq("id", clubId);

  if (updateError) return err(updateError.message);

  const actorDisplayName = await getActorDisplayName(supabase, user.id);

  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName,
    clubId,
    action: "invite.token_rotated",
    entityType: "club",
    entityId: clubId,
    metadata: {
      actor_display_name: actorDisplayName,
      new_token_prefix: newToken.slice(0, 8),
    },
  });

  revalidatePath(`/club/${clubId}`);
  return success("Invite link rotated. The old link no longer works.");
}

/**
 * @deprecated Use removeMemberFromClub instead.
 * Kept to avoid breaking any other call-sites that may still reference it.
 */
export async function cancelMembership(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  return removeMemberFromClub(_prevState, formData);
}
