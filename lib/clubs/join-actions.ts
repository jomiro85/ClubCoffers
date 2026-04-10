"use server";

import { createClient } from "@/lib/supabase/server";

export type JoinClubActionState = {
  error: string | null;
  success?: boolean;
};

const initialState: JoinClubActionState = { error: null };

export async function joinClubByInvite(
  _prevState: JoinClubActionState,
  formData: FormData
): Promise<JoinClubActionState> {
  const inviteToken = String(formData.get("invite_token") ?? "").trim();
  if (!inviteToken) {
    return { ...initialState, error: "Missing invite token." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ...initialState, error: "You must be signed in to join." };
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id")
    .eq("invite_token", inviteToken)
    .maybeSingle();

  if (clubError || !club) {
    return { ...initialState, error: "Invalid or expired invite link." };
  }

  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return {
      ...initialState,
      error: "You are already a member of this club.",
    };
  }

  const joinedAt = new Date().toISOString();

  const { error: insertError } = await supabase.from("memberships").insert({
    club_id: club.id,
    user_id: user.id,
    role: "member",
    status: "pending",
    joined_at: joinedAt,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        ...initialState,
        error: "You are already a member of this club.",
      };
    }
    return { ...initialState, error: insertError.message };
  }

  return { error: null, success: true };
}
