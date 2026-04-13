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
      <div className="min-h-screen bg-[#f7f9fc]">
        <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-10 shadow-sm">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-500">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-[#0c1526]">
              Invalid invite link
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              This link doesn&apos;t match any club. It may have expired or been
              copied incorrectly.
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Ask your club owner to share the link again from their club page.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex text-sm font-medium text-[#0f2444] underline underline-offset-2"
            >
              ← Go to your clubs
            </Link>
          </div>
        </div>
      </div>
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

  const alreadyMember    = Boolean(membership);
  const membershipStatus = membership?.status ?? null;

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Invitation
        </div>
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-[#0c1526]">
          {club.name}
        </h1>
        <JoinClubPanel
          clubId={club.id}
          clubName={club.name}
          inviteToken={token}
          alreadyMember={alreadyMember}
          membershipStatus={membershipStatus}
        />
        <p className="mt-8 text-xs text-slate-400">
          Wrong club?{" "}
          <Link
            href="/dashboard"
            className="font-medium text-slate-600 underline underline-offset-2"
          >
            Go to your clubs
          </Link>
        </p>
      </div>
    </div>
  );
}
