import { createClient } from "@/lib/supabase/server";

type ClubAuditLogProps = {
  clubId: string;
};

export async function ClubAuditLog({ clubId }: ClubAuditLogProps) {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("audit_events")
    .select("id, created_at, action, entity_type, entity_id, metadata")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Could not load audit log: {error.message}
      </p>
    );
  }

  const list = rows ?? [];

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-medium">Audit log</h2>
      <p className="text-xs text-neutral-600 dark:text-neutral-400">
        Recent actions for this club (newest first).
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          No audit events yet.
        </p>
      ) : (
        <div className="overflow-x-auto border border-neutral-300 dark:border-neutral-600">
          <table className="w-full min-w-[40rem] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-300 dark:border-neutral-600">
                <th className="p-2 font-medium">When (UTC)</th>
                <th className="p-2 font-medium">Action</th>
                <th className="p-2 font-medium">Entity</th>
                <th className="p-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const meta = r.metadata as Record<string, unknown> | null;
                const actor =
                  typeof meta?.actor_display_name === "string"
                    ? meta.actor_display_name
                    : null;
                const summary = summarizeMetadata(meta);
                return (
                  <tr
                    key={r.id}
                    className="border-b border-neutral-200 dark:border-neutral-700"
                  >
                    <td className="p-2 font-mono whitespace-nowrap">
                      {new Date(r.created_at).toISOString()}
                    </td>
                    <td className="p-2 font-mono">{r.action}</td>
                    <td className="p-2 font-mono">
                      {r.entity_type}
                      {r.entity_id ? (
                        <span className="text-neutral-500">
                          {" "}
                          {String(r.entity_id).slice(0, 8)}…
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2 text-neutral-700 dark:text-neutral-300">
                      {actor ? (
                        <span className="mr-2 font-medium">By {actor}.</span>
                      ) : null}
                      {summary}
                    </td>
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

function summarizeMetadata(meta: Record<string, unknown> | null): string {
  if (!meta || typeof meta !== "object") return "—";
  const parts: string[] = [];
  const pick = (k: string) => {
    const v = meta[k];
    if (v !== undefined && v !== null && k !== "actor_display_name") {
      parts.push(`${k}: ${String(v)}`);
    }
  };
  [
    "draw_cycle_id",
    "cycle_number",
    "cycle_name",
    "eligible_count",
    "total_pot_pence",
    "entry_count",
    "club_share_pence",
    "winner_share_pence",
    "platform_fee_pence",
    "winner_display_name",
    "membership_id",
    "target_display_name",
    "previous_status",
  ].forEach(pick);
  return parts.length ? parts.join(" · ") : "—";
}
