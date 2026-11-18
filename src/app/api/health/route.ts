import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** GET /api/health — confirms env vars are set and the database schema is reachable. */
export async function GET() {
  await connection(); // always run at request time

  try {
    const supabase = createAdminClient();
    // Not a HEAD request: a missing table returns an empty error message on HEAD.
    const { count, error } = await supabase.from("toilets").select("id", { count: "exact" }).limit(1);
    if (error) throw new Error(error.message || `Supabase error ${error.code ?? "unknown"}`);

    // The map depends on the query functions too, so check one exists.
    const rpc = await supabase.rpc("toilets_near_point", { lat: 23.81, lng: 90.41, radius_m: 1 });
    if (rpc.error) throw new Error(`Migration incomplete: ${rpc.error.message}`);

    return Response.json({ ok: true, toilets: count ?? 0 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ ok: false, error: message }, { status: 503 });
  }
}
