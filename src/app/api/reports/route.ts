import { withJsonErrors } from "@/lib/server/config";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { autoHideIfNeeded, TARGET_TABLE } from "@/lib/server/moderation";
import { jsonError, readBody } from "@/lib/server/request";
import { getVisitor } from "@/lib/server/visitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportSchema } from "@/lib/validation";

/** POST /api/reports { targetType, targetId, reason, details? } — flag content. One report per device per item. */
export const POST = withJsonErrors(async (request: Request) => {
  const visitor = getVisitor(request);
  if (!visitor) return jsonError("Missing device id", 400);
  const body = await readBody(request, reportSchema);
  if (body instanceof Response) return body;

  const supabase = createAdminClient();
  const guard = await checkGuard(supabase, visitor, "report");
  if (!guard.ok) return jsonError(guard.error, guard.status);

  const { data: target, error: targetError } = await supabase
    .from(TARGET_TABLE[body.targetType])
    .select("id, device_id")
    .eq("id", body.targetId)
    .maybeSingle();
  if (targetError) throw new Error(targetError.message);
  if (!target) return jsonError("That item no longer exists.", 404);
  if (target.device_id === visitor.deviceId) return jsonError("You can't report your own post.", 400);

  const { error } = await supabase.from("reports").insert({
    target_type: body.targetType,
    target_id: body.targetId,
    reason: body.details ? `${body.reason}: ${body.details}` : body.reason,
    device_id: visitor.deviceId,
    ip_hash: visitor.ipHash,
  });
  if (error?.code === "23505") return Response.json({ ok: true, already: true }); // already reported by this device
  if (error) throw new Error(error.message);

  await recordEvent(supabase, visitor, "report");
  const hidden = await autoHideIfNeeded(supabase, body.targetType, body.targetId);
  return Response.json({ ok: true, hidden }, { status: 201 });
});
