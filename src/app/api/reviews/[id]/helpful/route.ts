import { withJsonErrors } from "@/lib/server/config";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { jsonError } from "@/lib/server/request";
import { getVisitor } from "@/lib/server/visitor";
import { createAdminClient } from "@/lib/supabase/admin";
import { toiletIdSchema } from "@/lib/validation";

/** POST /api/reviews/[id]/helpful — "This review was helpful". One vote per device; not on your own review. */
export const POST = withJsonErrors(async (request: Request, ctx: RouteContext<"/api/reviews/[id]/helpful">) => {
  const visitor = getVisitor(request);
  if (!visitor) return jsonError("Missing device id", 400);
  const id = toiletIdSchema.safeParse((await ctx.params).id); // any uuid
  if (!id.success) return jsonError("Review not found", 404);

  const supabase = createAdminClient();
  const { data: review, error } = await supabase
    .from("reviews")
    .select("id, device_id")
    .eq("id", id.data)
    .eq("is_hidden", false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!review) return jsonError("Review not found", 404);
  if (review.device_id === visitor.deviceId) return jsonError("You can't vote on your own review.", 400);

  const guard = await checkGuard(supabase, visitor, "helpful");
  if (!guard.ok) return jsonError(guard.error, guard.status);

  const { error: voteError } = await supabase.from("review_helpful").insert({ review_id: review.id, device_id: visitor.deviceId });
  if (voteError?.code === "23505") return Response.json({ ok: true, already: true }); // already voted
  if (voteError) throw new Error(voteError.message);

  await recordEvent(supabase, visitor, "helpful");
  return Response.json({ ok: true });
});
