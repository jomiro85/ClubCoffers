import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * v1 default destination after sign-in / sign-up when no explicit redirect is used.
 * - First owner membership (by joined_at): /club/[clubId]
 * - Admins and members: /dashboard
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

  const ownerRow = rows.find((r) => r.role === "owner");
  if (ownerRow) {
    return `/club/${ownerRow.club_id}`;
  }

  return "/dashboard";
}
