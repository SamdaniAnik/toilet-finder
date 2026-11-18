import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client — server only. All DB reads/writes go through this (RLS has no public policies). */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const PHOTO_BUCKET = "toilet-photos";

/** Public URL for a photo stored in the toilet-photos bucket. */
export function photoUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${storagePath}`;
}
