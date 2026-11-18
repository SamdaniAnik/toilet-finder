import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "./request";

export function adminEmails(): string[] {
  return String(process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Checks the `Authorization: Bearer <supabase access token>` header belongs to a
 * signed-in user whose email is in ADMIN_EMAILS. Returns the service client, or a 401/403 Response.
 */
export async function requireAdmin(request: Request): Promise<{ supabase: SupabaseClient; email: string } | Response> {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return jsonError("Please sign in.", 401);

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) return jsonError("Your session expired. Please sign in again.", 401);
  if (!adminEmails().includes(email)) return jsonError("This account isn't an admin.", 403);
  return { supabase, email };
}
