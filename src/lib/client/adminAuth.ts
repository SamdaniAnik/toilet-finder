"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readJson } from "./http";

let client: SupabaseClient | null = null;

/** Supabase client with a persisted auth session — used only for the admin sign-in. */
export function adminAuth(): SupabaseClient {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "tf.admin.auth" },
  });
  return client;
}

/** Calls an /api/admin endpoint with the current session's access token. */
export async function adminFetch<T extends object>(url: string, init: RequestInit = {}): Promise<T> {
  const { data } = await adminAuth().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Please sign in.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  const body = await readJson<T>(res);
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}
