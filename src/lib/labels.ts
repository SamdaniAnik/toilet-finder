import type { ToiletStatus } from "@/types/toilet";

// Display text (gender, status, price…) lives in src/i18n/messages.ts.

/** Status reports older than this are shown as "unknown". */
export const STATUS_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function effectiveStatus(status: ToiletStatus, updatedAt: string | null, now = Date.now()): ToiletStatus {
  if (status === "unknown" || !updatedAt) return "unknown";
  return now - new Date(updatedAt).getTime() > STATUS_STALE_MS ? "unknown" : status;
}
