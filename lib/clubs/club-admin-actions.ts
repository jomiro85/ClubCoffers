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

export async function promoteMemberToAdmin(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) {
    return { error: "Missing club or member." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || viewer.role !== "owner") {
    return { error: "Only the club owner can promote members to admin." };
  }

  const target = await loadMembership(clubId, targetUserId);
  if (!target) {
    return { error: "That user is not a member of this club." };
  }
  if (target.role !== "member") {
    return { error: "Only members with the member role can be promoted to admin." };
  }
  if (target.status !== "active") {
    return { error: "Only active members can be promoted to admin." };
  }

  const { error: updateError } = await supabase
    .from("memberships")
    .update({ role: "admin" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/club/${clubId}`);
  return ok;
}

export async function demoteAdminToMember(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) {
    return { error: "Missing club or member." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || viewer.role !== "owner") {
    return { error: "Only the club owner can demote an admin to member." };
  }

  const target = await loadMembership(clubId, targetUserId);
  if (!target) {
    return { error: "That user is not a member of this club." };
  }
  if (target.role === "owner") {
    return { error: "The owner cannot be demoted." };
  }
  if (target.role !== "admin") {
    return { error: "Only admins can be demoted to members." };
  }

  const { error: updateError } = await supabase
    .from("memberships")
    .update({ role: "member" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/club/${clubId}`);
  return ok;
}

export async function approvePendingMember(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) {
    return { error: "Missing club or member." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "owner")) {
    return { error: "You do not have permission to approve members." };
  }

  const target = await loadMembership(clubId, targetUserId);
  if (!target) {
    return { error: "That user is not a member of this club." };
  }
  if (target.status !== "pending") {
    return { error: "Only pending memberships can be approved." };
  }
  if (target.role !== "member") {
    return { error: "This membership cannot be approved." };
  }

  const { error: updateError } = await supabase
    .from("memberships")
    .update({ status: "active" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(`/club/${clubId}`);
  return ok;
}

export async function removeMemberFromClub(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) {
    return { error: "Missing club or member." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You must be signed in." };
  }

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "owner")) {
    return { error: "You do not have permission to remove members." };
  }

  if (targetUserId === user.id) {
    return { error: "You cannot remove yourself from the club." };
  }

  const target = await loadMembership(clubId, targetUserId);
  if (!target) {
    return { error: "That user is not a member of this club." };
  }

  if (target.role === "owner") {
    return { error: "The club owner cannot be removed." };
  }

  if (viewer.role === "admin") {
    if (target.role !== "member") {
      return {
        error: "Admins can only remove members with the member role.",
      };
    }
  }

  const { error: deleteError } = await supabase
    .from("memberships")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", targetUserId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath(`/club/${clubId}`);
  return ok;
}

function canSuspendOrCancelAsViewer(
  viewerRole: MembershipRole,
  targetRole: MembershipRole
): boolean {
  if (viewerRole === "owner") {
    return targetRole !== "owner";
  }
  if (viewerRole === "admin") {
    return targetRole === "member";
  }
  return false;
}

export async function suspendMember(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) {
    return err("Missing club or member.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err("You must be signed in.");
  }

  if (targetUserId === user.id) {
    return err("You cannot suspend your own membership.");
  }

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "owner")) {
    return err("You do not have permission to suspend members.");
  }

  const target = await loadMembership(clubId, targetUserId);
  if (!target) {
    return err("That user is not a member of this club.");
  }
  if (target.role === "owner") {
    return err("The club owner cannot be suspended.");
  }
  if (!canSuspendOrCancelAsViewer(viewer.role, target.role)) {
    return err("You do not have permission to suspend this member.");
  }
  if (target.status !== "active") {
    return err("Only active members can be suspended.");
  }

  const targetDisplayName = await getActorDisplayName(supabase, targetUserId);

  const { error: updateError } = await supabase
    .from("memberships")
    .update({ status: "suspended" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId);

  if (updateError) {
    return err(updateError.message);
  }

  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName: await getActorDisplayName(supabase, user.id),
    clubId,
    action: "membership.suspended",
    entityType: "membership",
    entityId: target.id,
    metadata: {
      target_user_id: targetUserId,
      target_display_name: targetDisplayName,
      membership_id: target.id,
      previous_status: target.status,
    },
  });

  revalidatePath(`/club/${clubId}`);
  return { error: null, success: "Membership suspended." };
}

export async function cancelMembership(
  _prevState: ClubAdminActionState,
  formData: FormData
): Promise<ClubAdminActionState> {
  const clubId = getClubId(formData);
  const targetUserId = getTargetUserId(formData);
  if (!clubId || !targetUserId) {
    return err("Missing club or member.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return err("You must be signed in.");
  }

  if (targetUserId === user.id) {
    return err("You cannot cancel your own membership here.");
  }

  const viewer = await loadMembership(clubId, user.id);
  if (!viewer || (viewer.role !== "admin" && viewer.role !== "owner")) {
    return err("You do not have permission to cancel memberships.");
  }

  const target = await loadMembership(clubId, targetUserId);
  if (!target) {
    return err("That user is not a member of this club.");
  }
  if (target.role === "owner") {
    return err("The club owner cannot have their membership cancelled.");
  }
  if (!canSuspendOrCancelAsViewer(viewer.role, target.role)) {
    return err("You do not have permission to cancel this membership.");
  }
  if (target.status !== "active" && target.status !== "suspended") {
    return err("Only active or suspended memberships can be cancelled.");
  }

  const targetDisplayName = await getActorDisplayName(supabase, targetUserId);

  const { error: updateError } = await supabase
    .from("memberships")
    .update({ status: "cancelled" })
    .eq("club_id", clubId)
    .eq("user_id", targetUserId);

  if (updateError) {
    return err(updateError.message);
  }

  await insertClubAuditEvent(supabase, {
    actorUserId: user.id,
    actorDisplayName: await getActorDisplayName(supabase, user.id),
    clubId,
    action: "membership.cancelled",
    entityType: "membership",
    entityId: target.id,
    metadata: {
      target_user_id: targetUserId,
      target_display_name: targetDisplayName,
      membership_id: target.id,
      previous_status: target.status,
    },
  });

  revalidatePath(`/club/${clubId}`);
  return { error: null, success: "Membership cancelled." };
}
