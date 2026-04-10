"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type CreateClubState = {
  error: string | null;
};

const initialState: CreateClubState = { error: null };

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function createClub(
  _prevState: CreateClubState,
  formData: FormData
): Promise<CreateClubState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to create a club." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const feeRaw = String(formData.get("monthly_fee_pence") ?? "").trim();

  if (!name || !slug || !feeRaw) {
    return { ...initialState, error: "All fields are required." };
  }

  if (name.length < 1 || name.length > 200) {
    return { ...initialState, error: "Club name must be between 1 and 200 characters." };
  }

  if (slug.length > 100 || !SLUG_REGEX.test(slug)) {
    return {
      ...initialState,
      error:
        "Slug must use lowercase letters, numbers, and hyphens only (e.g. my-club).",
    };
  }

  const monthlyFeePence = Number.parseInt(feeRaw, 10);
  if (!Number.isFinite(monthlyFeePence) || monthlyFeePence <= 0) {
    return {
      ...initialState,
      error: "Monthly fee must be a positive whole number (pence).",
    };
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .insert({
      name,
      slug,
      monthly_fee_pence: monthlyFeePence,
    })
    .select("id")
    .single();

  if (clubError) {
    if (clubError.code === "23505") {
      return { ...initialState, error: "That slug is already taken. Choose another." };
    }
    return { ...initialState, error: clubError.message };
  }

  if (!club) {
    return { ...initialState, error: "Could not create club." };
  }

  const { error: memberError } = await supabase.from("memberships").insert({
    club_id: club.id,
    user_id: user.id,
    role: "owner",
    status: "active",
  });

  if (memberError) {
    await supabase.from("clubs").delete().eq("id", club.id);
    return { ...initialState, error: memberError.message };
  }

  redirect(`/club/${club.id}`);
}
