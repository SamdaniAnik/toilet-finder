import type { Metadata } from "next";
import { Suspense } from "react";
import ToiletDetailView from "@/components/toilet/ToiletDetailView";
import { MESSAGES } from "@/i18n/messages";
import { getToiletMeta } from "@/lib/server/toiletMeta";

/** Link preview (WhatsApp, Facebook…): toilet name, type, price, rating and first photo. */
export async function generateMetadata({ params }: PageProps<"/toilet/[id]">): Promise<Metadata> {
  const { id } = await params;
  const meta = await getToiletMeta(id);
  if (!meta) return { title: "Toilet · Toilet Finder" };

  // Previews are read by bots without a language preference: show both languages.
  const en = MESSAGES.en;
  const bn = MESSAGES.bn;
  const rating = meta.reviewCount > 0 ? ` · ★ ${meta.avgRating.toFixed(1)} (${meta.reviewCount})` : "";
  const description =
    `${en.gender[meta.gender]} · ${en.price(meta.isPaid, meta.priceBdt)}${rating} — ` +
    `${bn.gender[meta.gender]} · ${bn.price(meta.isPaid, meta.priceBdt)}`;
  const title = `${meta.name} · Toilet Finder`;
  const image = meta.photoUrl ?? "/icons/icon-512.png";

  return {
    title,
    description,
    openGraph: { title: meta.name, description, type: "website", siteName: "Toilet Finder", images: [{ url: image }] },
    twitter: { card: meta.photoUrl ? "summary_large_image" : "summary", title: meta.name, description, images: [image] },
  };
}

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
