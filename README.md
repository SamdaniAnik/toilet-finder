# Toilet Finder (Bangladesh)

Community map of public toilets in Bangladesh. No login: anyone can add toilets, photos, status, reviews and comments, with an optional name or "Anonymous". See [FEATURE_PLAN.md](FEATURE_PLAN.md).

**Stack:** Next.js (App Router) · Tailwind · Supabase (Postgres + PostGIS + Storage) · Leaflet/OpenStreetMap · Vercel

## Setup

1. **Supabase project**: create one at [supabase.com](https://supabase.com) (region: Singapore is closest to BD).
2. **Database**: open *SQL Editor*, paste [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), and run it. This creates the tables, triggers, query functions and the `toilet-photos` storage bucket.
3. **Env vars**: fill in `.env.local` (template: [`.env.example`](.env.example)):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` from *Project Settings → API*
   - `IP_HASH_SALT`: any long random string
4. **Run**:
   ```bash
   npm install
   npm run dev
   ```
   Check http://localhost:3000/api/health. It should return `{"ok":true,"toilets":0}`.

## Deploy (Vercel)

1. Push to GitHub, then import the repo in Vercel.
2. Add the same env vars under *Project → Settings → Environment Variables*.
3. Deploy, then open `/api/health` on the live URL.

## Scripts

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest) |
| `npm run lint` | ESLint |

## Moderation

- Anyone can 🚩 report a toilet, photo, review or comment (one report per device per item).
- An item is **hidden automatically** after reports from 3 different devices on at least 2 different networks.
- Admins review everything at **`/admin`**: Keep (unhide and dismiss reports), Hide, Delete, or Ban author. Bans are by device only: many mobile users in Bangladesh share one IP, so IP bans would block innocent people.

**Set up an admin account:**
1. Supabase → *Authentication → Users → Add user → Create new user*: enter your email and a strong password, and tick *Auto Confirm User*.
2. Add `ADMIN_EMAILS=you@example.com` (comma-separated for several) to `.env.local` and to Vercel's environment variables, then redeploy.
3. Sign in at `/admin`.

## Security model

RLS is enabled on every table with **no public policies**. The browser never talks to tables directly; all reads and writes go through Next.js route handlers using the service-role key. That keeps visitor `device_id` / `ip_hash` private. Photos are served from a public storage bucket.
