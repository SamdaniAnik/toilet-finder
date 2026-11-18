# Toilet Finder (Bangladesh) — Feature Plan

A community-driven map of public toilets in Bangladesh. **No login is needed.** Anyone can add a toilet with a photo, gender type and free/paid info, add more photos, update open/closed status, leave reviews and comments, see how far away each toilet is, and search. Contributors can type a name or stay **Anonymous**.

---

## 1. Decisions

| Question | Decision |
|---|---|
| Login | **Not required.** Every form has an optional "Your name" field; left blank, it shows "Anonymous". |
| Region | **Bangladesh only.** Map locked to BD, prices in ৳ (BDT), Bangla + English. |
| New toilets | **Appear on the map right away**, marked "Unverified" until other users confirm them. |
| Hosting | **Vercel**, same setup as expense-tracker. |

---

## 2. Tech Stack (same as expense-tracker)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Pages and API routes in one app, deployed to Vercel |
| Styling | **Tailwind CSS** | Mobile-first |
| Database | **Supabase Postgres + PostGIS extension** | Nearest-toilet and radius queries |
| Photo storage | **Supabase Storage** (public bucket `toilet-photos`) | |
| Map | **Leaflet + react-leaflet + OpenStreetMap tiles** | Free, no API key. Loaded client-only (`dynamic(..., { ssr: false })`) |
| Clustering | `react-leaflet-cluster` | |
| Place search | **Nominatim** with `countrycodes=bd` | Called from a Next.js route handler (proxy + cache) |
| Spam protection | **Cloudflare Turnstile** (free captcha) + rate limiting | Needed because there's no login |
| Image processing | Resize/compress in the browser before upload (`browser-image-compression`) | Keeps Vercel function payloads small. EXIF removed by re-encoding |
| Admin login | Supabase Auth (email), **admin only** | Normal users never log in |
| Testing | Vitest | Same as expense-tracker |

### Vercel notes
- Vercel functions have a ~4.5 MB request body limit, so **photos upload straight from the browser to Supabase Storage** using a signed upload URL issued by our API route. They never pass through Vercel.
- Environment variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server only), `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `IP_HASH_SALT`.
- All reads and writes go through Next.js route handlers that use the service-role key. Row Level Security (RLS) is on with **no public policies**, so the anon key can't touch tables directly and `device_id` / `ip_hash` stay private.

---

## 3. Identity without login

- **Optional name**: each add/review/comment/photo/status form has a "Your name (optional)" field. Blank means **"Anonymous"**. The last name used is saved in `localStorage` and pre-filled next time.
- **Device ID**: a random UUID generated on first visit and stored in `localStorage`. It's sent with every write and lets us:
  - allow **one review per device per toilet** (the device can edit it),
  - let the author edit or delete their own toilet, review or comment from the same device,
  - rate-limit per device.
- **IP hash**: the server stores `sha256(ip + IP_HASH_SALT)`, never the raw IP. Used for rate limits and banning abusers.
- The device ID can be cleared by the user, so it's for convenience, not security. Moderation (section 6) catches abuse.

---

## 4. Features

### Phase 1: MVP

#### 4.1 Map view
- Full-screen map centred on the user's location (browser Geolocation API).
- If location is denied or the user is outside Bangladesh, centre on Dhaka.
- Map limited to the **Bangladesh bounding box** (`maxBounds` ≈ lat 20.5–26.7, lng 88.0–92.7).
- Markers:
  - Colour = status (🟢 open, 🔴 closed, ⚪ unknown)
  - Badge = Free / ৳ Paid
  - Faded/dashed outline = Unverified
- Marker clustering when zoomed out.
- "Locate me" button.
- Loads only the toilets inside the visible map area (bounding-box query, debounced when the map moves).

#### 4.2 Add a toilet (no login)
- "+ Add Toilet" button. The user drags a pin (defaults to their current location). Points outside Bangladesh are rejected.
- Form:
  - **Name / landmark**, required (e.g. "Kamalapur Station, Platform 1").
  - **Gender**: Male (পুরুষ) / Female (মহিলা) / Unisex / Separate M & F / Accessible (♿).
  - **Cost**: Free / Paid, plus a **price in ৳** if paid.
  - **Photo(s)**: at least 1, up to 5. Camera capture on mobile.
  - **Status**: Open / Closed.
  - Optional: has water, soap, baby-changing, opening hours, notes.
  - **Your name (optional)**, otherwise "Anonymous".
  - Turnstile captcha.
- **Duplicate check**: if a toilet already exists within ~20 m, show it and ask "Is this the same one?"
- **Appears on the map immediately** as *Unverified*.

#### 4.3 Toilet detail (bottom sheet on mobile, side panel on desktop)
- Photo gallery.
- Name, gender, Free / ৳ price, status with "last updated X ago".
- **Distance from your location**, e.g. "350 m · ~5 min walk".
- "Directions" button that opens Google Maps (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`).
- Verified / Unverified badge with a **"✓ This toilet exists"** confirm button.
- Average rating, reviews and comments.
- "Added by Rahim" / "Added by Anonymous" and the date.
- Share link (`/toilet/[id]` page with Open Graph preview for Facebook/WhatsApp).
- 🚩 Report button.

#### 4.4 Photos from other users
- Anyone can add photos (optional name + captcha).
- Compressed in the browser (max ~1600 px, ~300 KB), uploaded directly to Supabase Storage.
- Each photo shows its uploader name or "Anonymous" and the date.
- Report button on each photo.

#### 4.5 Open / Closed status
- **"It's Open" / "It's Closed"** buttons, no login.
- One vote per device per toilet per 30 minutes.
- Display: "Closed · reported 2 h ago (3 reports)".
- Status older than 7 days shows as **Unknown**.
- Status history is kept.

#### 4.6 Reviews and comments
- **Review**: 1–5 stars, optional text, sub-ratings (Cleanliness, Water, Safety), optional name. One per device per toilet (editable from the same device).
- **Comments**: free thread with one level of replies, optional name.
- "Helpful 👍" on reviews (one per device).
- Report button on each review and comment.
- Basic bad-word filter (Bangla + English list).

#### 4.7 Distance
- Client side: Haversine distance from the user's location for the list and popups.
- Server side: PostGIS sorts the "Nearby" list.
- "Nearby" panel: nearest first, showing distance, status, free/paid and rating.
- Walking time estimate (~80 m/min).

#### 4.8 Search and filters
- **Place search**: Nominatim restricted to Bangladesh (e.g. "Mirpur 10", "Chittagong GEC"). The map flies there.
- **Toilet search**: by name or landmark (Postgres trigram `ILIKE`).
- **Filters**: Gender, Free only, Open now, Accessible, Verified only, Minimum rating, Radius (500 m / 1 km / 5 km).

#### 4.9 Language
- **Bangla / English** toggle (default from browser language). UI strings in `messages/bn.json` and `messages/en.json`.
- Numbers and prices formatted for the chosen language (৳১০ / ৳10).

---

### Phase 2: Trust and moderation (important without login)
- **Verification**: a toilet becomes *Verified* after **3 confirmations from different devices/IPs**, or when an admin approves it.
- **Auto-hide**: content gets hidden after **3 reports** from different devices until an admin reviews it.
- **Admin panel** at `/admin` (Supabase Auth, admin emails only):
  - reported content queue
  - newest toilets/photos feed
  - edit, delete, or merge duplicate toilets
  - ban a device ID or IP hash
- **Rate limits** (per IP hash + device, stored in a Postgres table or Upstash Redis):
  - add toilet: 5/day
  - photos: 20/day
  - reviews/comments: 30/day
  - status votes: 1 per toilet per 30 min
- **Suggest an edit**: anyone can propose a change to gender, price or hours. It's applied automatically after 2 matching suggestions, or by an admin.

### Phase 3: Nice-to-have
- PWA: installable, caches nearby toilets offline.
- Android app with Capacitor (same approach as expense-tracker).
- **Emergency button**: one tap jumps to the nearest *open* toilet with directions.
- Import existing toilets from OpenStreetMap (`amenity=toilets` in Bangladesh) as a seed script.
- Opening hours with automatic "Open now".
- Dark mode.
- Contributor leaderboard (by name).

---

## 5. Database Schema (Supabase / Postgres)

```sql
create extension if not exists postgis;
create extension if not exists pg_trgm;

create type gender_type as enum ('male','female','unisex','separate','accessible');
create type toilet_status as enum ('open','closed','unknown');

create table toilets (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  location        geography(point, 4326) not null,
  address         text,
  gender          gender_type not null,
  is_paid         boolean not null default false,
  price_bdt       numeric(8,2),
  current_status  toilet_status not null default 'unknown',
  status_updated_at timestamptz,
  has_water       boolean, has_soap boolean, baby_changing boolean,
  opening_hours   jsonb,
  avg_rating      numeric(2,1) default 0,
  review_count    int default 0,
  confirm_count   int default 0,
  is_verified     boolean default false,
  is_hidden       boolean default false,
  author_name     text,            -- null => "Anonymous"
  device_id       uuid not null,
  ip_hash         text not null,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  deleted_at      timestamptz
);
create index on toilets using gist (location);
create index on toilets using gin (name gin_trgm_ops);

create table toilet_photos (
  id uuid primary key default gen_random_uuid(),
  toilet_id uuid references toilets(id) on delete cascade,
  storage_path text not null,
  author_name text, device_id uuid not null, ip_hash text not null,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

create table status_updates (
  id bigserial primary key,
  toilet_id uuid references toilets(id) on delete cascade,
  status toilet_status not null,
  device_id uuid not null, ip_hash text not null,
  created_at timestamptz default now()
);

create table confirmations (
  toilet_id uuid references toilets(id) on delete cascade,
  device_id uuid not null, ip_hash text not null,
  created_at timestamptz default now(),
  primary key (toilet_id, device_id)
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  toilet_id uuid references toilets(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  cleanliness smallint, safety smallint, water smallint,
  text text,
  author_name text, device_id uuid not null, ip_hash text not null,
  helpful_count int default 0,
  is_hidden boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (toilet_id, device_id)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  toilet_id uuid references toilets(id) on delete cascade,
  parent_id uuid references comments(id) on delete cascade,
  text text not null,
  author_name text, device_id uuid not null, ip_hash text not null,
  is_hidden boolean default false,
  created_at timestamptz default now()
);

create table reports (
  id bigserial primary key,
  target_type text not null check (target_type in ('toilet','photo','review','comment')),
  target_id uuid not null,
  reason text not null,
  device_id uuid not null, ip_hash text not null,
  status text default 'open',   -- open | resolved | dismissed
  created_at timestamptz default now(),
  unique (target_type, target_id, device_id)
);

create table bans (
  id bigserial primary key,
  device_id uuid, ip_hash text, reason text,
  created_at timestamptz default now()
);
```

**RLS:** enable on all tables. Policy: `select` is allowed for `anon` where `is_hidden = false and deleted_at is null`. No insert/update/delete for `anon`; all writes go through API routes with the service role. `device_id` and `ip_hash` are left out of public views (`toilets_public` view).

**Nearby query (RPC function):**
```sql
create function nearby_toilets(lat float, lng float, radius_m int default 2000, lim int default 30)
returns table (id uuid, name text, distance_m float, ...) as $$
  select t.id, t.name, st_distance(t.location, st_makepoint(lng, lat)::geography) as distance_m, ...
  from toilets t
  where t.deleted_at is null and not t.is_hidden
    and st_dwithin(t.location, st_makepoint(lng, lat)::geography, radius_m)
  order by distance_m
  limit lim;
$$ language sql stable;
```
Plus `toilets_in_bbox(min_lng, min_lat, max_lng, max_lat, filters...)` for the map.

---

## 6. API Routes (Next.js route handlers)

Every write route: verify Turnstile → check ban → check rate limit → validate (zod) → write with the service role.

```
GET    /api/toilets?bbox=...&gender=&free=&open=&verified=&minRating=
GET    /api/toilets/nearby?lat=&lng=&radius=
GET    /api/toilets/search?q=
GET    /api/toilets/[id]
POST   /api/toilets                      { name, lat, lng, gender, isPaid, price, status, authorName?, photoPaths[] }
PATCH  /api/toilets/[id]                 (same device or admin)
POST   /api/toilets/[id]/confirm

POST   /api/uploads/sign                 → signed Supabase Storage upload URL
POST   /api/toilets/[id]/photos          { storagePath, authorName? }

POST   /api/toilets/[id]/status          { status }
GET    /api/toilets/[id]/status-history

GET    /api/toilets/[id]/reviews
POST   /api/toilets/[id]/reviews         (upsert by device)
POST   /api/reviews/[id]/helpful

GET    /api/toilets/[id]/comments
POST   /api/toilets/[id]/comments
DELETE /api/comments/[id]                (same device or admin)

POST   /api/reports
GET    /api/geocode?q=                   (Nominatim proxy, countrycodes=bd, cached)

/api/admin/*                             (Supabase Auth, admin emails only)
```

Headers sent from the client: `x-device-id`. The IP comes from the `x-forwarded-for` header on Vercel.

---

## 7. Screens

1. **Home / Map** (`/`): search bar, filter chips, map, "Nearby" bottom sheet, 🚨 Emergency button, "+ Add" button, "Locate me".
2. **Toilet detail** (`/toilet/[id]`): sheet over the map, plus a full shareable page with OG image.
3. **Add toilet** (`/add`): pin picker, then form, then photos, then optional name, then captcha.
4. **Admin** (`/admin`): login, report queue, recent items, bans.
5. **About / Rules** (`/about`): how it works, content rules.

Mobile-first. Most users will be on phones, often on slow networks: compress images, lazy-load the gallery, keep the JS bundle small.

---

## 8. Folder Structure

```
toilet-finder/
├── FEATURE_PLAN.md
├── supabase/
│   └── migrations/            # SQL above, RPC functions, RLS policies
├── scripts/
│   └── import-osm.ts          # Phase 3 seed
├── messages/
│   ├── bn.json
│   └── en.json
├── public/                    # marker icons, PWA icons
└── src/
    ├── app/
    │   ├── page.tsx           # map home
    │   ├── add/page.tsx
    │   ├── toilet/[id]/page.tsx
    │   ├── admin/...
    │   └── api/...            # route handlers (section 6)
    ├── components/            # Map, ToiletMarker, ToiletSheet, FilterBar, ReviewForm,
    │                          # PhotoUploader, NameField, Turnstile, StatusButtons…
    ├── hooks/                 # useGeolocation, useDeviceId, useToilets
    ├── lib/
    │   ├── supabase/          # browser + server clients
    │   ├── rateLimit.ts
    │   ├── turnstile.ts
    │   ├── ipHash.ts
    │   ├── geo.ts             # haversine, BD bounds check
    │   └── validation.ts      # zod schemas
    └── types/
```

---

## 9. Build Order (milestones)

| # | Milestone | Output |
|---|---|---|
| 1 | Setup | Next.js + Tailwind + TS, Supabase project with PostGIS, migrations, Vercel project linked to GitHub |
| 2 | Map | Leaflet map, geolocation, BD bounds, Dhaka fallback |
| 3 | Read API | bbox + nearby RPCs, markers, Nearby list with distance |
| 4 | Add toilet | Pin picker, form, optional name, device ID, Turnstile, direct photo upload, duplicate warning |
| 5 | Detail sheet | Gallery, info, directions, share page |
| 6 | Status + confirm | Open/closed votes, "exists" confirmations, verification |
| 7 | Reviews + comments | Ratings, aggregates, threads, helpful votes |
| 8 | Search + filters | Nominatim proxy, name search, filter chips |
| 9 | Abuse protection | Rate limits, reports, auto-hide, bans, bad-word filter |
| 10 | Admin panel | Supabase Auth admin, moderation queue |
| 11 | Bangla/English + polish | i18n, mobile UX, PWA, deploy to production |

---

## 10. Risks

- **Spam/fake toilets without login**: handled with Turnstile, rate limits, report auto-hide, verification badges and device/IP bans.
- **Inappropriate photos**: report + auto-hide after 3 reports. Later: automatic image moderation.
- **Nominatim usage policy** (max 1 request/sec, needs a proper User-Agent): proxy and cache through our API. Switch to a paid geocoder if traffic grows.
- **OSM tile usage policy**: fine for low traffic. Move to a tile provider (MapTiler/Stadia free tier) if it grows.
- **Supabase free tier** (500 MB DB, 1 GB storage): enough for launch. Browser-side compression keeps photo storage low.
