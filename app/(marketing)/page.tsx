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
    <div className="min-h-screen">

      {/* ═══════════════════════════════════════════════════════════════════
          DARK HERO BLOCK — nav + hero share the same navy background
          ═══════════════════════════════════════════════════════════════ */}
      <div className="bg-[#091929]">

        {/* ── Nav (dark) ────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-[#091929]/95 backdrop-blur-md border-b border-white/8">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <span className="text-lg font-semibold tracking-tight text-white">
              Coffers
            </span>
            <nav className="flex items-center gap-1">
              <Link
                href="/sign-in"
                className="px-4 py-2 text-sm font-medium text-blue-200/70 transition-colors hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#0f2444] transition-colors hover:bg-blue-50"
              >
                Start your club
              </Link>
            </nav>
          </div>
        </header>

        {/* ── Hero ────────────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-6 pb-28 pt-16 sm:pt-24">
          <div className="max-w-[42rem]">
            {/* Headline */}
            <h1 className="text-[clamp(3rem,8vw,5.75rem)] font-bold leading-[1.03] tracking-tight">
              <span className="text-white">Club Coffers</span>
              <span className="text-[#be3535]">.</span>
              <br />
              <span className="text-[#6a9abf]">Done right.</span>
            </h1>

            {/* Red accent bar — visual beat between headline and copy */}
            <div className="mt-7 h-[3px] w-12 rounded-full bg-[#be3535]" />

            {/* Supporting copy */}
            <p className="mt-6 max-w-md text-lg leading-relaxed text-blue-100/75">
              Members contribute monthly. You run the draw. The club gets
              funded — automatically.
            </p>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap gap-3">
              <Link
                href="/sign-up"
                className="rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-[#0f2444] transition-colors hover:bg-blue-50"
              >
                Start your club
              </Link>
              <Link
                href="/sign-in"
                className="rounded-xl border border-white/15 px-7 py-3.5 text-base font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white"
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>

      </div>{/* end dark hero block */}

      {/* ── How it works — white ─────────────────────────────────────────── */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0c1526]">
              From first invite to draw day.
            </h2>
          </div>
          <div className="grid gap-12 sm:grid-cols-3">
            {[
              {
                n: "01",
                title: "Set up your club",
                body: "Create an account, set a monthly fee, and share your invite link. Approve members as they join — you decide who&apos;s in.",
              },
              {
                n: "02",
                title: "Collect fees each month",
                body: "Open a draw cycle, mark who has paid, and watch the pot grow. Only active, paid members who joined before the cycle are eligible.",
              },
              {
                n: "03",
                title: "Run the draw",
                body: "Close the cycle and pick a winner at random from all eligible entries. The result is instant, recorded, and final.",
              },
            ].map((step) => (
              <div key={step.n} className="flex flex-col gap-5">
                <p className="text-5xl font-bold text-[#dce8f5]">{step.n}</p>
                <div>
                  <h3 className="text-lg font-semibold text-[#0c1526]">
                    {step.title}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed text-slate-500"
                    dangerouslySetInnerHTML={{ __html: step.body }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust — soft blue-grey ────────────────────────────────────────── */}
      <section className="bg-[#edf2f8] py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Why Coffers
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0c1526]">
              Fair by design.
            </h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            {[
              {
                title: "Full audit trail",
                body: "Every payment, approval, and draw result is logged and visible to the whole club. Nothing happens off the record.",
              },
              {
                title: "Verifiably random draw",
                body: "The draw picks one winner at random from eligible, paid members only. No manual selection, no override.",
              },
              {
                title: "No spreadsheets",
                body: "Member approvals, payment tracking, and cycle history live in one place. Always accurate, always accessible.",
              },
            ].map((item) => (
              <div key={item.title} className="flex flex-col gap-4">
                {/* Red bar accent on trust items */}
                <div className="h-[3px] w-8 rounded-full bg-[#be3535]" />
                <h3 className="text-base font-semibold text-[#0c1526]">
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA — deep navy ──────────────────────────────────────────────── */}
      <section className="bg-[#0f2444]">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="text-4xl font-bold tracking-tight text-white">
            Ready to run your club properly?
          </h2>
          <p className="mt-5 text-base text-blue-200/60">
            No card required. Set up in minutes.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-[#0f2444] transition-colors hover:bg-blue-50"
            >
              Start your club
            </Link>
            <Link
              href="/sign-in"
              className="rounded-xl border border-white/15 px-7 py-3.5 text-base font-semibold text-white/75 transition-colors hover:border-white/30 hover:text-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer — white ───────────────────────────────────────────────── */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <span className="text-sm font-semibold text-[#0c1526]">
              Coffers
            </span>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/sign-up" className="transition-colors hover:text-slate-900">
                Sign up
              </Link>
              <Link href="/sign-in" className="transition-colors hover:text-slate-900">
                Sign in
              </Link>
            </div>
            <p className="text-sm text-slate-400">© {year} Coffers</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
