"use client";

import { useState } from "react";
import Turnstile from "@/components/Turnstile";
import NameField from "@/components/ui/NameField";
import { StarInput, Stars } from "@/components/ui/Stars";
import { postJson, useCaptchaSubmit } from "@/components/ui/useCaptchaSubmit";
import { getSavedName, saveName } from "@/lib/client/visitor";
import { timeAgo } from "@/lib/time";
import type { Review, ToiletDetail } from "@/types/toilet";

function ReviewForm({ toiletId, mine, onDone }: { toiletId: string; mine: Review | undefined; onDone: () => void }) {
  const [rating, setRating] = useState<number | null>(mine?.rating ?? null);
  const [cleanliness, setCleanliness] = useState<number | null>(mine?.cleanliness ?? null);
  const [text, setText] = useState(mine?.text ?? "");
  const [authorName, setAuthorName] = useState(() => mine?.authorName ?? getSavedName());
  const s = useCaptchaSubmit();

  const submit = async () => {
    const ok = await s.run((token) =>
      postJson(`/api/toilets/${toiletId}/reviews`, {
        rating,
        cleanliness: cleanliness ?? undefined,
        text: text.trim() || undefined,
        authorName: authorName.trim() || undefined,
        turnstileToken: token,
      }),
    );
    if (ok) {
      saveName(authorName);
      onDone();
    }
  };

  return (
    <form
      className="space-y-4 rounded-2xl border border-zinc-200 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div>
        <p className="mb-1 text-sm font-semibold">Overall</p>
        <StarInput value={rating} onChange={setRating} label="Overall rating" />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">
          Cleanliness <span className="font-normal text-zinc-500">(optional)</span>
        </p>
        <StarInput value={cleanliness} onChange={setCleanliness} label="Cleanliness rating" size="text-2xl" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="How was it? Clean, water, safe at night…"
        className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-blue-600"
      />
      <NameField value={authorName} onChange={setAuthorName} />
      <Turnstile onToken={s.setToken} resetKey={s.captchaReset} />
      {s.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{s.error}</p>}
      <button
        type="submit"
        disabled={!rating || !s.token || s.busy}
        className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:bg-zinc-400"
      >
        {s.progress ?? (mine ? "Update review" : "Post review")}
      </button>
      {!rating && <p className="-mt-2 text-center text-xs text-zinc-500">Tap the stars to rate</p>}
    </form>
  );
}

export default function ReviewSection({ toilet, onChanged }: { toilet: ToiletDetail; onChanged: () => void }) {
  const mine = toilet.reviews.find((r) => r.isMine);
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {toilet.reviewCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-zinc-600">
            <Stars value={toilet.avgRating} /> {toilet.avgRating.toFixed(1)} ({toilet.reviewCount})
          </span>
        )}
      </div>

      {open ? (
        <ReviewForm
          toiletId={toilet.id}
          mine={mine}
          onDone={() => {
            setOpen(false);
            onChanged();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border-2 border-blue-600 py-2.5 font-semibold text-blue-700"
        >
          {mine ? "✏️ Edit your review" : "★ Write a review"}
        </button>
      )}

      {toilet.reviews.length === 0 && !open && <p className="text-sm text-zinc-500">No reviews yet. Be the first!</p>}
      <ul className="divide-y divide-zinc-100">
        {toilet.reviews.map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {r.authorName ?? "Anonymous"}
                {r.isMine && <span className="ml-1 text-xs font-normal text-blue-700">(you)</span>}
              </span>
              <span className="text-xs text-zinc-500">{timeAgo(r.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Stars value={r.rating} size="text-sm" />
              {r.cleanliness != null && <span className="text-zinc-500">Cleanliness {r.cleanliness}/5</span>}
            </div>
            {r.text && <p className="mt-1 whitespace-pre-line text-sm text-zinc-800">{r.text}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
