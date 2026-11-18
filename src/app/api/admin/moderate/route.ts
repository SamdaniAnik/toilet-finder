import { requireAdmin } from "@/lib/server/admin";
import { withJsonErrors } from "@/lib/server/config";
import { closeReports, TARGET_TABLE } from "@/lib/server/moderation";
import { jsonError, readBody } from "@/lib/server/request";
import { PHOTO_BUCKET } from "@/lib/supabase/admin";
import { moderateSchema } from "@/lib/validation";

/**
 * POST /api/admin/moderate { targetType, targetId, action } — admin only.
 *  keep:   make visible again and dismiss its reports
 *  hide:   hide it (can be kept later) and resolve reports
 *  delete: remove it (toilets are soft-deleted) and resolve reports
 *  ban:    ban the author's device, hide this item and resolve reports
 */
export const POST = withJsonErrors(async (request: Request) => {
  const auth = await requireAdmin(request);
  if (auth instanceof Response) return auth;
  const body = await readBody(request, moderateSchema);
  if (body instanceof Response) return body;

  const { supabase } = auth;
  const table = TARGET_TABLE[body.targetType];
  const { data: target, error } = await supabase
    .from(table)
    .select(body.targetType === "photo" ? "id, device_id, storage_path" : "id, device_id")
    .eq("id", body.targetId)
    .maybeSingle<{ id: string; device_id: string; storage_path?: string }>();
  if (error) throw new Error(error.message);
  if (!target) {
    // Already gone: just clear the reports.
    await closeReports(supabase, body.targetType, body.targetId, "resolved");
    return Response.json({ ok: true });
  }

  const update = async (values: Record<string, unknown>) => {
    const { error: e } = await supabase.from(table).update(values).eq("id", target.id);
    if (e) throw new Error(e.message);
  };

  switch (body.action) {
    case "keep":
      await update({ is_hidden: false });
      await closeReports(supabase, body.targetType, target.id, "dismissed");
      break;
    case "hide":
      await update({ is_hidden: true });
      await closeReports(supabase, body.targetType, target.id, "resolved");
      break;
    case "delete":
      if (body.targetType === "toilet") {
        await update({ deleted_at: new Date().toISOString() });
      } else {
        const { error: e } = await supabase.from(table).delete().eq("id", target.id);
        if (e) throw new Error(e.message);
        if (target.storage_path) await supabase.storage.from(PHOTO_BUCKET).remove([target.storage_path]);
      }
      await closeReports(supabase, body.targetType, target.id, "resolved");
      break;
    case "ban": {
      // Device-only ban: many Bangladeshi mobile users share one IP, so banning IPs would block innocent people.
      const { data: existing, error: banLookupError } = await supabase
        .from("bans")
        .select("id")
        .eq("device_id", target.device_id)
        .limit(1);
      if (banLookupError) throw new Error(banLookupError.message);
      if (existing.length === 0) {
        const { error: banError } = await supabase
          .from("bans")
          .insert({ device_id: target.device_id, reason: `${body.targetType} ${target.id} by ${auth.email}` });
        if (banError) throw new Error(banError.message);
      }
      await update({ is_hidden: true });
      await closeReports(supabase, body.targetType, target.id, "resolved");
      break;
    }
    default:
      return jsonError("Unknown action", 400);
  }

  return Response.json({ ok: true });
});
