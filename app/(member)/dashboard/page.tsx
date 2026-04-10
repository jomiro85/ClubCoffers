import { MembershipStatusBadge } from "@/components/status-badges";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

type ClubEmbed = { id: string; name: string };

function clubFromRow(clubs: ClubEmbed | ClubEmbed[] | null): ClubEmbed | null {
  if (!clubs) return null;
  return Array.isArray(clubs) ? clubs[0] ?? null : clubs;
}

function roleLabel(role: string): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

function roleDescription(role: string): string {
  if (role === "owner") return "You run this club.";
  if (role === "admin") return "You can manage members and cycles.";
  return "You're a member of this club.";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: membershipRows, error } = await supabase
    .from("memberships")
    .select(
      `
      id,
      role,
      status,
      clubs (
        id,
        name
      )
    `
    )
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-4 py-8">
        <h1 className="text-2xl font-semibold">Your clubs</h1>
        <p className="text-red-600" role="alert">
          Could not load your clubs: {error.message}
        </p>
      </main>
    );
  }

  const rows = membershipRows ?? [];

  if (rows.length === 0) {
    return (
      <main className="mx-auto flex max-w-xl flex-col gap-8 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your clubs</h1>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            You&apos;re not part of any club yet. Create one or join with an
            invite link from a club owner.
          </p>
        </div>

        <div className="flex flex-col gap-px overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-700">
          <div className="flex flex-col gap-3 bg-white p-6 dark:bg-neutral-950">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-xl dark:bg-neutral-800">
              🏦
            </div>
            <div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                Create a club
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Become the owner, invite members, open draw cycles, and run the
                draw when you&apos;re ready.
              </p>
            </div>
            <Link
              href="/create-club"
              className="w-fit rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            >
              Create a club
            </Link>
          </div>

          <div className="flex flex-col gap-3 bg-white p-6 dark:bg-neutral-950">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-xl dark:bg-neutral-800">
              🔗
            </div>
            <div>
              <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                Join a club
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Ask your club owner for an invite link. Open it while signed in
                and request membership — you&apos;ll be active once they approve
                you.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const activeCount = rows.filter((r) => r.status === "active").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Your clubs
        </h1>
        <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
          {rows.length === 1
            ? "You belong to 1 club."
            : `You belong to ${rows.length} clubs.`}
          {pendingCount > 0
            ? ` ${pendingCount} ${pendingCount === 1 ? "membership is" : "memberships are"} pending approval.`
            : ""}
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const club = clubFromRow(
            row.clubs as ClubEmbed | ClubEmbed[] | null
          );
          const clubId = club?.id ?? "";
          const name = club?.name ?? "Unknown club";
          const role = row.role as string;
          const status = row.status as string;
          const isPending = status === "pending";

          return (
            <li key={row.id}>
              <div
                className={`flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between ${
                  isPending
                    ? "border-amber-200 bg-amber-50/60 dark:border-amber-800/50 dark:bg-amber-950/20"
                    : "border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-950"
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      {name}
                    </span>
                    <MembershipStatusBadge status={status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600 dark:text-neutral-400">
                    <span>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {roleLabel(role)}
                      </span>
                      {" — "}
                      {roleDescription(role)}
                    </span>
                  </div>
                  {isPending ? (
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      Waiting for approval. You can&apos;t pay fees or enter
                      draws until an owner or admin activates you.
                    </p>
                  ) : null}
                </div>
                {clubId ? (
                  <Link
                    href={`/club/${clubId}`}
                    className="flex-shrink-0 self-start rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 sm:self-center dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Open club →
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {activeCount > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900/40">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            Want to start another club?
          </p>
          <p className="mt-0.5 text-sm text-neutral-600 dark:text-neutral-400">
            You can run multiple clubs independently.
          </p>
          <Link
            href="/create-club"
            className="mt-3 inline-flex text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-700 dark:text-neutral-100 dark:hover:text-neutral-300"
          >
            Create another club →
          </Link>
        </div>
      )}
    </main>
  );
}
