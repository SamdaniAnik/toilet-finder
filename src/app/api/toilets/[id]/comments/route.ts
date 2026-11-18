import { withJsonErrors } from "@/lib/server/config";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { findToilet, jsonError, readBody, requireHuman } from "@/lib/server/request";
import { getVisitor } from "@/lib/server/visitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { commentSchema } from "@/lib/validation";

/** POST /api/toilets/[id]/comments { text, authorName?, turnstileToken } */
export const POST = withJsonErrors(async (request: Request, ctx: RouteContext<"/api/toilets/[id]/comments">) => {
  const visitor = getVisitor(request);
  if (!visitor) return jsonError("Missing device id", 400);
  const body = await readBody(request, commentSchema);
  if (body instanceof Response) return body;

  const supabase = createAdminClient();
  const toilet = await findToilet(supabase, (await ctx.params).id);
  if (toilet instanceof Response) return toilet;

  const guard = await checkGuard(supabase, visitor, "comment");
  if (!guard.ok) return jsonError(guard.error, guard.status);
  const human = await requireHuman(request, body.turnstileToken);
  if (human) return human;

  const { error } = await supabase.from("comments").insert({
    toilet_id: toilet.id,
    text: body.text,
    author_name: body.authorName ?? null,
    device_id: visitor.deviceId,
    ip_hash: visitor.ipHash,
  });
  if (error) throw new Error(error.message);

  await recordEvent(supabase, visitor, "comment");
  return Response.json({ ok: true }, { status: 201 });
});
