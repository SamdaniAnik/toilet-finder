import { withJsonErrors } from "@/lib/server/config";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { findToilet, jsonError, readBody } from "@/lib/server/request";
import { getVisitor } from "@/lib/server/visitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { statusVoteSchema } from "@/lib/validation";

const COOLDOWN_MS = 30 * 60 * 1000;

/** POST /api/toilets/[id]/status { status } — "It's open" / "It's closed". One vote per device per toilet per 30 min. */
export const POST = withJsonErrors(async (request: Request, ctx: RouteContext<"/api/toilets/[id]/status">) => {
  const visitor = getVisitor(request);
  if (!visitor) return jsonError("Missing device id", 400);
  const body = await readBody(request, statusVoteSchema);
  if (body instanceof Response) return body;

  const supabase = createAdminClient();
  const toilet = await findToilet(supabase, (await ctx.params).id);
  if (toilet instanceof Response) return toilet;

  const guard = await checkGuard(supabase, visitor, "status_vote");
  if (!guard.ok) return jsonError(guard.error, guard.status);

  const { data: recent, error: recentError } = await supabase
    .from("status_updates")
    .select("id")
    .eq("toilet_id", toilet.id)
    .eq("device_id", visitor.deviceId)
    .gte("created_at", new Date(Date.now() - COOLDOWN_MS).toISOString())
    .limit(1);
  if (recentError) throw new Error(recentError.message);
  if (recent.length > 0) return jsonError("Thanks! You already updated this toilet recently.", 429);

  const { error } = await supabase
    .from("status_updates")
    .insert({ toilet_id: toilet.id, status: body.status, device_id: visitor.deviceId, ip_hash: visitor.ipHash });
  if (error) throw new Error(error.message);

  await recordEvent(supabase, visitor, "status_vote");
  return Response.json({ ok: true });
});
