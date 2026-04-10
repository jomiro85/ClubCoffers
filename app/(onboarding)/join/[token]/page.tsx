import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JoinClubPanel } from "./join-club-panel";

type JoinPageProps = {
  params: Promise<{ token: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { token } = await params;

  const supabase = await createClient();

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, invite_token")
    .eq("invite_token", token)
    .maybeSingle();

  if (clubError || !club) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 py-12">
        <div className="flex flex-col gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-900/30">
            ✕
          </div>
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Invalid invite link
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            This link doesn&apos;t match any club. It may have been reset or
            copied incorrectly.
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Ask your club owner to share the link again from their club page.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="w-fit text-sm font-medium text-neutral-700 underline underline-offset-2 dark:text-neutral-300"
        >
          ← Go to your clubs
        </Link>
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const returnTo = `/join/${token}`;
    redirect(`/sign-in?redirect=${encodeURIComponent(returnTo)}`);
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, status")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const alreadyMember = Boolean(membership);
  const membershipStatus = membership?.status ?? null;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 py-12">
      {/* Club identity */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          You&apos;ve been invited to
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          {club.name}
        </h1>
      </div>

      <JoinClubPanel
        clubId={club.id}
        clubName={club.name}
        inviteToken={token}
        alreadyMember={alreadyMember}
        membershipStatus={membershipStatus}
      />

      <p className="text-xs text-neutral-400 dark:text-neutral-500">
        Wrong link or club?{" "}
        <Link
          href="/dashboard"
          className="font-medium text-neutral-600 underline underline-offset-2 dark:text-neutral-300"
        >
          Go to your clubs
        </Link>
      </p>
    </main>
  );
}
