import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { photoUrl } from "@/lib/supabase/admin";
import type { ReportTarget } from "@/lib/validation";
import type { ModerationItem } from "@/types/admin";

type Ref = { type: ReportTarget; id: string };
type ReportInfo = { count: number; reasons: string[]; last: string | null };

/** Loads display details for a list of content refs (any mix of types), keeping order. */
export async function describeTargets(
  supabase: SupabaseClient,
  refs: Ref[],
  reports: Map<string, ReportInfo> = new Map(),
): Promise<ModerationItem[]> {
  const idsOf = (t: ReportTarget) => [...new Set(refs.filter((r) => r.type === t).map((r) => r.id))];
  const run = async <T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) => {
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  };
  const none = Promise.resolve([] as never[]);

  type Row = Record<string, unknown> & { id: string };
  const [toilets, photos, reviews, comments] = (await Promise.all([
    idsOf("toilet").length
      ? run(supabase.from("toilets").select("id, name, author_name, created_at, is_hidden, deleted_at").in("id", idsOf("toilet")))
      : none,
    idsOf("photo").length
      ? run(supabase.from("toilet_photos").select("id, toilet_id, storage_path, author_name, created_at, is_hidden").in("id", idsOf("photo")))
      : none,
    idsOf("review").length
      ? run(supabase.from("reviews").select("id, toilet_id, rating, text, author_name, created_at, is_hidden").in("id", idsOf("review")))
      : none,
    idsOf("comment").length
      ? run(supabase.from("comments").select("id, toilet_id, text, author_name, created_at, is_hidden, deleted_at").in("id", idsOf("comment")))
      : none,
  ])) as Row[][];

  const byType: Record<ReportTarget, Map<string, Row>> = {
    toilet: new Map(toilets.map((r) => [r.id, r])),
    photo: new Map(photos.map((r) => [r.id, r])),
    review: new Map(reviews.map((r) => [r.id, r])),
    comment: new Map(comments.map((r) => [r.id, r])),
  };

  // Names of parent toilets for photos/reviews/comments.
  const parentIds = [...new Set([...photos, ...reviews, ...comments].map((r) => r.toilet_id as string))].filter(
    (id) => !byType.toilet.has(id),
  );
  const parents = parentIds.length ? await run(supabase.from("toilets").select("id, name").in("id", parentIds)) : [];
  const toiletName = new Map<string, string>([
    ...toilets.map((t) => [t.id, t.name as string] as const),
    ...(parents as Row[]).map((t) => [t.id, t.name as string] as const),
  ]);

  return refs.map(({ type, id }) => {
    const row = byType[type].get(id);
    const rep = reports.get(`${type}:${id}`);
    const toiletId = row ? (type === "toilet" ? id : (row.toilet_id as string)) : null;
    return {
      targetType: type,
      targetId: id,
      toiletId,
      toiletName: toiletId ? (toiletName.get(toiletId) ?? null) : null,
      text: type === "toilet" ? null : ((row?.text as string | null) ?? null),
      photoUrl: type === "photo" && row ? photoUrl(row.storage_path as string) : null,
      rating: type === "review" ? ((row?.rating as number | null) ?? null) : null,
      authorName: (row?.author_name as string | null) ?? null,
      createdAt: (row?.created_at as string | null) ?? null,
      isHidden: Boolean(row?.is_hidden),
      missing: !row || Boolean(row.deleted_at),
      reportCount: rep?.count ?? 0,
      reasons: rep?.reasons ?? [],
      lastReportedAt: rep?.last ?? null,
    };
  });
}

/** Open reports grouped by target, most-reported first. */
export async function loadReportQueue(supabase: SupabaseClient): Promise<ModerationItem[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("target_type, target_id, reason, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const groups = new Map<string, ReportInfo & Ref>();
  for (const r of data) {
    const key = `${r.target_type}:${r.target_id}`;
    const g = groups.get(key) ?? { type: r.target_type as ReportTarget, id: r.target_id as string, count: 0, reasons: [], last: null };
    g.count += 1;
    g.reasons.push(r.reason as string);
    g.last ??= r.created_at as string;
    groups.set(key, g);
  }
  const sorted = [...groups.values()].sort((a, b) => b.count - a.count || (b.last ?? "").localeCompare(a.last ?? ""));
  return describeTargets(supabase, sorted, groups);
}

/** Newest toilets and photos, for a quick scan of fresh content. */
export async function loadRecent(supabase: SupabaseClient): Promise<ModerationItem[]> {
  const [toilets, photos] = await Promise.all([
    supabase.from("toilets").select("id, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(25),
    supabase.from("toilet_photos").select("id, created_at").order("created_at", { ascending: false }).limit(25),
  ]);
  if (toilets.error) throw new Error(toilets.error.message);
  if (photos.error) throw new Error(photos.error.message);

  const refs = [
    ...toilets.data.map((t) => ({ type: "toilet" as const, id: t.id as string, at: t.created_at as string })),
    ...photos.data.map((p) => ({ type: "photo" as const, id: p.id as string, at: p.created_at as string })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  return describeTargets(supabase, refs);
}
