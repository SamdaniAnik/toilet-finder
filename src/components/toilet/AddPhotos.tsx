"use client";

import { useState } from "react";
import Turnstile from "@/components/Turnstile";
import NameField from "@/components/ui/NameField";
import { PhotoPicker, usePhotos } from "@/components/ui/PhotoPicker";
import { postJson, useCaptchaSubmit } from "@/components/ui/useCaptchaSubmit";
import { useT } from "@/i18n/LanguageProvider";
import { getSavedName, saveName } from "@/lib/client/visitor";

/** "Add photos" panel on the detail page. */
export default function AddPhotos({ toiletId, onDone, onCancel }: { toiletId: string; onDone: () => void; onCancel: () => void }) {
  const t = useT();
  const photos = usePhotos(5);
  const [authorName, setAuthorName] = useState(getSavedName);
  const s = useCaptchaSubmit();

  const submit = async () => {
    const ok = await s.run(async (token, setProgress) => {
      const paths = await photos.uploadAll(setProgress);
      setProgress(t.add.saving);
      await postJson(`/api/toilets/${toiletId}/photos`, {
        photoPaths: paths,
        authorName: authorName.trim() || undefined,
        turnstileToken: token,
      });
    });
    if (ok) {
      saveName(authorName);
      photos.clear();
      onDone();
    }
  };

  return (
    <form
      className="space-y-4 rounded-2xl border border-zinc-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t.addPhotos.title}</h3>
        <button type="button" onClick={onCancel} className="text-sm text-zinc-500">
          {t.common.cancel}
        </button>
      </div>
      <PhotoPicker state={photos} disabled={s.busy} />
      <NameField value={authorName} onChange={setAuthorName} />
      <Turnstile onToken={s.setToken} resetKey={s.captchaReset} />
      {s.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{s.error}</p>}
      <button
        type="submit"
        disabled={photos.photos.length === 0 || photos.processing || !s.token || s.busy}
        className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:bg-zinc-400"
      >
        {s.progress ?? t.addPhotos.upload(photos.photos.length)}
      </button>
    </form>
  );
}
