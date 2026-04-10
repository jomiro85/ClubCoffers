import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * v1 default destination after sign-in / sign-up when no explicit redirect is used.
 * - First owner/admin membership (by joined_at): /club/[clubId]
 * - Any other membership: /dashboard
 * - No memberships: /create-club
 */
export async function resolvePostAuthRedirect(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: rows, error } = await supabase
    .from("memberships")
    .select("club_id, role")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });

  if (error) {
    return "/dashboard";
  }

  if (!rows?.length) {
    return "/create-club";
  }

  const manage = rows.find((r) => r.role === "owner" || r.role === "admin");
  if (manage) {
    return `/club/${manage.club_id}`;
  }

  return "/dashboard";
}
