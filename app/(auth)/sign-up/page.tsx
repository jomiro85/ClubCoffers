import Link from "next/link";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { SignUpForm } from "./sign-up-form";

type SignUpPageProps = {
  searchParams: Promise<{ redirect?: string | string[] }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.redirect) ? sp.redirect[0] : sp.redirect;
  const safeRedirect = getSafeRedirectPath(raw);

  const signInHref = safeRedirect
    ? `/sign-in?redirect=${encodeURIComponent(safeRedirect)}`
    : "/sign-in";

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Sign up</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Create a Coffers account.
        </p>
      </div>
      <SignUpForm redirectPath={safeRedirect ?? undefined} />
      <p className="text-sm">
        Already have an account?{" "}
        <Link href={signInHref} className="underline">
          Sign in
        </Link>
      </p>
      <p className="text-sm">
        <Link href="/" className="underline">
          Home
        </Link>
      </p>
    </main>
  );
}
