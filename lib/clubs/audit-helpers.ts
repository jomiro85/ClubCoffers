import type { SupabaseClient } from "@supabase/supabase-js";

export async function getActorDisplayName(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name ?? null;
}

export async function insertClubAuditEvent(
  supabase: SupabaseClient,
  params: {
    actorUserId: string;
    actorDisplayName: string | null;
    clubId: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, unknown>;
  }
) {
  const metadata = {
    ...params.metadata,
    club_id: params.clubId,
    actor_user_id: params.actorUserId,
    actor_display_name: params.actorDisplayName,
  };
  await supabase.from("audit_events").insert({
    actor_user_id: params.actorUserId,
    club_id: params.clubId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata,
  });
}
