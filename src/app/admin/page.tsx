import type { Metadata } from "next";
import AdminLoader from "@/components/admin/AdminLoader";

export const metadata: Metadata = {
  title: "Admin · Toilet Finder",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main className="min-h-dvh bg-white text-zinc-900">
      <AdminLoader />
    </main>
  );
}
