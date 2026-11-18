import { withJsonErrors } from "@/lib/server/config";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { findToilet, jsonError, readBody, requireHuman } from "@/lib/server/request";
import { getVisitor } from "@/lib/server/visitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { reviewSchema } from "@/lib/validation";

/** POST /api/toilets/[id]/reviews — create or update this device's review (one per device per toilet). */
export const POST = withJsonErrors(async (request: Request, ctx: RouteContext<"/api/toilets/[id]/reviews">) => {
  const visitor = getVisitor(request);
  if (!visitor) return jsonError("Missing device id", 400);
  const body = await readBody(request, reviewSchema);
  if (body instanceof Response) return body;

  const supabase = createAdminClient();
  const toilet = await findToilet(supabase, (await ctx.params).id);
  if (toilet instanceof Response) return toilet;

  const guard = await checkGuard(supabase, visitor, "review");
  if (!guard.ok) return jsonError(guard.error, guard.status);
  const human = await requireHuman(request, body.turnstileToken);
  if (human) return human;

  const { error } = await supabase.from("reviews").upsert(
    {
      toilet_id: toilet.id,
      rating: body.rating,
      cleanliness: body.cleanliness ?? null,
      safety: body.safety ?? null,
      water: body.water ?? null,
      text: body.text ?? null,
      author_name: body.authorName ?? null,
      device_id: visitor.deviceId,
      ip_hash: visitor.ipHash,
    },
    { onConflict: "toilet_id,device_id" },
  );
  if (error) throw new Error(error.message);

  await recordEvent(supabase, visitor, "review");
  return Response.json({ ok: true });
});
