"use client";

import { createClient } from "@supabase/supabase-js";
import { readJson } from "./http";
import { apiFetch } from "./visitor";

const MAX_SIDE = 1600;
const TARGET_BYTES = 400_000;

/**
 * Shrinks a photo to at most 1600 px on the long side and re-encodes it as JPEG.
 * Re-encoding also drops EXIF data (including the GPS tag). Rotation from the
 * camera is applied first so photos aren't sideways.
 */
export async function compressPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`Can't read "${file.name}". Please use a JPG or PNG photo.`);
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser can't process photos.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const toJpeg = (quality: number) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't compress photo"))), "image/jpeg", quality),
    );

  let blob = await toJpeg(0.82);
  for (const q of [0.7, 0.6, 0.5]) {
    if (blob.size <= TARGET_BYTES) break;
    blob = await toJpeg(q);
  }
  return blob;
}

let storageClient: ReturnType<typeof createClient> | null = null;
function storage() {
  storageClient ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return storageClient.storage.from("toilet-photos");
}

/** Gets a one-time upload URL from our API, uploads the photo to Supabase, returns its storage path. */
export async function uploadPhoto(blob: Blob): Promise<string> {
  const res = await apiFetch("/api/uploads/sign", { method: "POST" });
  const data = await readJson<{ path?: string; token?: string }>(res);
  if (!res.ok || !data.path || !data.token) throw new Error(data.error ?? "Couldn't start photo upload");

  const { error } = await storage().uploadToSignedUrl(data.path, data.token, blob, { contentType: "image/jpeg" });
  if (error) throw new Error("Photo upload failed. Check your connection and try again.");
  return data.path;
}
