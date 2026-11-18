"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/LanguageProvider";
import { compressPhoto, uploadPhoto } from "@/lib/client/photos";

type Photo = { id: string; blob: Blob; url: string };

/** Photo selection state: compression on pick, previews, and upload-once on submit. */
export function usePhotos(max: number) {
  const t = useT();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Photo id → storage path, so a retry after an error doesn't re-upload.
  const uploaded = useRef(new Map<string, string>());

  // Free object URLs when the component goes away.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  const add = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setError(null);
      setProcessing(true);
      const room = max - photosRef.current.length;
      const added: Photo[] = [];
      try {
        for (const file of Array.from(files).slice(0, room)) {
          const blob = await compressPhoto(file);
          added.push({ id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob) });
        }
        if (files.length > room) setError(t.photo.tooMany(max));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPhotos((prev) => [...prev, ...added]);
        setProcessing(false);
      }
    },
    [max, t],
  );

  const remove = useCallback((id: string) => {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p) URL.revokeObjectURL(p.url);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  /** Uploads any photos not yet uploaded; returns all storage paths in order. */
  const uploadAll = useCallback(async (onProgress: (msg: string) => void) => {
    const list = photosRef.current;
    const paths: string[] = [];
    for (const [i, p] of list.entries()) {
      onProgress(t.photo.uploading(i + 1, list.length));
      let path = uploaded.current.get(p.id);
      if (!path) {
        path = await uploadPhoto(p.blob);
        uploaded.current.set(p.id, path);
      }
      paths.push(path);
    }
    return paths;
  }, [t]);

  const clear = useCallback(() => {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    uploaded.current.clear();
    setPhotos([]);
  }, []);

  return { photos, processing, error, add, remove, uploadAll, clear, max };
}

/** Thumbnails + Camera / Gallery buttons. */
export function PhotoPicker({ state, disabled }: { state: ReturnType<typeof usePhotos>; disabled?: boolean }) {
  const t = useT();
  const { photos, processing, error, add, remove, max } = state;
  const busy = processing || disabled;

  const picker = (label: string, icon: string, extra: { capture?: "environment"; multiple?: boolean }) => (
    <label
      className={`flex aspect-square cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 text-sm text-zinc-600 ${busy ? "opacity-50" : ""}`}
    >
      <span className="text-2xl">{icon}</span>
      {label}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={busy}
        {...extra}
        onChange={(e) => {
          void add(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square overflow-hidden rounded-xl bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
            <img src={p.url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(p.id)}
              disabled={disabled}
              aria-label={t.photo.remove}
              className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
            >
              ×
            </button>
          </div>
        ))}
        {photos.length < max && (
          <>
            {picker(t.photo.camera, "📷", { capture: "environment" })}
            {picker(t.photo.gallery, "🖼️", { multiple: true })}
          </>
        )}
      </div>
      {processing && <p className="text-sm text-zinc-500">{t.photo.preparing}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
