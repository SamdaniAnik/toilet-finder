"use client";

import { useState } from "react";
import Turnstile from "@/components/Turnstile";
import NameField from "@/components/ui/NameField";
import { postJson, useCaptchaSubmit } from "@/components/ui/useCaptchaSubmit";
import { useT } from "@/i18n/LanguageProvider";
import { getSavedName, saveName } from "@/lib/client/visitor";
import { ago } from "@/lib/time";
import type { ToiletDetail } from "@/types/toilet";
import ReportButton from "./ReportButton";

export default function CommentSection({ toilet, onChanged }: { toilet: ToiletDetail; onChanged: () => void }) {
  const [text, setText] = useState("");
  const [authorName, setAuthorName] = useState(getSavedName);
  const [writing, setWriting] = useState(false);
  const t = useT();
  const s = useCaptchaSubmit();

  const submit = async () => {
    const ok = await s.run((token) =>
      postJson(`/api/toilets/${toilet.id}/comments`, {
        text: text.trim(),
        authorName: authorName.trim() || undefined,
        turnstileToken: token,
      }),
    );
    if (ok) {
      saveName(authorName);
      setText("");
      setWriting(false);
      onChanged();
    }
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">
        {t.comments.title} {toilet.comments.length > 0 && <span className="text-zinc-500">({t.num.int(toilet.comments.length)})</span>}
      </h2>

      {toilet.comments.length === 0 && <p className="text-sm text-zinc-500">{t.comments.none}</p>}
      <ul className="space-y-2">
        {toilet.comments.map((c) => (
          <li key={c.id} className="rounded-xl bg-zinc-100 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">
                {c.authorName ?? t.common.anonymous}
                {c.isMine && <span className="ml-1 font-normal text-blue-700">{t.common.you}</span>}
              </span>
              <span>{ago(c.createdAt, t.locale)}</span>
            </div>
            <p className="whitespace-pre-line text-sm text-zinc-900">{c.text}</p>
            {!c.isMine && <ReportButton targetType="comment" targetId={c.id} onReported={onChanged} />}
          </li>
        ))}
      </ul>

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setWriting(true)}
          maxLength={1000}
          rows={writing ? 3 : 1}
          placeholder={t.comments.placeholder}
          className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-base outline-none focus:border-blue-600"
        />
        {writing && (
          <>
            <NameField value={authorName} onChange={setAuthorName} />
            <Turnstile onToken={s.setToken} resetKey={s.captchaReset} />
            {s.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{s.error}</p>}
            <button
              type="submit"
              disabled={!text.trim() || !s.token || s.busy}
              className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white disabled:bg-zinc-400"
            >
              {s.progress ?? t.comments.post}
            </button>
          </>
        )}
      </form>
    </section>
  );
}
