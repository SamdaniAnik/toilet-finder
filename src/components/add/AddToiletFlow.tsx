"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LatLng } from "@/lib/geo";
import ToiletForm, { type Duplicate } from "./ToiletForm";

// Leaflet needs `window`.
const LocationPicker = dynamic(() => import("./LocationPicker"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-zinc-500">Loading map…</div>,
});

export default function AddToiletFlow() {
  const router = useRouter();
  const [point, setPoint] = useState<LatLng | null>(null);
  const [step, setStep] = useState<"pick" | "details">("pick");
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);

  const confirmLocation = async (p: LatLng) => {
    setPoint(p);
    setStep("details");
    setDuplicates([]);
    try {
      const res = await fetch(`/api/toilets/duplicates?lat=${p.lat}&lng=${p.lng}`);
      if (res.ok) setDuplicates(((await res.json()) as { duplicates: Duplicate[] }).duplicates);
    } catch {
      // Non-critical: the form still works without the duplicate warning.
    }
  };

  if (step === "pick" || !point) {
    return (
      <div className="h-dvh w-full">
        <LocationPicker initial={point} onConfirm={confirmLocation} onCancel={() => router.push("/")} />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-900">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-zinc-200 bg-white px-4 py-3">
        <button type="button" onClick={() => setStep("pick")} className="text-xl text-zinc-600" aria-label="Back">
          ←
        </button>
        <h1 className="text-lg font-semibold">Add a toilet</h1>
      </header>
      <ToiletForm
        point={point}
        duplicates={duplicates}
        onChangeLocation={() => setStep("pick")}
        onCreated={(id) => router.push(`/?toilet=${id}&lat=${point.lat}&lng=${point.lng}`)}
      />
    </div>
  );
}
