import { AppNav } from "@/components/app-nav";

export default function ClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {children}
      </div>
    </div>
  );
}
