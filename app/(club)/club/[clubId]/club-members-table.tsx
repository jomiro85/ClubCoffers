"use client";

import {
  MembershipStatusBadge,
  PaymentStatusBadge,
} from "@/components/status-badges";
import { useActionState } from "react";
import {
  type ClubAdminActionState,
  approvePendingMember,
  demoteAdminToMember,
  promoteMemberToAdmin,
  reactivateMember,
  removeMemberFromClub,
  suspendMember,
  transferOwnership,
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

/* ── Visibility helpers ────────────────────────────────────────── */

/** Approve: owner or admin on pending members only */
function showApprove(vr: string, vuid: string, t: MemberRow) {
  if (vuid === t.userId) return false;
  if (vr !== "owner" && vr !== "admin") return false;
  return t.status === "pending" && t.role === "member";
}

/** Suspend: active → suspended (owner on admin/member; admin on member only) */
function showSuspend(vr: string, vuid: string, t: MemberRow) {
  if (vuid === t.userId) return false;
  if (t.role === "owner") return false;
  if (t.status !== "active") return false;
  if (vr === "owner") return t.role === "admin" || t.role === "member";
  if (vr === "admin") return t.role === "member";
  return false;
}

/** Reactivate: suspended → active (same permission as suspend) */
function showReactivate(vr: string, vuid: string, t: MemberRow) {
  if (vuid === t.userId) return false;
  if (t.role === "owner") return false;
  if (t.status !== "suspended") return false;
  if (vr === "owner") return t.role === "admin" || t.role === "member";
  if (vr === "admin") return t.role === "member";
  return false;
}

/**
 * Remove: available for pending / active / suspended (not cancelled, not owner).
 * Owner can remove admins and members; admin can only remove members.
 * The server action chooses hard-delete (pending) vs soft-cancel (active/suspended).
 */
function showRemove(vr: string, vuid: string, t: MemberRow) {
  if (vuid === t.userId) return false;
  if (t.role === "owner") return false;
  if (t.status === "cancelled") return false;
  if (vr === "owner") return t.role === "member" || t.role === "admin";
  if (vr === "admin") return t.role === "member";
  return false;
}

/** Promote: owner on active members */
function showPromote(vr: string, vuid: string, t: MemberRow) {
  if (vuid === t.userId) return false;
  if (vr !== "owner") return false;
  return t.role === "member" && t.status === "active";
}

/** Demote: owner on any admin */
function showDemote(vr: string, vuid: string, t: MemberRow) {
  if (vuid === t.userId) return false;
  if (vr !== "owner") return false;
  return t.role === "admin";
}

/**
 * Transfer ownership: only owner, only to active admin or member.
 * Not shown on the owner's own row.
 */
function showTransferOwnership(vr: string, vuid: string, t: MemberRow) {
  if (vr !== "owner") return false;
  if (vuid === t.userId) return false;
  if (t.role === "owner") return false;
  if (t.status !== "active") return false;
  return t.role === "admin" || t.role === "member";
}

/* ── Row styling ───────────────────────────────────────────────── */
function rowBg(status: string) {
  if (status === "suspended") return "bg-amber-50/60";
  if (status === "cancelled") return "bg-slate-50 opacity-60";
  return "";
}

/* ── Button styles ─────────────────────────────────────────────── */
const transferBtn =
  "rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 shadow-sm transition-colors hover:bg-violet-100";

const actionBtn =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:border-slate-300";

const approveBtn =
  "rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100";

const reactivateBtn =
  "rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-800 shadow-sm transition-colors hover:bg-sky-100";

const dangerBtn =
  "rounded-lg border border-red-100 bg-white px-2.5 py-1 text-xs font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50";

/* ── Component ─────────────────────────────────────────────────── */
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

  const [approveState, approveAction] = useActionState(approvePendingMember, initial);
  const [suspendState, suspendAction] = useActionState(suspendMember, initial);
  const [reactivateState, reactivateAction] = useActionState(reactivateMember, initial);
  const [removeState, removeAction] = useActionState(removeMemberFromClub, initial);
  const [promoteState, promoteAction] = useActionState(promoteMemberToAdmin, initial);
  const [demoteState, demoteAction] = useActionState(demoteAdminToMember, initial);
  const [transferState, transferAction] = useActionState(transferOwnership, initial);

  const actionError =
    approveState.error ??
    suspendState.error ??
    reactivateState.error ??
    removeState.error ??
    promoteState.error ??
    demoteState.error ??
    transferState.error;

  const actionSuccess =
    approveState.success ??
    suspendState.success ??
    reactivateState.success ??
    removeState.success ??
    transferState.success;

  // Pending members float to the top of the list
  const pendingMembers = members.filter((m) => m.status === "pending");
  const otherMembers = members.filter((m) => m.status !== "pending");
  const sortedMembers = [...pendingMembers, ...otherMembers];

  return (
    <section
      id="members"
      className="scroll-mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Members</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {canManage
              ? "Approve pending requests before they can pay or enter draws."
              : "Everyone in this club and their current status."}
          </p>
        </div>
        {pendingMembers.length > 0 && canManage ? (
          <span className="ml-4 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
            {pendingMembers.length} pending
          </span>
        ) : null}
      </div>

      {/* Feedback banner */}
      {canManage && actionError ? (
        <div className="border-b border-red-100 bg-red-50 px-6 py-3">
          <p className="text-sm text-red-700" role="alert">
            {actionError}
          </p>
        </div>
      ) : null}
      {canManage && actionSuccess ? (
        <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-3">
          <p className="text-sm text-emerald-700">{actionSuccess}</p>
        </div>
      ) : null}

      {/* Empty state */}
      {members.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-600">No members yet</p>
          <p className="mt-1 text-sm text-slate-400">
            Share the invite link so people can join.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Role
                </th>
                <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Status
                </th>
                {hasOpenCycle ? (
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Payment
                  </th>
                ) : null}
                {canManage ? (
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {sortedMembers.map((m) => {
                const hasPaid = paidSet.has(m.membershipId);
                return (
                  <tr
                    key={m.userId}
                    className={`border-b border-slate-50 last:border-0 ${rowBg(m.status)}`}
                  >
                    <td className="px-6 py-3.5 font-medium text-slate-900">
                      {m.displayName ?? (
                        <span className="font-normal text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {m.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <MembershipStatusBadge status={m.status} />
                    </td>
                    {hasOpenCycle ? (
                      <td className="px-4 py-3.5">
                        <PaymentStatusBadge
                          membershipStatus={m.status}
                          hasSucceededPayment={hasPaid}
                        />
                      </td>
                    ) : null}
                    {canManage ? (
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* ── pending: Approve + Reject ── */}
                          {showApprove(viewerRole, viewerUserId, m) ? (
                            <form action={approveAction}>
                              <input type="hidden" name="club_id" value={clubId} />
                              <input type="hidden" name="target_user_id" value={m.userId} />
                              <button type="submit" className={approveBtn}>
                                Approve
                              </button>
                            </form>
                          ) : null}

                          {/* ── active: Suspend ── */}
                          {showSuspend(viewerRole, viewerUserId, m) ? (
                            <form action={suspendAction}>
                              <input type="hidden" name="club_id" value={clubId} />
                              <input type="hidden" name="target_user_id" value={m.userId} />
                              <button type="submit" className={dangerBtn}>
                                Suspend
                              </button>
                            </form>
                          ) : null}

                          {/* ── suspended: Reactivate ── */}
                          {showReactivate(viewerRole, viewerUserId, m) ? (
                            <form action={reactivateAction}>
                              <input type="hidden" name="club_id" value={clubId} />
                              <input type="hidden" name="target_user_id" value={m.userId} />
                              <button type="submit" className={reactivateBtn}>
                                Reactivate
                              </button>
                            </form>
                          ) : null}

                          {/* ── role: Promote / Demote ── */}
                          {showPromote(viewerRole, viewerUserId, m) ? (
                            <form action={promoteAction}>
                              <input type="hidden" name="club_id" value={clubId} />
                              <input type="hidden" name="target_user_id" value={m.userId} />
                              <button type="submit" className={actionBtn}>
                                Make admin
                              </button>
                            </form>
                          ) : null}
                          {showDemote(viewerRole, viewerUserId, m) ? (
                            <form action={demoteAction}>
                              <input type="hidden" name="club_id" value={clubId} />
                              <input type="hidden" name="target_user_id" value={m.userId} />
                              <button type="submit" className={actionBtn}>
                                Remove admin
                              </button>
                            </form>
                          ) : null}

                          {/* ── Remove / Reject (all applicable statuses) ── */}
                          {showRemove(viewerRole, viewerUserId, m) ? (
                            <form action={removeAction}>
                              <input type="hidden" name="club_id" value={clubId} />
                              <input type="hidden" name="target_user_id" value={m.userId} />
                              <button type="submit" className={dangerBtn}>
                                {m.status === "pending" ? "Reject" : "Remove"}
                              </button>
                            </form>
                          ) : null}

                          {/* ── Transfer ownership (owner only, active targets) ── */}
                          {showTransferOwnership(viewerRole, viewerUserId, m) ? (
                            <form
                              action={transferAction}
                              onSubmit={(e) => {
                                const name = m.displayName ?? "this member";
                                const confirmed = window.confirm(
                                  `Transfer ownership to ${name}?\n\nThey will become the club owner. You will become an admin. This cannot be undone without their cooperation.`
                                );
                                if (!confirmed) e.preventDefault();
                              }}
                            >
                              <input type="hidden" name="club_id" value={clubId} />
                              <input type="hidden" name="target_user_id" value={m.userId} />
                              <button type="submit" className={transferBtn}>
                                Transfer ownership
                              </button>
                            </form>
                          ) : null}
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

      <div className="border-t border-slate-50 px-6 py-3">
        <p className="text-xs text-slate-400">
          Suspended and cancelled members are excluded from all draw cycles.
          Reactivate a suspended member to restore their eligibility.
        </p>
      </div>
    </section>
  );
}
