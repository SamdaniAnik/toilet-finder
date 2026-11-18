"use client";

import { useState, type ReactNode } from "react";
import { errorText } from "@/components/ui/useCaptchaSubmit";
import { useT } from "@/i18n/LanguageProvider";
import { readJson } from "@/lib/client/http";
import { apiFetch } from "@/lib/client/visitor";
import type { Gender, ToiletDetail } from "@/types/toilet";

const GENDERS: Gender[] = ["male", "female", "separate", "unisex", "accessible"];

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-xl border-2 px-3 py-2 text-sm font-medium ${on ? "border-blue-600 bg-blue-50 text-blue-900" : "border-zinc-200 bg-white text-zinc-700"}`}
    >
      {children}
    </button>
  );
}

/** Lets the person who added a toilet correct its details (same device only). */
export default function EditToilet({ toilet, onDone, onCancel }: { toilet: ToiletDetail; onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const [name, setName] = useState(toilet.name);
  const [gender, setGender] = useState<Gender>(toilet.gender);
  const [isPaid, setIsPaid] = useState(toilet.isPaid);
  const [price, setPrice] = useState(toilet.priceBdt != null ? String(toilet.priceBdt) : "");
  const [hasWater, setHasWater] = useState(Boolean(toilet.hasWater));
  const [hasSoap, setHasSoap] = useState(Boolean(toilet.hasSoap));
  const [babyChanging, setBabyChanging] = useState(Boolean(toilet.babyChanging));
  const [description, setDescription] = useState(toilet.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid = name.trim().length < 2 || (isPaid && price !== "" && !(Number(price) >= 0));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/toilets/${toilet.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          gender,
          isPaid,
          priceBdt: isPaid && price !== "" ? Number(price) : null,
          hasWater,
          hasSoap,
          babyChanging,
          description: description.trim() || undefined,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(data.error ?? t.common.somethingWrong);
      onDone();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-4 rounded-2xl border border-zinc-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div>
        <h3 className="font-semibold">{t.edit.title}</h3>
        <p className="text-xs text-zinc-500">{t.edit.hint}</p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-semibold">{t.add.nameLabel}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-blue-600"
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">{t.add.whoFor}</legend>
        <div className="flex flex-wrap gap-2">
          {GENDERS.map((g) => (
            <Toggle key={g} on={gender === g} onClick={() => setGender(g)}>
              {t.gender[g]}
            </Toggle>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">{t.add.cost}</legend>
        <div className="flex flex-wrap items-center gap-2">
          <Toggle on={!isPaid} onClick={() => setIsPaid(false)}>
            {t.add.free}
          </Toggle>
          <Toggle on={isPaid} onClick={() => setIsPaid(true)}>
            {t.add.paid}
          </Toggle>
          {isPaid && (
            <span className="flex items-center rounded-xl border border-zinc-300 px-3 focus-within:border-blue-600">
              ৳
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={10000}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-label={t.add.priceLabel}
                className="w-20 px-2 py-2 text-base outline-none"
              />
            </span>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">{t.add.facilities}</legend>
        <div className="flex flex-wrap gap-2">
          <Toggle on={hasWater} onClick={() => setHasWater((v) => !v)}>
            {t.add.water}
          </Toggle>
          <Toggle on={hasSoap} onClick={() => setHasSoap((v) => !v)}>
            {t.add.soap}
          </Toggle>
          <Toggle on={babyChanging} onClick={() => setBabyChanging((v) => !v)}>
            {t.add.babyChanging}
          </Toggle>
        </div>
      </fieldset>

      <label className="block space-y-1">
        <span className="text-sm font-semibold">{t.add.notes}</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder={t.add.notesPlaceholder}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-blue-600"
        />
      </label>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl border border-zinc-300 py-3 font-medium">
          {t.common.cancel}
        </button>
        <button type="submit" disabled={busy || invalid} className="rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:bg-zinc-400">
          {busy ? t.add.saving : t.edit.save}
        </button>
      </div>
    </form>
  );
}
