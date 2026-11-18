import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ConfigError } from "@/lib/server/config";

/** Service-role client — server only. All DB reads/writes go through this (RLS has no public policies). */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new ConfigError("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new ConfigError("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const PHOTO_BUCKET = "toilet-photos";

/** Public URL for a photo stored in the toilet-photos bucket. */
export function photoUrl(storagePath: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/${storagePath}`;
}
