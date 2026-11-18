import { withJsonErrors } from "@/lib/server/config";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { findToilet, jsonError, readBody, requireHuman } from "@/lib/server/request";
import { getVisitor } from "@/lib/server/visitor";
import { createAdminClient, PHOTO_BUCKET } from "@/lib/supabase/admin";
import { addPhotosSchema } from "@/lib/validation";

const MAX_PHOTOS_PER_TOILET = 30;

/** POST /api/toilets/[id]/photos — attach photos (already uploaded via /api/uploads/sign) to an existing toilet. */
export const POST = withJsonErrors(async (request: Request, ctx: RouteContext<"/api/toilets/[id]/photos">) => {
  const visitor = getVisitor(request);
  if (!visitor) return jsonError("Missing device id", 400);
  const body = await readBody(request, addPhotosSchema);
  if (body instanceof Response) return body;

  const supabase = createAdminClient();
  const toilet = await findToilet(supabase, (await ctx.params).id);
  if (toilet instanceof Response) return toilet;

  const guard = await checkGuard(supabase, visitor, "add_photo");
  if (!guard.ok) return jsonError(guard.error, guard.status);
  const human = await requireHuman(request, body.turnstileToken);
  if (human) return human;

  const { count, error: countError } = await supabase
    .from("toilet_photos")
    .select("id", { count: "exact" })
    .eq("toilet_id", toilet.id)
    .limit(1);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) + body.photoPaths.length > MAX_PHOTOS_PER_TOILET) {
    return jsonError("This toilet already has plenty of photos.", 400);
  }

  const bucket = supabase.storage.from(PHOTO_BUCKET);
  const checks = await Promise.all(body.photoPaths.map((p) => bucket.exists(p)));
  if (checks.some((c) => !c.data)) return jsonError("A photo didn't finish uploading. Please try again.", 400);

  // A path can only be attached once (stops reusing someone else's upload).
  const { data: used, error: usedError } = await supabase
    .from("toilet_photos")
    .select("id")
    .in("storage_path", body.photoPaths)
    .limit(1);
  if (usedError) throw new Error(usedError.message);
  if (used.length > 0) return jsonError("That photo was already added.", 400);

  const { error } = await supabase.from("toilet_photos").insert(
    body.photoPaths.map((storage_path) => ({
      toilet_id: toilet.id,
      storage_path,
      author_name: body.authorName ?? null,
      device_id: visitor.deviceId,
      ip_hash: visitor.ipHash,
    })),
  );
  if (error) throw new Error(error.message);

  await recordEvent(supabase, visitor, "add_photo");
  return Response.json({ ok: true }, { status: 201 });
});
