// Imports public toilets in Bangladesh from OpenStreetMap (amenity=toilets).
//
//   Dry run (default, writes nothing):  node --env-file=.env.local scripts/import-osm.mjs
//   Import for real:                    node --env-file=.env.local scripts/import-osm.mjs --apply
//
// Options:
//   --from-file <path>            use a saved Overpass JSON array instead of querying Overpass
//   --include-camps               also import latrines in the Rohingya refugee camps (Ukhia/Teknaf)
//   --include-community-latrines  also import the DhakaThrive survey's community pit latrines
//
// Left out by default, because they aren't toilets a passer-by can use:
//   - ~3,300 camp latrines mapped for humanitarian work (77% of all OSM toilets in Bangladesh)
//   - community pit latrines in low-income settlements (DhakaThrive survey)
//   - school / college / madrasa washrooms, and anything tagged private / customers-only
//
// - Skips anything within 25 m of a toilet already in the database, so it is safe to re-run.
// - Imported toilets are "Unverified", status unknown, credited to "OpenStreetMap", no photos.
// - Data © OpenStreetMap contributors, ODbL. The map already shows the OSM attribution.
const APPLY = process.argv.includes("--apply");
const INCLUDE_CAMPS = process.argv.includes("--include-camps");
const INCLUDE_COMMUNITY = process.argv.includes("--include-community-latrines");
const FROM_FILE = process.argv.includes("--from-file") ? process.argv[process.argv.indexOf("--from-file") + 1] : null;

// Kutupalong / Teknaf refugee camps (Ukhia & Teknaf upazilas), generous box.
const CAMPS = { minLat: 20.85, maxLat: 21.35, minLng: 92.0, maxLng: 92.35 };
const NOT_PUBLIC_NAME = /school|college|madras|university|class ?room|staff|teacher|boys|girls/i;
const OVERPASS = "https://overpass-api.de/api/interpreter";
const IMPORTER_DEVICE = "00000000-0000-4000-8000-0000000000f0"; // marks imported rows
const DUPLICATE_RADIUS_M = 25;
const BD = { minLat: 20.5, maxLat: 26.7, minLng: 88.0, maxLng: 92.7 };

const QUERY = `
[out:json][timeout:180];
area["ISO3166-1"="BD"][admin_level=2]->.bd;
( node["amenity"="toilets"](area.bd); way["amenity"="toilets"](area.bd); );
out center tags;`;

/** OSM tags → our toilet row. Returns null if unusable. */
export function toToilet(el) {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  if (lat < BD.minLat || lat > BD.maxLat || lng < BD.minLng || lng > BD.maxLng) return null;
  if (["private", "no", "customers", "permit"].includes(tags.access)) return null;
  const inCamps = lat >= CAMPS.minLat && lat <= CAMPS.maxLat && lng >= CAMPS.minLng && lng <= CAMPS.maxLng;
  if (inCamps && !INCLUDE_CAMPS) return null;
  if (tags.source === "DhakaThrive_Survey" && !INCLUDE_COMMUNITY) return null;
  if (NOT_PUBLIC_NAME.test(`${tags.name ?? ""} ${tags.description ?? ""}`)) return null;

  const yes = (k) => tags[k] === "yes";
  let gender = "unisex"; // OSM often doesn't say; "for everyone" is the least misleading default
  if (yes("unisex")) gender = "unisex";
  else if (yes("male") && yes("female")) gender = "separate";
  else if (yes("male")) gender = "male";
  else if (yes("female")) gender = "female";
  else if (yes("wheelchair")) gender = "accessible";

  const isPaid = tags.fee === "yes";
  const charge = isPaid ? Number.parseFloat(String(tags.charge ?? "").replace(/[^\d.]/g, "")) : NaN;

  const rawName = (tags.name || tags["name:en"] || tags["name:bn"] || "").trim();
  const name = (rawName.length >= 2 ? rawName : "Public toilet").slice(0, 120);

  return {
    osmId: `${el.type}/${el.id}`,
    name,
    location: `SRID=4326;POINT(${lng} ${lat})`,
    lat,
    lng,
    gender,
    is_paid: isPaid,
    price_bdt: Number.isFinite(charge) && charge >= 0 && charge <= 10000 ? charge : null,
    baby_changing: tags.changing_table === "yes" ? true : null,
    description: tags.description ? String(tags.description).slice(0, 1000) : null,
    opening_hours: tags.opening_hours ? { osm: tags.opening_hours } : null,
    author_name: "OpenStreetMap",
    device_id: IMPORTER_DEVICE,
    ip_hash: "osm-import",
  };
}

const MIRRORS = [OVERPASS, "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Queries Overpass, retrying with backoff and falling back to public mirrors when busy. */
async function fetchOsm() {
  let lastError;
  for (let attempt = 0; attempt < 6; attempt++) {
    const server = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(server, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ToiletFinderBD/1.0 (community toilet map)" },
        body: new URLSearchParams({ data: QUERY }),
        signal: AbortSignal.timeout(200_000),
      });
      if (res.ok) return (await res.json()).elements ?? [];
      lastError = new Error(`${new URL(server).host} ${res.status}`);
    } catch (err) {
      lastError = new Error(`${new URL(server).host}: ${err.message}`);
    }
    const wait = 2000 * 2 ** Math.floor(attempt / MIRRORS.length);
    console.log(`  ${lastError.message}; retrying in ${wait / 1000}s…`);
    await sleep(wait);
  }
  throw new Error(`Overpass unavailable: ${lastError?.message}`);
}

/** Great-circle distance in metres between two {lat, lng} points. */
function metres(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

const count = (rows, key) => rows.reduce((m, r) => ((m[r[key]] = (m[r[key]] ?? 0) + 1), m), {});

async function main() {
  console.log(APPLY ? "IMPORT MODE: will write to the database" : "DRY RUN: nothing will be written (add --apply to import)");
  const elements = FROM_FILE ? JSON.parse((await import("node:fs")).readFileSync(FROM_FILE, "utf8")) : await fetchOsm();
  const rows = elements.map(toToilet).filter(Boolean);
  console.log(`OpenStreetMap: ${elements.length} toilets in Bangladesh, ${rows.length} kept after filters.`);
  console.log("  gender:", count(rows, "gender"));
  console.log("  paid:  ", count(rows, "is_paid"));
  console.log("  named: ", rows.filter((r) => r.name !== "Public toilet").length);
  console.log("  sample:", rows.slice(0, 3).map((r) => `${r.name} (${r.gender}, ${r.is_paid ? "paid" : "free"}) @${r.lat.toFixed(4)},${r.lng.toFixed(4)}`));

  // Plain REST calls (works on Node 20; supabase-js needs Node 22's WebSocket).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Run with --env-file=.env.local (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)");
  const rest = async (path, init = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      ...init,
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
    });
    if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.status === 204 || res.headers.get("content-length") === "0" ? null : res.json();
  };

  // Skip toilets already in the database (anything within 25 m), including earlier imports.
  const existing = await rest("rpc/toilets_in_bbox", {
    method: "POST",
    body: JSON.stringify({ min_lng: BD.minLng, min_lat: BD.minLat, max_lng: BD.maxLng, max_lat: BD.maxLat, lim: 100000 }),
  });
  const near = (a, b) => metres(a, b) <= DUPLICATE_RADIUS_M;
  const fresh = [];
  for (const r of rows) {
    if (existing.some((e) => near(e, r)) || fresh.some((f) => near(f, r))) continue;
    fresh.push(r);
  }
  console.log(`Already in database: ${existing.length}. New (nothing within ${DUPLICATE_RADIUS_M} m): ${fresh.length}.`);

  if (!APPLY) {
    console.log("Dry run finished. Re-run with --apply to import.");
    return;
  }

  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    // Drop helper fields that aren't table columns.
    const batch = fresh.slice(i, i + 200).map((r) => {
      const row = { ...r };
      delete row.osmId;
      delete row.lat;
      delete row.lng;
      return row;
    });
    await rest("toilets", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(batch) });
    inserted += batch.length;
    console.log(`  inserted ${inserted}/${fresh.length}`);
  }
  console.log(`Done. Imported ${inserted} toilets from OpenStreetMap.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
