import { AppNav } from "@/components/app-nav";

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav />
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {children}
      </div>
    </div>
  );
}
