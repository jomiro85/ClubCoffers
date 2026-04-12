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

  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            Coffers
          </span>
          <nav className="flex items-center gap-2">
            <Link
              href="/sign-in"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-24 text-center">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-medium text-slate-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Simple. Fair. Transparent.
        </div>
        <h1 className="text-5xl font-bold leading-tight tracking-tight text-slate-900 sm:text-6xl">
          Your savings club,
          <br />
          <span className="text-slate-400">finally organised.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
          Collect monthly fees, run a fair draw, and split the pot — no
          spreadsheets, no disputes, no confusion.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="w-full rounded-xl bg-slate-900 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-slate-800 sm:w-auto"
          >
            Create your club
          </Link>
          <Link
            href="/sign-in"
            className="w-full rounded-xl border border-slate-200 px-8 py-3.5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-5 text-sm text-slate-500">
          Have an invite link?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-slate-700 underline underline-offset-2"
          >
            Sign in to join your club
          </Link>
        </p>
      </section>

      {/* ── How it works ── */}
      <section className="border-y border-slate-100 bg-slate-50 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              How it works
            </h2>
            <p className="mt-3 text-base text-slate-500">
              From first invite to draw day in three steps.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                1
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-900">
                Set up your club
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Create an account, name your club, and set a monthly fee. Share
                the invite link — members request to join and you approve them.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                2
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-900">
                Collect fees each cycle
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Open a draw cycle, mark who has paid, and watch the pot grow.
                Only active, paid members who joined before the period are
                eligible.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-sm font-bold text-white">
                3
              </div>
              <h3 className="mb-2 text-base font-semibold text-slate-900">
                Run the draw
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Close the cycle and run a random draw. The winner and the club
                each receive their share, with a full audit trail for everyone
                to see.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust ── */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              Built for trust
            </h2>
            <p className="mt-3 text-base text-slate-500">
              Every decision is recorded. Nothing is hidden.
            </p>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            <div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-base">
                🔒
              </div>
              <h3 className="mb-1.5 font-semibold text-slate-900">
                Full audit trail
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Every payment, approval, and draw result is logged and visible
                to the club. Nothing happens in the dark.
              </p>
            </div>
            <div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-base">
                🎲
              </div>
              <h3 className="mb-1.5 font-semibold text-slate-900">
                Fair random draw
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                The draw picks one winner at random from eligible, paid members
                only. No manipulation, no favouritism.
              </p>
            </div>
            <div>
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-base">
                📊
              </div>
              <h3 className="mb-1.5 font-semibold text-slate-900">
                No spreadsheets
              </h3>
              <p className="text-sm leading-relaxed text-slate-500">
                Member approvals, payment tracking, and cycle history live in
                one place. Always accurate, always up to date.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="bg-slate-900 py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Ready to organise your club?
          </h2>
          <p className="mt-4 text-base text-slate-400">
            Set up in minutes. No card required.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="w-full rounded-xl bg-white px-8 py-3.5 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-100 sm:w-auto"
            >
              Create your club
            </Link>
            <Link
              href="/sign-in"
              className="w-full rounded-xl border border-slate-700 px-8 py-3.5 text-base font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:text-white sm:w-auto"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 py-10">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <span className="text-sm font-semibold text-slate-900">Coffers</span>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <Link
              href="/sign-up"
              className="transition-colors hover:text-slate-900"
            >
              Sign up
            </Link>
            <Link
              href="/sign-in"
              className="transition-colors hover:text-slate-900"
            >
              Sign in
            </Link>
          </div>
          <p className="text-sm text-slate-400">© {year} Coffers</p>
        </div>
      </footer>
    </div>
  );
}
