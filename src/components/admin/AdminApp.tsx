"use client";

import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Stars } from "@/components/ui/Stars";
import { adminAuth, adminFetch } from "@/lib/client/adminAuth";
import { timeAgo } from "@/lib/time";
import type { ModerationItem, ModerationQueue } from "@/types/admin";

type Tab = "reports" | "recent";
type Action = "keep" | "hide" | "delete" | "ban";

const TYPE_LABEL: Record<ModerationItem["targetType"], string> = {
  toilet: "🚻 Toilet",
  photo: "📷 Photo",
  review: "★ Review",
  comment: "💬 Comment",
};

const REASON_LABEL: Record<string, string> = {
  not_exist: "Doesn't exist",
  wrong_info: "Wrong / misleading",
  inappropriate: "Inappropriate",
  spam: "Spam",
  other: "Other",
};

function reasonText(raw: string): string {
  const [code, ...rest] = raw.split(": ");
  const label = REASON_LABEL[code] ?? code;
  return rest.length ? `${label}: “${rest.join(": ")}”` : label;
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error: e } = await adminAuth().auth.signInWithPassword({ email: email.trim(), password });
    if (e) setError(e.message === "Invalid login credentials" ? "Wrong email or password." : e.message);
    setBusy(false);
  };

  return (
    <form
      className="mx-auto mt-16 max-w-sm space-y-4 px-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <h1 className="text-2xl font-semibold">Admin sign in</h1>
      <input
        type="email"
        autoComplete="username"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-blue-600"
      />
      <input
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-blue-600"
      />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:bg-zinc-400">
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <Link href="/" className="block text-center text-sm text-zinc-500">
        ← Back to map
      </Link>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Queue item
// ---------------------------------------------------------------------------
function ItemCard({ item, onAction }: { item: ModerationItem; onAction: (item: ModerationItem, a: Action) => Promise<void> }) {
  const [busy, setBusy] = useState<Action | null>(null);

  const act = async (a: Action) => {
    if (a === "delete" && !confirm(`Delete this ${item.targetType}? This can't be undone.`)) return;
    if (a === "ban" && !confirm("Ban the device that posted this? They won't be able to post anything again.")) return;
    setBusy(a);
    await onAction(item, a);
    setBusy(null);
  };

  const btn = (a: Action, label: string, cls: string) => (
    <button type="button" disabled={busy !== null} onClick={() => act(a)} className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${cls}`}>
      {busy === a ? "…" : label}
    </button>
  );

  return (
    <li className="space-y-2 rounded-2xl border border-zinc-200 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-semibold">{TYPE_LABEL[item.targetType]}</span>
        {item.reportCount > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-800">
            🚩 {item.reportCount} report{item.reportCount > 1 ? "s" : ""}
          </span>
        )}
        {item.isHidden && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900">Hidden</span>}
        {item.missing && <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-semibold">Deleted</span>}
        {item.createdAt && <span className="text-zinc-500">posted {timeAgo(item.createdAt)}</span>}
      </div>

      {item.photoUrl && (
        <a href={item.photoUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Supabase photo */}
          <img src={item.photoUrl} alt="Reported photo" className="max-h-60 rounded-xl object-cover" loading="lazy" />
        </a>
      )}
      {item.rating != null && <Stars value={item.rating} size="text-sm" />}
      {item.text && <p className="whitespace-pre-line text-sm">{item.text}</p>}

      <p className="text-sm text-zinc-600">
        {item.toiletName ? (
          <>
            {item.targetType === "toilet" ? "" : "On "}
            {item.toiletId && !item.missing ? (
              <Link href={`/toilet/${item.toiletId}`} target="_blank" className="font-medium text-blue-700 underline">
                {item.toiletName}
              </Link>
            ) : (
              <span className="font-medium">{item.toiletName}</span>
            )}
          </>
        ) : (
          "Unknown toilet"
        )}
        {" · by "}
        {item.authorName ?? "Anonymous"}
      </p>

      {item.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-red-900">
          {item.reasons.slice(0, 5).map((r, i) => (
            <li key={i}>{reasonText(r)}</li>
          ))}
        </ul>
      )}

      {!item.missing && (
        <div className="flex flex-wrap gap-2 pt-1">
          {btn("keep", item.reportCount > 0 ? "✓ Keep" : item.isHidden ? "✓ Unhide" : "✓ OK", "bg-green-100 text-green-900")}
          {!item.isHidden && btn("hide", "Hide", "bg-amber-100 text-amber-900")}
          {btn("delete", "Delete", "bg-red-100 text-red-900")}
          {btn("ban", "Ban author", "bg-zinc-900 text-white")}
        </div>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function Dashboard({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("reports");
  const [items, setItems] = useState<ModerationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (t: Tab) => {
    setError(null);
    try {
      const data = await adminFetch<ModerationQueue>(`/api/admin/queue?tab=${t}`);
      setItems(data.items);
    } catch (err) {
      setError((err as Error).message);
      setItems([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on tab change
    void load(tab);
  }, [tab, load]);

  const onAction = async (item: ModerationItem, action: Action) => {
    try {
      await adminFetch("/api/admin/moderate", {
        method: "POST",
        body: JSON.stringify({ targetType: item.targetType, targetId: item.targetId, action }),
      });
      await load(tab);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Moderation</h1>
          <p className="text-xs text-zinc-500">{email}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-blue-700">
            Map
          </Link>
          <button type="button" onClick={() => adminAuth().auth.signOut()} className="text-zinc-600">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex gap-2">
        {(["reports", "recent"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setItems(null);
              setTab(t);
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === t ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-800"}`}
          >
            {t === "reports" ? "🚩 Reports" : "🆕 Recent"}
          </button>
        ))}
        <button type="button" onClick={() => load(tab)} className="ml-auto text-sm text-zinc-600">
          ↻ Refresh
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {items === null && <p className="text-zinc-500">Loading…</p>}
      {items?.length === 0 && !error && (
        <p className="rounded-2xl bg-zinc-50 p-6 text-center text-zinc-600">
          {tab === "reports" ? "🎉 No open reports." : "Nothing posted yet."}
        </p>
      )}
      <ul className="space-y-3">
        {items?.map((item) => (
          <ItemCard key={`${item.targetType}:${item.targetId}`} item={item} onAction={onAction} />
        ))}
      </ul>
    </div>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const auth = adminAuth().auth;
    void auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <p className="p-6 text-zinc-500">Loading…</p>;
  if (!session) return <SignIn />;
  return <Dashboard email={session.user.email ?? ""} />;
}
