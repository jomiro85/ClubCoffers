import { AppNav } from "@/components/app-nav";

export default function ClubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <AppNav />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </div>
    </div>
  );
}
