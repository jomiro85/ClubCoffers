import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreateClubForm } from "./create-club-form";

export default async function CreateClubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Create a club</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Set up your Coffers club.
        </p>
      </div>
      <CreateClubForm />
    </main>
  );
}
