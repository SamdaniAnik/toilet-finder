"use client";

import { useState, type ReactNode } from "react";
import Turnstile from "@/components/Turnstile";
import NameField from "@/components/ui/NameField";
import { PhotoPicker, usePhotos } from "@/components/ui/PhotoPicker";
import { readJson } from "@/lib/client/http";
import { apiFetch, getSavedName, saveName } from "@/lib/client/visitor";
import type { LatLng } from "@/lib/geo";
import type { Gender } from "@/types/toilet";

const MAX_PHOTOS = 5;

const GENDERS: { value: Gender; label: string; bn: string; icon: string }[] = [
  { value: "male", label: "Male", bn: "পুরুষ", icon: "🚹" },
  { value: "female", label: "Female", bn: "মহিলা", icon: "🚺" },
  { value: "separate", label: "Male & Female", bn: "আলাদা", icon: "🚻" },
  { value: "unisex", label: "Unisex", bn: "সবার জন্য", icon: "🚽" },
  { value: "accessible", label: "Accessible", bn: "প্রতিবন্ধী", icon: "♿" },
];

export type Duplicate = { id: string; name: string; distanceM: number };

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-zinc-900">
        {title} {hint && <span className="font-normal text-zinc-500">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Choice({
  selected,
  onClick,
  children,
  tone = "blue",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "blue" | "green" | "red";
}) {
  const on = { blue: "border-blue-600 bg-blue-50 text-blue-900", green: "border-green-600 bg-green-50 text-green-900", red: "border-red-600 bg-red-50 text-red-900" }[tone];
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition ${selected ? on : "border-zinc-200 bg-white text-zinc-700"}`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------
export default function ToiletForm({
  point,
  duplicates,
  onChangeLocation,
  onCreated,
}: {
  point: LatLng;
  duplicates: Duplicate[];
  onChangeLocation: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [isPaid, setIsPaid] = useState<boolean | null>(null);
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<"open" | "closed" | null>(null);
  const [hasWater, setHasWater] = useState(false);
  const [hasSoap, setHasSoap] = useState(false);
  const [babyChanging, setBabyChanging] = useState(false);
  const [description, setDescription] = useState("");
  const [authorName, setAuthorName] = useState(getSavedName);
  const photoState = usePhotos(MAX_PHOTOS);
  const { photos, processing } = photoState;
  const [token, setToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dupDismissed, setDupDismissed] = useState(false);

  const missing = (() => {
    if (name.trim().length < 2) return "Enter a name or landmark";
    if (!gender) return "Choose who it's for";
    if (isPaid === null) return "Choose free or paid";
    if (isPaid && price !== "" && !(Number(price) >= 0)) return "Enter a valid price";
    if (!status) return "Choose open or closed";
    if (photos.length === 0) return "Add at least one photo";
    if (!token) return "Complete the captcha";
    return null;
  })();

  const submitting = progress !== null;

  const submit = async () => {
    if (missing || submitting) return;
    setError(null);
    try {
      // Upload photos (skips ones already uploaded on a previous attempt).
      const paths = await photoState.uploadAll(setProgress);

      setProgress("Saving…");
      const res = await apiFetch("/api/toilets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          lat: point.lat,
          lng: point.lng,
          gender,
          isPaid,
          priceBdt: isPaid && price !== "" ? Number(price) : null,
          status,
          hasWater: hasWater || undefined,
          hasSoap: hasSoap || undefined,
          babyChanging: babyChanging || undefined,
          description: description.trim() || undefined,
          authorName: authorName.trim() || undefined,
          photoPaths: paths,
          turnstileToken: token,
        }),
      });
      const data = await readJson<{ id?: string }>(res);
      if (!res.ok || !data.id) throw new Error(data.error ?? "Something went wrong");

      saveName(authorName);
      onCreated(data.id);
    } catch (err) {
      setError((err as Error).message);
      setProgress(null);
      setCaptchaReset((n) => n + 1); // captcha tokens are single-use
    }
  };

  const showDup = duplicates.length > 0 && !dupDismissed;

  return (
    <form
      className="mx-auto w-full max-w-xl space-y-6 px-4 pb-32 pt-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {/* Location summary */}
      <div className="flex items-center justify-between rounded-xl bg-zinc-100 px-4 py-3 text-sm">
        <span className="text-zinc-700">
          📍 {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
        </span>
        <button type="button" onClick={onChangeLocation} className="font-medium text-blue-700">
          Change
        </button>
      </div>

      {showDup && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <p className="font-semibold">A toilet is already listed here:</p>
          <ul className="my-2 list-disc pl-5">
            {duplicates.map((d) => (
              <li key={d.id}>
                <a className="underline" href={`/?toilet=${d.id}&lat=${point.lat}&lng=${point.lng}`}>
                  {d.name}
                </a>{" "}
                ({d.distanceM} m away)
              </li>
            ))}
          </ul>
          <p>If it&apos;s the same one, open it and add your photo there instead.</p>
          <button type="button" onClick={() => setDupDismissed(true)} className="mt-2 font-medium underline">
            No, this is a different toilet
          </button>
        </div>
      )}

      <Section title="Name or landmark">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="e.g. Kamalapur Station, Platform 1"
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-blue-600"
        />
      </Section>

      <Section title="Who is it for?">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GENDERS.map((g) => (
            <Choice key={g.value} selected={gender === g.value} onClick={() => setGender(g.value)}>
              <span className="mr-1">{g.icon}</span>
              {g.label}
              <span className="block text-xs font-normal opacity-70">{g.bn}</span>
            </Choice>
          ))}
        </div>
      </Section>

      <Section title="Cost">
        <div className="grid grid-cols-2 gap-2">
          <Choice selected={isPaid === false} onClick={() => setIsPaid(false)} tone="green">
            Free · ফ্রি
          </Choice>
          <Choice selected={isPaid === true} onClick={() => setIsPaid(true)}>
            ৳ Paid · টাকা লাগে
          </Choice>
        </div>
        {isPaid && (
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            Price
            <span className="flex items-center rounded-xl border border-zinc-300 px-3 focus-within:border-blue-600">
              ৳
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={10000}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="10"
                className="w-24 px-2 py-2.5 text-base outline-none"
              />
            </span>
            <span className="text-zinc-500">(optional)</span>
          </label>
        )}
      </Section>

      <Section title="Is it open now?">
        <div className="grid grid-cols-2 gap-2">
          <Choice selected={status === "open"} onClick={() => setStatus("open")} tone="green">
            🟢 Open
          </Choice>
          <Choice selected={status === "closed"} onClick={() => setStatus("closed")} tone="red">
            🔴 Closed
          </Choice>
        </div>
      </Section>

      <Section title="Photos" hint={`(1–${MAX_PHOTOS})`}>
        <PhotoPicker state={photoState} disabled={submitting} />
      </Section>

      <Section title="Facilities" hint="(optional)">
        <div className="flex flex-wrap gap-2">
          <Choice selected={hasWater} onClick={() => setHasWater((v) => !v)}>
            💧 Water
          </Choice>
          <Choice selected={hasSoap} onClick={() => setHasSoap((v) => !v)}>
            🧼 Soap
          </Choice>
          <Choice selected={babyChanging} onClick={() => setBabyChanging((v) => !v)}>
            👶 Baby changing
          </Choice>
        </div>
      </Section>

      <Section title="Notes" hint="(optional)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. Ask the guard for the key. Behind the ticket counter."
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-blue-600"
        />
      </Section>

      <NameField value={authorName} onChange={setAuthorName} />

      <Turnstile onToken={setToken} resetKey={captchaReset} />

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* Sticky submit */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-zinc-200 bg-white/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-xl">
          <button
            type="submit"
            disabled={!!missing || submitting || processing}
            className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-semibold text-white disabled:bg-zinc-400"
          >
            {progress ?? "Add toilet"}
          </button>
          {missing && !submitting && <p className="mt-1.5 text-center text-xs text-zinc-500">{missing}</p>}
        </div>
      </div>
    </form>
  );
}
