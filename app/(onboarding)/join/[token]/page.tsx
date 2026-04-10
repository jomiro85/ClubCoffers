import { createClient } from "@/lib/supabase/server";
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
      <main className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">Invalid invite link</h1>
        <p className="text-neutral-700 dark:text-neutral-300">
          This invite link is not valid. Ask your club admin for a new link.
        </p>
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
    .select("id")
    .eq("club_id", club.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const alreadyMember = Boolean(membership);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Join club</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Accept an invitation to join a Coffers club.
        </p>
      </div>
      <JoinClubPanel
        clubName={club.name}
        inviteToken={token}
        alreadyMember={alreadyMember}
      />
    </main>
  );
}
