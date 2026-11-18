import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Visitor } from "./visitor";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Daily limits per action. Mobile carriers in Bangladesh put many users behind one
 * shared IP (CGNAT), so the per-IP limit is much looser than the per-device one.
 */
export const LIMITS = {
  add_toilet: { perDevice: 5, perIp: 40 },
  sign_upload: { perDevice: 40, perIp: 300 },
  add_photo: { perDevice: 20, perIp: 200 },
  status_vote: { perDevice: 60, perIp: 600 },
  confirm: { perDevice: 50, perIp: 500 },
  review: { perDevice: 30, perIp: 300 },
  comment: { perDevice: 30, perIp: 300 },
} as const;

export type GuardedAction = keyof typeof LIMITS;

export type GuardResult = { ok: true } | { ok: false; status: 403 | 429; error: string };

/** Rejects banned visitors and visitors over today's limit for `action`. */
export async function checkGuard(
  supabase: SupabaseClient,
  visitor: Visitor,
  action: GuardedAction,
): Promise<GuardResult> {
  const { data: bans, error: banError } = await supabase
    .from("bans")
    .select("id")
    .or(`device_id.eq.${visitor.deviceId},ip_hash.eq.${visitor.ipHash}`)
    .limit(1);
  if (banError) throw new Error(banError.message);
  if (bans.length > 0) return { ok: false, status: 403, error: "You can't post right now." };

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const count = async (column: "device_id" | "ip_hash", value: string) => {
    const { count, error } = await supabase
      .from("rate_events")
      .select("id", { count: "exact" })
      .eq("action", action)
      .eq(column, value)
      .gte("created_at", since)
      .limit(1);
    if (error) throw new Error(error.message);
    return count ?? 0;
  };

  const [byDevice, byIp] = await Promise.all([count("device_id", visitor.deviceId), count("ip_hash", visitor.ipHash)]);
  const limit = LIMITS[action];
  if (byDevice >= limit.perDevice || byIp >= limit.perIp) {
    return { ok: false, status: 429, error: "Daily limit reached. Please try again tomorrow." };
  }
  return { ok: true };
}

export async function recordEvent(supabase: SupabaseClient, visitor: Visitor, action: GuardedAction) {
  const { error } = await supabase
    .from("rate_events")
    .insert({ action, device_id: visitor.deviceId, ip_hash: visitor.ipHash });
  if (error) console.error("recordEvent failed", error);
}
