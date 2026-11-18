import { withJsonErrors } from "@/lib/server/config";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { findToilet, jsonError } from "@/lib/server/request";
import { getVisitor } from "@/lib/server/visitor";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST /api/toilets/[id]/confirm — "Yes, this toilet exists". 3 confirmations from different devices verify it. */
export const POST = withJsonErrors(async (request: Request, ctx: RouteContext<"/api/toilets/[id]/confirm">) => {
  const visitor = getVisitor(request);
  if (!visitor) return jsonError("Missing device id", 400);

  const supabase = createAdminClient();
  const toilet = await findToilet(supabase, (await ctx.params).id);
  if (toilet instanceof Response) return toilet;
  if (toilet.deviceId === visitor.deviceId) return jsonError("You added this toilet, so others need to confirm it.", 403);

  const guard = await checkGuard(supabase, visitor, "confirm");
  if (!guard.ok) return jsonError(guard.error, guard.status);

  const { error } = await supabase
    .from("confirmations")
    .insert({ toilet_id: toilet.id, device_id: visitor.deviceId, ip_hash: visitor.ipHash });
  if (error?.code === "23505") return Response.json({ ok: true, already: true }); // unique violation
  if (error) throw new Error(error.message);

  await recordEvent(supabase, visitor, "confirm");
  return Response.json({ ok: true });
});
