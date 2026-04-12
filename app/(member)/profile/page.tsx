import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const displayName = profile?.display_name ?? null;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 py-8 sm:py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Profile</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Update your display name. This is shown to other club members.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">Your details</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Signed in as{" "}
            <span className="font-medium text-slate-700">{user.email}</span>
          </p>
        </div>
        <div className="px-6 py-5">
          <ProfileForm currentDisplayName={displayName} />
        </div>
      </section>
    </main>
  );
}
