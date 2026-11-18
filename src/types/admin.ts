import type { ReportTarget } from "@/lib/validation";

/** One piece of content in the admin queue, with its reports (if any). */
export type ModerationItem = {
  targetType: ReportTarget;
  targetId: string;
  /** The toilet this belongs to (itself, for a toilet). */
  toiletId: string | null;
  toiletName: string | null;
  text: string | null;
  photoUrl: string | null;
  rating: number | null;
  authorName: string | null;
  createdAt: string | null;
  isHidden: boolean;
  /** Gone from the database (deleted). */
  missing: boolean;
  reportCount: number;
  reasons: string[];
  lastReportedAt: string | null;
};

export type ModerationQueue = { items: ModerationItem[] };
