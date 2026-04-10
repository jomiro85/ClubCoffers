export type ReconciliationRow = {
  membershipId: string;
  userId: string;
  displayName: string | null;
  role: string;
  membershipStatus: string;
  hasSucceededPayment: boolean;
  reconciliationLabel:
    | "eligible_candidate"
    | "unpaid"
    | "pending_member"
    | "suspended_or_cancelled";
};

function cyclePaymentLabel(r: ReconciliationRow): string {
  if (r.membershipStatus === "pending") {
    return "Pending approval";
  }
  if (r.membershipStatus === "active") {
    return r.hasSucceededPayment ? "Paid" : "Unpaid";
  }
  return "—";
}

type ClubReconciliationProps = {
  totalPotPence: number;
  rows: ReconciliationRow[];
};

export function ClubReconciliation({
  totalPotPence,
  rows,
}: ClubReconciliationProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Member payments (current open cycle)</h2>
      <p className="text-sm">
        Total pot:{" "}
        <span className="font-mono">{totalPotPence.toString()}</span> pence
      </p>
      <div className="overflow-x-auto rounded border border-neutral-300 dark:border-neutral-600">
        <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-300 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900">
              <th className="px-3 py-2 font-medium">Display name</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.membershipId}
                className="border-b border-neutral-200 last:border-0 dark:border-neutral-700"
              >
                <td className="px-3 py-2">{r.displayName ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{r.role}</td>
                <td className="px-3 py-2 font-medium">
                  {cyclePaymentLabel(r)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
