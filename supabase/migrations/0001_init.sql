-- Toilet Finder (Bangladesh) — initial schema
-- Run in Supabase SQL editor (or `supabase db push`).
--
-- Security model: RLS is ON for every table with NO policies for anon/authenticated,
-- so the public anon key can't read or write tables directly. All reads and writes
-- go through Next.js route handlers using the service-role key, which keeps
-- device_id / ip_hash private. Photos are served from a public storage bucket.

create extension if not exists postgis;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  create type gender_type as enum ('male', 'female', 'unisex', 'separate', 'accessible');
exception when duplicate_object then null; end $$;

do $$ begin
  create type toilet_status as enum ('open', 'closed', 'unknown');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists toilets (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (char_length(name) between 2 and 120),
  description       text check (char_length(description) <= 1000),
  location          geography(point, 4326) not null,
  address           text,
  gender            gender_type not null,
  is_paid           boolean not null default false,
  price_bdt         numeric(8, 2) check (price_bdt is null or price_bdt >= 0),
  current_status    toilet_status not null default 'unknown',
  status_updated_at timestamptz,
  has_water         boolean,
  has_soap          boolean,
  baby_changing     boolean,
  opening_hours     jsonb,
  avg_rating        numeric(2, 1) not null default 0,
  review_count      int not null default 0,
  confirm_count     int not null default 0,
  is_verified       boolean not null default false,
  is_hidden         boolean not null default false,
  author_name       text check (char_length(author_name) <= 60), -- null => "Anonymous"
  device_id         uuid not null,
  ip_hash           text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  -- Bangladesh bounding box
  constraint toilets_in_bangladesh check (
    st_y(location::geometry) between 20.5 and 26.7
    and st_x(location::geometry) between 88.0 and 92.7
  )
);
create index if not exists toilets_location_idx on toilets using gist (location);
create index if not exists toilets_name_trgm_idx on toilets using gin (name gin_trgm_ops);

create table if not exists toilet_photos (
  id           uuid primary key default gen_random_uuid(),
  toilet_id    uuid not null references toilets (id) on delete cascade,
  storage_path text not null,
  author_name  text check (char_length(author_name) <= 60),
  device_id    uuid not null,
  ip_hash      text not null,
  is_hidden    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists toilet_photos_toilet_idx on toilet_photos (toilet_id, created_at);

create table if not exists status_updates (
  id         bigserial primary key,
  toilet_id  uuid not null references toilets (id) on delete cascade,
  status     toilet_status not null check (status <> 'unknown'),
  device_id  uuid not null,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists status_updates_toilet_idx on status_updates (toilet_id, created_at desc);

create table if not exists confirmations (
  toilet_id  uuid not null references toilets (id) on delete cascade,
  device_id  uuid not null,
  ip_hash    text not null,
  created_at timestamptz not null default now(),
  primary key (toilet_id, device_id)
);

create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  toilet_id     uuid not null references toilets (id) on delete cascade,
  rating        smallint not null check (rating between 1 and 5),
  cleanliness   smallint check (cleanliness between 1 and 5),
  safety        smallint check (safety between 1 and 5),
  water         smallint check (water between 1 and 5),
  text          text check (char_length(text) <= 2000),
  author_name   text check (char_length(author_name) <= 60),
  device_id     uuid not null,
  ip_hash       text not null,
  helpful_count int not null default 0,
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (toilet_id, device_id)
);

create table if not exists review_helpful (
  review_id  uuid not null references reviews (id) on delete cascade,
  device_id  uuid not null,
  created_at timestamptz not null default now(),
  primary key (review_id, device_id)
);

create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  toilet_id   uuid not null references toilets (id) on delete cascade,
  parent_id   uuid references comments (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 1000),
  author_name text check (char_length(author_name) <= 60),
  device_id   uuid not null,
  ip_hash     text not null,
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists comments_toilet_idx on comments (toilet_id, created_at);

create table if not exists reports (
  id          bigserial primary key,
  target_type text not null check (target_type in ('toilet', 'photo', 'review', 'comment')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) <= 500),
  device_id   uuid not null,
  ip_hash     text not null,
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, device_id)
);

create table if not exists bans (
  id         bigserial primary key,
  device_id  uuid,
  ip_hash    text,
  reason     text,
  created_at timestamptz not null default now(),
  check (device_id is not null or ip_hash is not null)
);

-- Rate-limit log: one row per write action; old rows can be purged daily.
create table if not exists rate_events (
  id         bigserial primary key,
  action     text not null,
  device_id  uuid not null,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_lookup_idx on rate_events (action, ip_hash, created_at desc);
create index if not exists rate_events_device_idx on rate_events (action, device_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: enabled, no policies (service role bypasses RLS)
-- ---------------------------------------------------------------------------
alter table toilets        enable row level security;
alter table toilet_photos  enable row level security;
alter table status_updates enable row level security;
alter table confirmations  enable row level security;
alter table reviews        enable row level security;
alter table review_helpful enable row level security;
alter table comments       enable row level security;
alter table reports        enable row level security;
alter table bans           enable row level security;
alter table rate_events    enable row level security;

-- ---------------------------------------------------------------------------
-- Triggers: keep aggregates on toilets in sync
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists toilets_touch on toilets;
create trigger toilets_touch before update on toilets
  for each row execute function touch_updated_at();

drop trigger if exists reviews_touch on reviews;
create trigger reviews_touch before update on reviews
  for each row execute function touch_updated_at();

-- Reviews -> avg_rating, review_count
create or replace function refresh_toilet_rating() returns trigger language plpgsql as $$
declare
  tid uuid := coalesce(new.toilet_id, old.toilet_id);
begin
  update toilets t set
    avg_rating   = coalesce((select round(avg(rating)::numeric, 1) from reviews
                             where toilet_id = tid and not is_hidden), 0),
    review_count = (select count(*) from reviews where toilet_id = tid and not is_hidden)
  where t.id = tid;
  return null;
end $$;

drop trigger if exists reviews_refresh_rating on reviews;
create trigger reviews_refresh_rating after insert or update or delete on reviews
  for each row execute function refresh_toilet_rating();

-- Status updates -> current_status
create or replace function apply_status_update() returns trigger language plpgsql as $$
begin
  update toilets set current_status = new.status, status_updated_at = new.created_at
  where id = new.toilet_id;
  return null;
end $$;

drop trigger if exists status_updates_apply on status_updates;
create trigger status_updates_apply after insert on status_updates
  for each row execute function apply_status_update();

-- Confirmations -> confirm_count, is_verified (3 distinct devices)
create or replace function apply_confirmation() returns trigger language plpgsql as $$
declare
  n int;
begin
  select count(*) into n from confirmations where toilet_id = new.toilet_id;
  update toilets set confirm_count = n, is_verified = is_verified or n >= 3
  where id = new.toilet_id;
  return null;
end $$;

drop trigger if exists confirmations_apply on confirmations;
create trigger confirmations_apply after insert on confirmations
  for each row execute function apply_confirmation();

-- Helpful votes -> helpful_count
create or replace function apply_helpful() returns trigger language plpgsql as $$
begin
  update reviews set helpful_count = (select count(*) from review_helpful where review_id = new.review_id)
  where id = new.review_id;
  return null;
end $$;

drop trigger if exists review_helpful_apply on review_helpful;
create trigger review_helpful_apply after insert on review_helpful
  for each row execute function apply_helpful();

-- ---------------------------------------------------------------------------
-- Read functions (called by API routes via supabase.rpc)
-- ---------------------------------------------------------------------------
create or replace function toilets_in_bbox(
  min_lng float, min_lat float, max_lng float, max_lat float, lim int default 500
)
returns table (
  id uuid, name text, lat float, lng float, gender gender_type, is_paid boolean,
  price_bdt numeric, current_status toilet_status, status_updated_at timestamptz,
  avg_rating numeric, review_count int, is_verified boolean, cover_photo text
)
language sql stable as $$
  select t.id, t.name, st_y(t.location::geometry), st_x(t.location::geometry),
         t.gender, t.is_paid, t.price_bdt, t.current_status, t.status_updated_at,
         t.avg_rating, t.review_count, t.is_verified,
         (select p.storage_path from toilet_photos p
           where p.toilet_id = t.id and not p.is_hidden
           order by p.created_at limit 1)
  from toilets t
  where t.deleted_at is null and not t.is_hidden
    and t.location && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)::geography
  limit lim;
$$;

create or replace function nearby_toilets(
  lat float, lng float, radius_m int default 2000, lim int default 30
)
returns table (
  id uuid, name text, lat float, lng float, gender gender_type, is_paid boolean,
  price_bdt numeric, current_status toilet_status, status_updated_at timestamptz,
  avg_rating numeric, review_count int, is_verified boolean, cover_photo text,
  distance_m float
)
language sql stable as $$
  select t.id, t.name, st_y(t.location::geometry), st_x(t.location::geometry),
         t.gender, t.is_paid, t.price_bdt, t.current_status, t.status_updated_at,
         t.avg_rating, t.review_count, t.is_verified,
         (select p.storage_path from toilet_photos p
           where p.toilet_id = t.id and not p.is_hidden
           order by p.created_at limit 1),
         st_distance(t.location, st_makepoint(lng, lat)::geography)
  from toilets t
  where t.deleted_at is null and not t.is_hidden
    and st_dwithin(t.location, st_makepoint(lng, lat)::geography, radius_m)
  order by t.location <-> st_makepoint(lng, lat)::geography
  limit lim;
$$;

-- Toilets within `radius_m` of a point (duplicate check when adding)
create or replace function toilets_near_point(lat float, lng float, radius_m int default 20)
returns table (id uuid, name text, distance_m float)
language sql stable as $$
  select t.id, t.name, st_distance(t.location, st_makepoint(lng, lat)::geography)
  from toilets t
  where t.deleted_at is null and not t.is_hidden
    and st_dwithin(t.location, st_makepoint(lng, lat)::geography, radius_m)
  order by 3;
$$;

create or replace function search_toilets(q text, lim int default 20)
returns table (id uuid, name text, lat float, lng float, gender gender_type, is_paid boolean)
language sql stable as $$
  select t.id, t.name, st_y(t.location::geometry), st_x(t.location::geometry), t.gender, t.is_paid
  from toilets t
  where t.deleted_at is null and not t.is_hidden and t.name ilike '%' || q || '%'
  order by similarity(t.name, q) desc
  limit lim;
$$;

-- Only the service role may call these (anon key can't read device data through them anyway,
-- but keep the surface closed).
revoke execute on function toilets_in_bbox(float, float, float, float, int) from anon, authenticated;
revoke execute on function nearby_toilets(float, float, int, int) from anon, authenticated;
revoke execute on function toilets_near_point(float, float, int) from anon, authenticated;
revoke execute on function search_toilets(text, int) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for photos (uploads use signed URLs from the server)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('toilet-photos', 'toilet-photos', true, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;
