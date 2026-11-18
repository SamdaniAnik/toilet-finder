import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReportTarget } from "@/lib/validation";

/** Table holding each kind of reportable content. */
export const TARGET_TABLE: Record<ReportTarget, string> = {
  toilet: "toilets",
  photo: "toilet_photos",
  review: "reviews",
  comment: "comments",
};

/**
 * Content is hidden automatically once reported by this many different devices
 * from at least AUTO_HIDE_MIN_IPS different networks (so one person with several
 * browsers can't hide things alone).
 */
export const AUTO_HIDE_REPORTS = 3;
export const AUTO_HIDE_MIN_IPS = 2;

/** Hides the target if its open reports cross the threshold. Returns true if it is now hidden. */
export async function autoHideIfNeeded(supabase: SupabaseClient, type: ReportTarget, id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("reports")
    .select("device_id, ip_hash")
    .eq("target_type", type)
    .eq("target_id", id)
    .eq("status", "open");
  if (error) throw new Error(error.message);

  const devices = new Set(data.map((r) => r.device_id)).size;
  const ips = new Set(data.map((r) => r.ip_hash)).size;
  if (devices < AUTO_HIDE_REPORTS || ips < AUTO_HIDE_MIN_IPS) return false;

  const { error: hideError } = await supabase.from(TARGET_TABLE[type]).update({ is_hidden: true }).eq("id", id);
  if (hideError) throw new Error(hideError.message);
  return true;
}

/** Marks all open reports for a target as resolved or dismissed. */
export async function closeReports(
  supabase: SupabaseClient,
  type: ReportTarget,
  id: string,
  status: "resolved" | "dismissed",
) {
  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("target_type", type)
    .eq("target_id", id)
    .eq("status", "open");
  if (error) throw new Error(error.message);
}
