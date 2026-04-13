import { signOut } from "@/lib/auth/actions";
import Link from "next/link";

export function AppNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/98 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/dashboard"
          className="text-base font-semibold tracking-tight text-[#0c1526] transition-colors hover:text-[#0f2444]"
        >
          Coffers
        </Link>
        <div className="flex items-center gap-5">
          <Link
            href="/profile"
            className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            Profile
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
