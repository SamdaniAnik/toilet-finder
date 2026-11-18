import "server-only";
import { cacheLife } from "next/cache";
import { createAdminClient, photoUrl } from "@/lib/supabase/admin";
import { toiletIdSchema } from "@/lib/validation";
import type { Gender } from "@/types/toilet";

export type ToiletMeta = {
  name: string;
  gender: Gender;
  isPaid: boolean;
  priceBdt: number | null;
  avgRating: number;
  reviewCount: number;
  photoUrl: string | null;
};

/** Minimal public toilet info for link previews. Cached for an hour per id. */
export async function getToiletMeta(id: string): Promise<ToiletMeta | null> {
  "use cache";
  cacheLife("hours");

  if (!toiletIdSchema.safeParse(id).success) return null;
  const supabase = createAdminClient();
  const { data: t } = await supabase
    .from("toilets")
    .select("id, name, gender, is_paid, price_bdt, avg_rating, review_count")
    .eq("id", id)
    .is("deleted_at", null)
    .eq("is_hidden", false)
    .maybeSingle();
  if (!t) return null;

  const { data: photo } = await supabase
    .from("toilet_photos")
    .select("storage_path")
    .eq("toilet_id", id)
    .eq("is_hidden", false)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  return {
    name: t.name,
    gender: t.gender,
    isPaid: t.is_paid,
    priceBdt: t.price_bdt == null ? null : Number(t.price_bdt),
    avgRating: Number(t.avg_rating),
    reviewCount: t.review_count,
    photoUrl: photo ? photoUrl(photo.storage_path) : null,
  };
}
