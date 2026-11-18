import type { ToiletStatus } from "@/types/toilet";

const STATUS_RANK: Record<ToiletStatus, number> = { open: 0, unknown: 1, closed: 2 };

/**
 * Order toilets for the emergency button: open first, then unknown status, then
 * reported closed; nearest first within each group.
 */
export function rankForEmergency<T extends { shownStatus: ToiletStatus; distanceM: number }>(toilets: T[]): T[] {
  return [...toilets].sort((a, b) => STATUS_RANK[a.shownStatus] - STATUS_RANK[b.shownStatus] || a.distanceM - b.distanceM);
}
