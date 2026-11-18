"use client";

import dynamic from "next/dynamic";

// The admin app reads the saved session from localStorage, so render it only in the browser.
const AdminApp = dynamic(() => import("./AdminApp"), {
  ssr: false,
  loading: () => <p className="p-6 text-zinc-500">Loading…</p>,
});

export default function AdminLoader() {
  return <AdminApp />;
}
