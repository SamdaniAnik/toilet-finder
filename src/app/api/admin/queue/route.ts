import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/admin";
import { loadRecent, loadReportQueue } from "@/lib/server/adminQueue";
import { withJsonErrors } from "@/lib/server/config";
import type { ModerationQueue } from "@/types/admin";

/** GET /api/admin/queue?tab=reports|recent — admin only. */
export const GET = withJsonErrors(async (request: NextRequest) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;

  const tab = request.nextUrl.searchParams.get("tab") === "recent" ? "recent" : "reports";
  const items = tab === "recent" ? await loadRecent(auth.supabase) : await loadReportQueue(auth.supabase);
  return Response.json({ items } satisfies ModerationQueue);
});
