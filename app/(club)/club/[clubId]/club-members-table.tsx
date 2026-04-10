"use client";

import { useActionState } from "react";
import {
  type ClubAdminActionState,
  approvePendingMember,
  cancelMembership,
  demoteAdminToMember,
  promoteMemberToAdmin,
  removeMemberFromClub,
  suspendMember,
} from "@/lib/clubs/club-admin-actions";

type MemberRow = {
  userId: string;
  displayName: string | null;
  role: string;
  status: string;
};

type ClubMembersTableProps = {
  clubId: string;
  viewerUserId: string;
  viewerRole: "owner" | "admin" | "member";
  members: MemberRow[];
};

const initial: ClubAdminActionState = { error: null, success: null };

function showApprove(
  viewerRole: string,
  viewerUserId: string,
  target: MemberRow
) {
  if (viewerUserId === target.userId) return false;
  if (viewerRole !== "owner" && viewerRole !== "admin") return false;
  return target.status === "pending" && target.role === "member";
}

function showPromote(
  viewerRole: string,
  viewerUserId: string,
  target: MemberRow
) {
  if (viewerUserId === target.userId) return false;
  if (viewerRole !== "owner") return false;
  return target.role === "member" && target.status === "active";
}

function showDemote(
  viewerRole: string,
  viewerUserId: string,
  target: MemberRow
) {
  if (viewerUserId === target.userId) return false;
  if (viewerRole !== "owner") return false;
  return target.role === "admin";
}

function showRemove(
  viewerRole: string,
  viewerUserId: string,
  target: MemberRow
) {
  if (viewerUserId === target.userId) return false;
  if (target.role === "owner") return false;
  if (viewerRole === "owner") {
    return target.role === "member" || target.role === "admin";
  }
  if (viewerRole === "admin") {
    return target.role === "member";
  }
  return false;
}

function showSuspend(
  viewerRole: string,
  viewerUserId: string,
  target: MemberRow
) {
  if (viewerUserId === target.userId) return false;
  if (target.role === "owner") return false;
  if (target.status !== "active") return false;
  if (viewerRole === "owner") {
    return target.role === "admin" || target.role === "member";
  }
  if (viewerRole === "admin") {
    return target.role === "member";
  }
  return false;
}

function showCancel(
  viewerRole: string,
  viewerUserId: string,
  target: MemberRow
) {
  if (viewerUserId === target.userId) return false;
  if (target.role === "owner") return false;
  if (target.status !== "active" && target.status !== "suspended") {
    return false;
  }
  if (viewerRole === "owner") {
    return target.role === "admin" || target.role === "member";
  }
  if (viewerRole === "admin") {
    return target.role === "member";
  }
  return false;
}

function rowStatusClass(status: string): string {
  if (status === "suspended") {
    return "bg-amber-50 dark:bg-amber-950/25";
  }
  if (status === "cancelled") {
    return "bg-neutral-100 opacity-90 dark:bg-neutral-900/40";
  }
  return "";
}

export function ClubMembersTable({
  clubId,
  viewerUserId,
  viewerRole,
  members,
}: ClubMembersTableProps) {
  const canManage = viewerRole === "owner" || viewerRole === "admin";

  const [approveState, approveAction] = useActionState(
    approvePendingMember,
    initial
  );
  const [promoteState, promoteAction] = useActionState(
    promoteMemberToAdmin,
    initial
  );
  const [demoteState, demoteAction] = useActionState(
    demoteAdminToMember,
    initial
  );
  const [removeState, removeAction] = useActionState(
    removeMemberFromClub,
    initial
  );
  const [suspendState, suspendAction] = useActionState(suspendMember, initial);
  const [cancelState, cancelAction] = useActionState(
    cancelMembership,
    initial
  );

  const actionError =
    approveState.error ??
    promoteState.error ??
    demoteState.error ??
    removeState.error ??
    suspendState.error ??
    cancelState.error;

  const actionSuccess =
    suspendState.success ?? cancelState.success;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Members</h2>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        Suspended and cancelled members are not eligible for future draw
        cycles.
      </p>
      {canManage && actionError ? (
        <p className="text-sm text-red-600" role="alert">
          {actionError}
        </p>
      ) : null}
      {canManage && actionSuccess ? (
        <p className="text-sm text-green-800 dark:text-green-300">{actionSuccess}</p>
      ) : null}
      <div className="overflow-x-auto rounded border border-neutral-300 dark:border-neutral-600">
        <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900">
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {canManage ? (
                <th className="px-3 py-2 font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.userId}
                className={`border-b border-neutral-200 last:border-0 dark:border-neutral-700 ${rowStatusClass(m.status)}`}
              >
                <td className="px-3 py-2">{m.displayName ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{m.role}</td>
                <td className="px-3 py-2 font-mono">
                  {m.status}
                  {m.status === "suspended" ? (
                    <span className="ml-2 text-xs text-amber-800 dark:text-amber-300">
                      (not eligible for draws)
                    </span>
                  ) : null}
                  {m.status === "cancelled" ? (
                    <span className="ml-2 text-xs text-neutral-600 dark:text-neutral-400">
                      (not eligible for draws)
                    </span>
                  ) : null}
                </td>
                {canManage ? (
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {showApprove(viewerRole, viewerUserId, m) ? (
                        <form action={approveAction}>
                          <input type="hidden" name="club_id" value={clubId} />
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={m.userId}
                          />
                          <button type="submit" className="text-xs underline">
                            Approve member
                          </button>
                        </form>
                      ) : null}
                      {showPromote(viewerRole, viewerUserId, m) ? (
                        <form action={promoteAction}>
                          <input type="hidden" name="club_id" value={clubId} />
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={m.userId}
                          />
                          <button type="submit" className="text-xs underline">
                            Promote to admin
                          </button>
                        </form>
                      ) : null}
                      {showDemote(viewerRole, viewerUserId, m) ? (
                        <form action={demoteAction}>
                          <input type="hidden" name="club_id" value={clubId} />
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={m.userId}
                          />
                          <button type="submit" className="text-xs underline">
                            Demote to member
                          </button>
                        </form>
                      ) : null}
                      {showSuspend(viewerRole, viewerUserId, m) ? (
                        <form action={suspendAction}>
                          <input type="hidden" name="club_id" value={clubId} />
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={m.userId}
                          />
                          <button type="submit" className="text-xs underline">
                            Suspend
                          </button>
                        </form>
                      ) : null}
                      {showCancel(viewerRole, viewerUserId, m) ? (
                        <form action={cancelAction}>
                          <input type="hidden" name="club_id" value={clubId} />
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={m.userId}
                          />
                          <button type="submit" className="text-xs underline">
                            Cancel membership
                          </button>
                        </form>
                      ) : null}
                      {showRemove(viewerRole, viewerUserId, m) ? (
                        <form action={removeAction}>
                          <input type="hidden" name="club_id" value={clubId} />
                          <input
                            type="hidden"
                            name="target_user_id"
                            value={m.userId}
                          />
                          <button type="submit" className="text-xs underline">
                            {m.status === "pending" ? "Reject" : "Remove"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
