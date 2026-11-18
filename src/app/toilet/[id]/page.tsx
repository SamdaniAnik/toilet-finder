import type { Metadata } from "next";
import { Suspense } from "react";
import ToiletDetailView from "@/components/toilet/ToiletDetailView";

export const metadata: Metadata = { title: "Toilet · Toilet Finder" };

async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ToiletDetailView id={id} />;
}

export default function ToiletPage({ params }: PageProps<"/toilet/[id]">) {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center text-2xl text-zinc-400" aria-busy="true">…</div>}>
      <Detail params={params} />
    </Suspense>
  );
}
