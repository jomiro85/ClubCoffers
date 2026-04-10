import type { ReactNode } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "muted";

const toneClass: Record<Tone, string> = {
  neutral:
    "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-100",
  success:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  warning:
    "bg-amber-100 text-amber-950 dark:bg-amber-900/40 dark:text-amber-200",
  danger:
    "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200",
  info: "bg-sky-100 text-sky-950 dark:bg-sky-900/40 dark:text-sky-200",
  muted:
    "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400",
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
      className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}

/** Membership lifecycle: pending, active, suspended, cancelled */
export function MembershipStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "pending") {
    return <StatusBadge tone="warning">Pending approval</StatusBadge>;
  }
  if (s === "active") {
    return <StatusBadge tone="success">Active</StatusBadge>;
  }
  if (s === "suspended") {
    return <StatusBadge tone="danger">Suspended</StatusBadge>;
  }
  if (s === "cancelled") {
    return <StatusBadge tone="neutral">Cancelled</StatusBadge>;
  }
  return <StatusBadge tone="muted">{status}</StatusBadge>;
}

/** Current-cycle payment: Paid / Unpaid; not applicable for non-active members */
export function PaymentStatusBadge({
  membershipStatus,
  hasSucceededPayment,
}: {
  membershipStatus: string;
  hasSucceededPayment: boolean;
}) {
  if (membershipStatus !== "active") {
    return <span className="text-neutral-500">—</span>;
  }
  return hasSucceededPayment ? (
    <StatusBadge tone="success">Paid</StatusBadge>
  ) : (
    <StatusBadge tone="warning">Unpaid</StatusBadge>
  );
}

/** Draw cycle lifecycle */
export function DrawCycleStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "open") return <StatusBadge tone="info">Open</StatusBadge>;
  if (s === "closed") return <StatusBadge tone="warning">Closed</StatusBadge>;
  if (s === "drawn") return <StatusBadge tone="info">Drawn</StatusBadge>;
  if (s === "settled") return <StatusBadge tone="success">Settled</StatusBadge>;
  if (s === "cancelled") return <StatusBadge tone="neutral">Cancelled</StatusBadge>;
  return <StatusBadge tone="muted">{status}</StatusBadge>;
}

export function WinnerBadge({ isWinner }: { isWinner: boolean }) {
  return isWinner ? (
    <StatusBadge tone="success">Yes</StatusBadge>
  ) : (
    <StatusBadge tone="muted">No</StatusBadge>
  );
}

/** Settlement payout state */
export function SettlementStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "paid") return <StatusBadge tone="success">Paid</StatusBadge>;
  if (s === "pending") return <StatusBadge tone="warning">Pending</StatusBadge>;
  if (s === "processing") return <StatusBadge tone="info">Processing</StatusBadge>;
  if (s === "confirmed") return <StatusBadge tone="info">Confirmed</StatusBadge>;
  if (s === "failed") return <StatusBadge tone="danger">Failed</StatusBadge>;
  if (s === "canceled" || s === "cancelled") {
    return <StatusBadge tone="neutral">Canceled</StatusBadge>;
  }
  return <StatusBadge tone="muted">{status}</StatusBadge>;
}
