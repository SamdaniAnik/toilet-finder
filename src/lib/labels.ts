import type { Gender, ToiletStatus } from "@/types/toilet";

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  unisex: "Unisex",
  separate: "Male & Female",
  accessible: "Accessible ♿",
};

export const STATUS_LABEL: Record<ToiletStatus, string> = {
  open: "Open",
  closed: "Closed",
  unknown: "Status unknown",
};

/** Status reports older than this are shown as "unknown". */
export const STATUS_STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function effectiveStatus(status: ToiletStatus, updatedAt: string | null, now = Date.now()): ToiletStatus {
  if (status === "unknown" || !updatedAt) return "unknown";
  return now - new Date(updatedAt).getTime() > STATUS_STALE_MS ? "unknown" : status;
}

export function formatPrice(isPaid: boolean, priceBdt: number | null): string {
  if (!isPaid) return "Free";
  return priceBdt != null ? `৳${priceBdt}` : "Paid";
}
