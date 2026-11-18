import type { NextRequest } from "next/server";
import { z } from "zod";
import { withJsonErrors } from "@/lib/server/config";
import { checkGuard, recordEvent } from "@/lib/server/guard";
import { findToilet, jsonError, readBody } from "@/lib/server/request";
import { getVisitor } from "@/lib/server/visitor";
import { createAdminClient, photoUrl } from "@/lib/supabase/admin";
import { editToiletSchema, toiletIdSchema } from "@/lib/validation";
import { parseWkbPoint } from "@/lib/wkb";
import type { Comment, Review, ToiletDetail, ToiletPhoto } from "@/types/toilet";

const DAY_MS = 24 * 60 * 60 * 1000;

/** GET /api/toilets/[id] — full toilet details. `x-device-id` (optional) marks the visitor's own posts. */
export const GET = withJsonErrors(async (request: NextRequest, ctx: RouteContext<"/api/toilets/[id]">) => {
  const { id: rawId } = await ctx.params;
  const id = toiletIdSchema.safeParse(rawId);
  if (!id.success) return jsonError("Toilet not found", 404);

  const deviceParsed = z.uuid().safeParse(request.headers.get("x-device-id"));
  const deviceId = deviceParsed.success ? deviceParsed.data : null;
  const supabase = createAdminClient();

  const { data: t, error } = await supabase
    .from("toilets")
    .select(
      "id, name, description, location, gender, is_paid, price_bdt, current_status, status_updated_at, has_water, has_soap, baby_changing, avg_rating, review_count, confirm_count, is_verified, author_name, device_id, created_at",
    )
    .eq("id", id.data)
    .is("deleted_at", null)
    .eq("is_hidden", false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!t) return jsonError("Toilet not found", 404);

  const point = parseWkbPoint(t.location as string);
  if (!point) throw new Error(`Unreadable location for toilet ${t.id}`);

  const since = new Date(Date.now() - DAY_MS).toISOString();
  const [photos, reviews, comments, reports, confirmed] = await Promise.all([
    supabase
      .from("toilet_photos")
      .select("id, storage_path, author_name, created_at")
      .eq("toilet_id", t.id)
      .eq("is_hidden", false)
      .order("created_at")
      .limit(30),
    supabase
      .from("reviews")
      .select("id, rating, cleanliness, safety, water, text, author_name, device_id, created_at, updated_at, helpful_count")
      .eq("toilet_id", t.id)
      .eq("is_hidden", false)
      .order("helpful_count", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("comments")
      .select("id, text, author_name, device_id, created_at")
      .eq("toilet_id", t.id)
      .eq("is_hidden", false)
      .is("deleted_at", null)
      .order("created_at")
      .limit(100),
    t.current_status === "unknown"
      ? Promise.resolve({ count: 0, error: null })
      : supabase
          .from("status_updates")
          .select("id", { count: "exact" })
          .eq("toilet_id", t.id)
          .eq("status", t.current_status)
          .gte("created_at", since)
          .limit(1),
    deviceId
      ? supabase.from("confirmations").select("toilet_id").eq("toilet_id", t.id).eq("device_id", deviceId).limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [photos, reviews, comments, reports, confirmed]) if (r.error) throw new Error(r.error.message);

  // Which of these reviews this device already marked helpful.
  const reviewIds = (reviews.data ?? []).map((r) => r.id as string);
  const voted = new Set<string>();
  if (deviceId && reviewIds.length > 0) {
    const { data: votes, error: votesError } = await supabase
      .from("review_helpful")
      .select("review_id")
      .eq("device_id", deviceId)
      .in("review_id", reviewIds);
    if (votesError) throw new Error(votesError.message);
    for (const v of votes) voted.add(v.review_id as string);
  }

  const detail: ToiletDetail = {
    id: t.id,
    name: t.name,
    lat: point.lat,
    lng: point.lng,
    gender: t.gender,
    isPaid: t.is_paid,
    priceBdt: t.price_bdt == null ? null : Number(t.price_bdt),
    status: t.current_status,
    statusUpdatedAt: t.status_updated_at,
    avgRating: Number(t.avg_rating),
    reviewCount: t.review_count,
    isVerified: t.is_verified,
    coverPhotoUrl: photos.data?.[0] ? photoUrl(photos.data[0].storage_path) : null,
    description: t.description,
    hasWater: t.has_water,
    hasSoap: t.has_soap,
    babyChanging: t.baby_changing,
    confirmCount: t.confirm_count,
    authorName: t.author_name,
    createdAt: t.created_at,
    recentStatusReports: reports.count ?? 0,
    isMine: deviceId != null && t.device_id === deviceId,
    confirmedByMe: (confirmed.data?.length ?? 0) > 0,
    photos: (photos.data ?? []).map(
      (p): ToiletPhoto => ({ id: p.id, url: photoUrl(p.storage_path), authorName: p.author_name, createdAt: p.created_at }),
    ),
    reviews: (reviews.data ?? []).map(
      (r): Review => ({
        id: r.id,
        rating: r.rating,
        cleanliness: r.cleanliness,
        safety: r.safety,
        water: r.water,
        text: r.text,
        authorName: r.author_name,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        isMine: deviceId != null && r.device_id === deviceId,
        helpfulCount: r.helpful_count,
        votedHelpful: voted.has(r.id),
      }),
    ),
    comments: (comments.data ?? []).map(
      (c): Comment => ({
        id: c.id,
        text: c.text,
        authorName: c.author_name,
        createdAt: c.created_at,
        isMine: deviceId != null && c.device_id === deviceId,
      }),
    ),
  };

  return Response.json(detail);
});

/**
 * PATCH /api/toilets/[id] — the device that added a toilet can correct its details.
 * Location and photos aren't editable here (photos are added separately; a wrong
 * location should be reported and re-added).
 */
export const PATCH = withJsonErrors(async (request: Request, ctx: RouteContext<"/api/toilets/[id]">) => {
  const visitor = getVisitor(request);
  if (!visitor) return jsonError("Missing device id", 400);
  const body = await readBody(request, editToiletSchema);
  if (body instanceof Response) return body;

  const supabase = createAdminClient();
  const toilet = await findToilet(supabase, (await ctx.params).id);
  if (toilet instanceof Response) return toilet;
  if (toilet.deviceId !== visitor.deviceId) return jsonError("Only the person who added this toilet can edit it.", 403);

  const guard = await checkGuard(supabase, visitor, "edit_toilet");
  if (!guard.ok) return jsonError(guard.error, guard.status);

  const { error } = await supabase
    .from("toilets")
    .update({
      name: body.name,
      gender: body.gender,
      is_paid: body.isPaid,
      price_bdt: body.isPaid ? (body.priceBdt ?? null) : null,
      has_water: body.hasWater,
      has_soap: body.hasSoap,
      baby_changing: body.babyChanging,
      description: body.description ?? null,
    })
    .eq("id", toilet.id);
  if (error) throw new Error(error.message);

  await recordEvent(supabase, visitor, "edit_toilet");
  return Response.json({ ok: true });
});
