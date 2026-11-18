import { createAdminClient, PHOTO_BUCKET } from "@/lib/supabase/admin";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { getVisitor } from "@/lib/server/visitor";

/**
 * POST /api/uploads/sign — returns a one-time signed URL so the browser can upload a
 * (compressed JPEG) photo straight to Supabase Storage, bypassing Vercel's body limit.
 */
export async function POST(request: Request) {
  const visitor = getVisitor(request);
  if (!visitor) return Response.json({ error: "Missing device id" }, { status: 400 });

  const supabase = createAdminClient();
  const guard = await checkGuard(supabase, visitor, "sign_upload");
  if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });

  const now = new Date();
  const month = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const path = `photos/${month}/${crypto.randomUUID()}.jpg`;

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error) {
    console.error("createSignedUploadUrl failed", error);
    return Response.json({ error: "Could not prepare upload" }, { status: 502 });
  }

  await recordEvent(supabase, visitor, "sign_upload");
  return Response.json({ path: data.path, token: data.token });
}
