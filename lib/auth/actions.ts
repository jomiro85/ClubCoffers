"use server";

import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthRedirect } from "@/lib/auth/post-auth-redirect";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { redirect } from "next/navigation";

export type AuthActionState = {
  error: string | null;
  message?: string | null;
};

const initialAuthState: AuthActionState = { error: null };

function getTrimmed(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getTrimmed(formData, "email");
  const password = String(formData.get("password") ?? "");
  const displayName = getTrimmed(formData, "display_name");

  if (!email || !password) {
    return { ...initialAuthState, error: "Email and password are required." };
  }

  if (displayName.length > 200) {
    return { ...initialAuthState, error: "Display name must be 200 characters or fewer." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    return { ...initialAuthState, error: error.message };
  }

  const user = data.user;
  if (!user) {
    return { ...initialAuthState, error: "Could not create user." };
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: displayName || null,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    return { ...initialAuthState, error: profileError.message };
  }

  if (data.session) {
    const next = getSafeRedirectPath(getTrimmed(formData, "redirect"));
    if (next) {
      redirect(next);
    }
    redirect(await resolvePostAuthRedirect(supabase, user.id));
  }

  return {
    error: null,
    message:
      "Account created. Check your email to confirm your address, then sign in.",
  };
}

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = getTrimmed(formData, "email");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ...initialAuthState, error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { ...initialAuthState, error: error.message };
  }

  const next = getSafeRedirectPath(getTrimmed(formData, "redirect"));
  if (next) {
    redirect(next);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in");
  }

  redirect(await resolvePostAuthRedirect(supabase, user.id));
}
