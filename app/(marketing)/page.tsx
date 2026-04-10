import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: memberships } = await supabase
      .from("memberships")
      .select("club_id")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true });

    const rows = memberships ?? [];
    const n = rows.length;

    if (n === 0) {
      redirect("/create-club");
    }
    if (n === 1) {
      redirect(`/club/${rows[0].club_id}`);
    }
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-10 px-4 py-12">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Coffers</h1>
        <p className="text-neutral-700 dark:text-neutral-300">
          Collect member fees, run fair draws, and split the pot between your
          club, a winner, and the platform—without spreadsheets.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Running a club
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Create an account, set up your club, invite members, then open draw
            cycles and run the draw when you&apos;re ready.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Joining a club
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Sign in with an invite link from your club admin. You&apos;ll appear
            as pending until they approve you.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/sign-up"
          className="rounded-lg bg-neutral-900 px-4 py-3 text-center text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
        >
          Create your club
        </Link>
        <Link
          href="/sign-in"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-center text-sm font-medium text-neutral-900 dark:border-neutral-600 dark:text-neutral-100"
        >
          Join your club
        </Link>
      </div>

      <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
        <Link href="/sign-up" className="underline">
          Sign up
        </Link>
        {" · "}
        <Link href="/sign-in" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
