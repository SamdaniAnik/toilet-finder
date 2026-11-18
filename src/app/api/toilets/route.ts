import type { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient, PHOTO_BUCKET, photoUrl } from "@/lib/supabase/admin";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { verifyTurnstile } from "@/lib/server/turnstile";
import { getClientIp, getVisitor } from "@/lib/server/visitor";
import { createToiletSchema } from "@/lib/validation";
import type { ToiletPin } from "@/types/toilet";
import { withJsonErrors } from "@/lib/server/config";

const bboxSchema = z
  .string()
  .transform((s) => s.split(",").map(Number))
  .pipe(
    z.tuple([
      z.number().min(-180).max(180), // minLng
      z.number().min(-90).max(90), // minLat
      z.number().min(-180).max(180), // maxLng
      z.number().min(-90).max(90), // maxLat
    ]),
  )
  .refine(([minLng, minLat, maxLng, maxLat]) => minLng < maxLng && minLat < maxLat, "Invalid bbox");

type BboxRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  gender: ToiletPin["gender"];
  is_paid: boolean;
  price_bdt: number | string | null;
  current_status: ToiletPin["status"];
  status_updated_at: string | null;
  avg_rating: number | string;
  review_count: number;
  is_verified: boolean;
  cover_photo: string | null;
};

/** GET /api/toilets?bbox=minLng,minLat,maxLng,maxLat — toilets visible in the map area. */
export const GET = withJsonErrors(async (request: NextRequest) => {
  const parsed = bboxSchema.safeParse(request.nextUrl.searchParams.get("bbox") ?? "");
  if (!parsed.success) {
    return Response.json({ error: "bbox must be minLng,minLat,maxLng,maxLat" }, { status: 400 });
  }
  const [minLng, minLat, maxLng, maxLat] = parsed.data;

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await supabase.rpc("toilets_in_bbox", {
    min_lng: minLng,
    min_lat: minLat,
    max_lng: maxLng,
    max_lat: maxLat,
    lim: 500,
  });
  if (error) {
    console.error("toilets_in_bbox failed", error);
    // Network failure = Supabase not reachable (e.g. placeholder URL in .env.local).
    const unreachable = /fetch failed/i.test(error.message);
    return Response.json(
      { error: unreachable ? "Database not reachable" : "Could not load toilets" },
      { status: unreachable ? 503 : 502 },
    );
  }

  const toilets: ToiletPin[] = (data as BboxRow[]).map((r) => ({
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    gender: r.gender,
    isPaid: r.is_paid,
    priceBdt: r.price_bdt == null ? null : Number(r.price_bdt),
    status: r.current_status,
    statusUpdatedAt: r.status_updated_at,
    avgRating: Number(r.avg_rating),
    reviewCount: r.review_count,
    isVerified: r.is_verified,
    coverPhotoUrl: r.cover_photo ? photoUrl(r.cover_photo) : null,
  }));

  return Response.json({ toilets });
});

/** POST /api/toilets — add a toilet (no login). Photos must already be uploaded via /api/uploads/sign. */
export const POST = withJsonErrors(async (request: Request) => {
  const visitor = getVisitor(request);
  if (!visitor) return Response.json({ error: "Missing device id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createToiletSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const input = parsed.data;

  const supabase = createAdminClient();

  const guard = await checkGuard(supabase, visitor, "add_toilet");
  if (!guard.ok) return Response.json({ error: guard.error }, { status: guard.status });

  if (!(await verifyTurnstile(input.turnstileToken, getClientIp(request)))) {
    return Response.json({ error: "Captcha failed. Please try again." }, { status: 400 });
  }

  // Make sure every photo was actually uploaded.
  const bucket = supabase.storage.from(PHOTO_BUCKET);
  const checks = await Promise.all(input.photoPaths.map((p) => bucket.exists(p)));
  if (checks.some((c) => !c.data)) {
    return Response.json({ error: "A photo didn't finish uploading. Please try again." }, { status: 400 });
  }
  // A path can only be attached once (stops reusing someone else's upload).
  const { data: used, error: usedError } = await supabase
    .from("toilet_photos")
    .select("id")
    .in("storage_path", input.photoPaths)
    .limit(1);
  if (usedError) throw new Error(usedError.message);
  if (used.length > 0) return Response.json({ error: "That photo was already added." }, { status: 400 });

  const authorName = input.authorName ?? null;
  const { data: toilet, error: insertError } = await supabase
    .from("toilets")
    .insert({
      name: input.name,
      location: `SRID=4326;POINT(${input.lng} ${input.lat})`,
      gender: input.gender,
      is_paid: input.isPaid,
      price_bdt: input.isPaid ? (input.priceBdt ?? null) : null,
      has_water: input.hasWater ?? null,
      has_soap: input.hasSoap ?? null,
      baby_changing: input.babyChanging ?? null,
      description: input.description ?? null,
      author_name: authorName,
      device_id: visitor.deviceId,
      ip_hash: visitor.ipHash,
    })
    .select("id")
    .single();
  if (insertError) {
    console.error("insert toilet failed", insertError);
    return Response.json({ error: "Could not save the toilet" }, { status: 502 });
  }

  const who = { author_name: authorName, device_id: visitor.deviceId, ip_hash: visitor.ipHash };
  const [photos, status] = await Promise.all([
    supabase.from("toilet_photos").insert(input.photoPaths.map((storage_path) => ({ toilet_id: toilet.id, storage_path, ...who }))),
    // The trigger on status_updates sets toilets.current_status.
    supabase.from("status_updates").insert({ toilet_id: toilet.id, status: input.status, device_id: visitor.deviceId, ip_hash: visitor.ipHash }),
  ]);
  if (photos.error || status.error) {
    console.error("insert photos/status failed", photos.error ?? status.error);
    await supabase.from("toilets").delete().eq("id", toilet.id);
    return Response.json({ error: "Could not save the toilet" }, { status: 502 });
  }

  await recordEvent(supabase, visitor, "add_toilet");
  return Response.json({ id: toilet.id }, { status: 201 });
});
