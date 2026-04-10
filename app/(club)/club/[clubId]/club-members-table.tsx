"use client";

import {
  MembershipStatusBadge,
  PaymentStatusBadge,
} from "@/components/status-badges";
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
  membershipId: string;
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
  hasOpenCycle: boolean;
  paidMembershipIds: string[];
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

const btn =
  "rounded border border-transparent px-2 py-1 text-xs font-medium text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800";

export function ClubMembersTable({
  clubId,
  viewerUserId,
  viewerRole,
  members,
  hasOpenCycle,
  paidMembershipIds,
}: ClubMembersTableProps) {
  const canManage = viewerRole === "owner" || viewerRole === "admin";
  const paidSet = new Set(paidMembershipIds);

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
    <section
      id="members"
      className="scroll-mt-8 rounded-xl border border-neutral-200 p-5 dark:border-neutral-700"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
          Members
        </h2>
        {canManage ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">Pending</strong>{" "}
            means waiting for your approval.{" "}
            {hasOpenCycle ? (
              <>
                <strong className="font-medium text-neutral-800 dark:text-neutral-200">Payment</strong>{" "}
                reflects the open cycle only.
              </>
            ) : (
              "Open a cycle to record per-member payments."
            )}
          </p>
        ) : (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Membership status and — when a cycle is open — whether you&apos;ve
            paid for that cycle.
          </p>
        )}
      </div>
      <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
        Suspended and cancelled members are not eligible for future draw cycles.
      </p>
      {canManage && actionError ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {actionError}
        </p>
      ) : null}
      {canManage && actionSuccess ? (
        <p className="mt-2 text-sm text-green-800 dark:text-green-300">{actionSuccess}</p>
      ) : null}
      {members.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-600 dark:border-neutral-600 dark:text-neutral-400">
          No members yet. Share the invite link so people can join.
        </div>
      ) : (
      <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-600">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/80">
              <th className="px-3 py-2.5 font-medium">Display name</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium">Membership</th>
              {hasOpenCycle ? (
                <th className="px-3 py-2.5 font-medium">Payment (open cycle)</th>
              ) : null}
              {canManage ? (
                <th className="px-3 py-2.5 font-medium">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const hasPaid = paidSet.has(m.membershipId);
              return (
              <tr
                key={m.userId}
                className={`border-b border-neutral-100 last:border-0 dark:border-neutral-800 ${rowStatusClass(m.status)}`}
              >
                <td className="px-3 py-2.5">{m.displayName ?? "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{m.role}</td>
                <td className="px-3 py-2.5">
                  <MembershipStatusBadge status={m.status} />
                </td>
                {hasOpenCycle ? (
                  <td className="px-3 py-2.5">
                    <PaymentStatusBadge
                      membershipStatus={m.status}
                      hasSucceededPayment={hasPaid}
                    />
                  </td>
                ) : null}
                {canManage ? (
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-2">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          Membership
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {showApprove(viewerRole, viewerUserId, m) ? (
                            <form action={approveAction}>
                              <input type="hidden" name="club_id" value={clubId} />
                              <input
                                type="hidden"
                                name="target_user_id"
                                value={m.userId}
                              />
                              <button type="submit" className={btn}>
                                Approve
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
                              <button type="submit" className={btn}>
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
                              <button type="submit" className={btn}>
                                Cancel
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
                              <button type="submit" className={btn}>
                                {m.status === "pending" ? "Reject" : "Remove"}
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
                          Role
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {showPromote(viewerRole, viewerUserId, m) ? (
                            <form action={promoteAction}>
                              <input type="hidden" name="club_id" value={clubId} />
                              <input
                                type="hidden"
                                name="target_user_id"
                                value={m.userId}
                              />
                              <button type="submit" className={btn}>
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
                              <button type="submit" className={btn}>
                                Demote to member
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                ) : null}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
