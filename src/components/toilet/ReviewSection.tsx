"use client";

import { useState } from "react";
import Turnstile from "@/components/Turnstile";
import NameField from "@/components/ui/NameField";
import { StarInput, Stars } from "@/components/ui/Stars";
import { errorText, postJson, useCaptchaSubmit } from "@/components/ui/useCaptchaSubmit";
import { useT } from "@/i18n/LanguageProvider";
import { getSavedName, saveName } from "@/lib/client/visitor";
import { ago } from "@/lib/time";
import type { Review, ToiletDetail } from "@/types/toilet";
import ReportButton from "./ReportButton";

function ReviewForm({ toiletId, mine, onDone }: { toiletId: string; mine: Review | undefined; onDone: () => void }) {
  const [rating, setRating] = useState<number | null>(mine?.rating ?? null);
  const [cleanliness, setCleanliness] = useState<number | null>(mine?.cleanliness ?? null);
  const [text, setText] = useState(mine?.text ?? "");
  const [authorName, setAuthorName] = useState(() => mine?.authorName ?? getSavedName());
  const t = useT();
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
        <p className="mb-1 text-sm font-semibold">{t.reviews.overall}</p>
        <StarInput value={rating} onChange={setRating} label={t.reviews.overallLabel} />
      </div>
      <div>
        <p className="mb-1 text-sm font-semibold">
          {t.reviews.cleanliness} <span className="font-normal text-zinc-500">{t.common.optional}</span>
        </p>
        <StarInput value={cleanliness} onChange={setCleanliness} label={t.reviews.cleanlinessLabel} size="text-2xl" />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder={t.reviews.placeholder}
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
        {s.progress ?? (mine ? t.reviews.update : t.reviews.post)}
      </button>
      {!rating && <p className="-mt-2 text-center text-xs text-zinc-500">{t.reviews.tapStars}</p>}
    </form>
  );
}

/** "👍 Helpful" vote. Your own reviews just show the count. */
function HelpfulButton({ review, onVoted }: { review: Review; onVoted: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (review.isMine) {
    return review.helpfulCount > 0 ? <span className="text-xs text-zinc-500">{t.reviews.helpful(review.helpfulCount)}</span> : null;
  }
  if (review.votedHelpful) {
    return <span className="text-xs font-medium text-blue-700">{t.reviews.votedHelpful(review.helpfulCount)}</span>;
  }

  const vote = async () => {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/reviews/${review.id}/helpful`, {});
      onVoted();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={vote}
        className="rounded-full border border-zinc-300 px-2.5 py-0.5 text-xs font-medium text-zinc-700 disabled:opacity-50"
      >
        {t.reviews.helpful(review.helpfulCount)}
      </button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </>
  );
}

export default function ReviewSection({ toilet, onChanged }: { toilet: ToiletDetail; onChanged: () => void }) {
  const t = useT();
  const mine = toilet.reviews.find((r) => r.isMine);
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.reviews.title}</h2>
        {toilet.reviewCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-zinc-600">
            <Stars value={toilet.avgRating} /> {t.num.one(toilet.avgRating)} ({t.num.int(toilet.reviewCount)})
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
          {mine ? t.reviews.edit : t.reviews.write}
        </button>
      )}

      {toilet.reviews.length === 0 && !open && <p className="text-sm text-zinc-500">{t.reviews.none}</p>}
      <ul className="divide-y divide-zinc-100">
        {toilet.reviews.map((r) => (
          <li key={r.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {r.authorName ?? t.common.anonymous}
                {r.isMine && <span className="ml-1 text-xs font-normal text-blue-700">{t.common.you}</span>}
              </span>
              <span className="text-xs text-zinc-500">{ago(r.updatedAt, t.locale)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Stars value={r.rating} size="text-sm" />
              {r.cleanliness != null && <span className="text-zinc-500">{t.reviews.cleanlinessScore(r.cleanliness)}</span>}
            </div>
            {r.text && <p className="mt-1 whitespace-pre-line text-sm text-zinc-800">{r.text}</p>}
            <div className="mt-1.5 flex items-center gap-3">
              <HelpfulButton review={r} onVoted={onChanged} />
              {!r.isMine && <ReportButton targetType="review" targetId={r.id} onReported={onChanged} />}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
