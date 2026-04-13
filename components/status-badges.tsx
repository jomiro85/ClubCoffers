import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "muted";

/* Restrained pill badges — small, border-based, low visual noise */
const toneClass: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/15",
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20",
  info: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
  muted: "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-500/10",
};

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

/** Membership lifecycle: pending · active · suspended · cancelled */
export function MembershipStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "pending")   return <StatusBadge tone="warning">Pending approval</StatusBadge>;
  if (s === "active")    return <StatusBadge tone="success">Active</StatusBadge>;
  if (s === "suspended") return <StatusBadge tone="danger">Suspended</StatusBadge>;
  if (s === "cancelled") return <StatusBadge tone="neutral">Cancelled</StatusBadge>;
  return <StatusBadge tone="muted">{status}</StatusBadge>;
}

/** Current-cycle payment state */
export function PaymentStatusBadge({
  membershipStatus,
  hasSucceededPayment,
}: {
  membershipStatus: string;
  hasSucceededPayment: boolean;
}) {
  if (membershipStatus !== "active") {
    return <span className="text-slate-400">—</span>;
  }
  return hasSucceededPayment ? (
    <StatusBadge tone="success">Paid</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Unpaid</StatusBadge>
  );
}

/** Draw cycle lifecycle: open · closed · drawn · settled */
export function DrawCycleStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "open")      return <StatusBadge tone="info">Open</StatusBadge>;
  if (s === "closed")    return <StatusBadge tone="warning">Closed</StatusBadge>;
  if (s === "drawn")     return <StatusBadge tone="success">Drawn</StatusBadge>;
  if (s === "settled")   return <StatusBadge tone="success">Settled</StatusBadge>;
  if (s === "cancelled") return <StatusBadge tone="neutral">Cancelled</StatusBadge>;
  return <StatusBadge tone="muted">{status}</StatusBadge>;
}

export function WinnerBadge({ isWinner }: { isWinner: boolean }) {
  return isWinner ? (
    <StatusBadge tone="success">Winner</StatusBadge>
  ) : (
    <StatusBadge tone="muted">—</StatusBadge>
  );
}

/** Settlement payout state */
export function SettlementStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "paid")        return <StatusBadge tone="success">Paid</StatusBadge>;
  if (s === "pending")     return <StatusBadge tone="warning">Pending</StatusBadge>;
  if (s === "processing")  return <StatusBadge tone="info">Processing</StatusBadge>;
  if (s === "confirmed")   return <StatusBadge tone="info">Confirmed</StatusBadge>;
  if (s === "failed")      return <StatusBadge tone="danger">Failed</StatusBadge>;
  if (s === "canceled" || s === "cancelled") {
    return <StatusBadge tone="neutral">Cancelled</StatusBadge>;
  }
  return <StatusBadge tone="muted">{status}</StatusBadge>;
}
