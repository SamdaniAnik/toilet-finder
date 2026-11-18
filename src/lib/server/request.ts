import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { toiletIdSchema } from "@/lib/validation";
import { verifyTurnstile } from "./turnstile";
import { getClientIp } from "./visitor";

export const jsonError = (error: string, status: number) => Response.json({ error }, { status });

/** Parses and validates a JSON body. Returns the data, or a 400 Response. */
export async function readBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid input", 400);
  return parsed.data;
}

/** Returns a 400 Response if the captcha token is invalid, otherwise null. */
export async function requireHuman(request: Request, token: string): Promise<Response | null> {
  return (await verifyTurnstile(token, getClientIp(request)))
    ? null
    : jsonError("Captcha failed. Please try again.", 400);
}

/** Looks up a visible (not hidden/deleted) toilet. Returns its creator device id, or a 404 Response. */
export async function findToilet(
  supabase: SupabaseClient,
  rawId: string,
): Promise<{ id: string; deviceId: string } | Response> {
  const id = toiletIdSchema.safeParse(rawId);
  if (!id.success) return jsonError("Toilet not found", 404);
  const { data, error } = await supabase
    .from("toilets")
    .select("id, device_id")
    .eq("id", id.data)
    .is("deleted_at", null)
    .eq("is_hidden", false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return jsonError("Toilet not found", 404);
  return { id: data.id as string, deviceId: data.device_id as string };
}
