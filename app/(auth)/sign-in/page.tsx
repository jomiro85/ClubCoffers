import Link from "next/link";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { SignInForm } from "./sign-in-form";

type SignInPageProps = {
  searchParams: Promise<{ redirect?: string | string[] }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.redirect) ? sp.redirect[0] : sp.redirect;
  const safeRedirect = getSafeRedirectPath(raw);

  const signUpHref = safeRedirect
    ? `/sign-up?redirect=${encodeURIComponent(safeRedirect)}`
    : "/sign-up";

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Sign in to Coffers.
        </p>
      </div>
      <SignInForm redirectPath={safeRedirect ?? undefined} />
      <p className="text-sm">
        Need an account?{" "}
        <Link href={signUpHref} className="underline">
          Sign up
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
