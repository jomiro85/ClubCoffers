import { signOut } from "@/lib/auth/actions";
import Link from "next/link";

export function AppNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-tight text-slate-900 transition-colors hover:text-slate-700"
        >
          Coffers
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/profile"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          >
            Profile
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
