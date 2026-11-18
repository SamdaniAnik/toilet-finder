"use client";

import { useState } from "react";
import { errorText, postJson } from "@/components/ui/useCaptchaSubmit";
import { useT } from "@/i18n/LanguageProvider";
import type { ReportReason, ReportTarget } from "@/lib/validation";

/** Small "Report" link that opens a reason picker in a bottom sheet. */
export default function ReportButton({
  targetType,
  targetId,
  className = "",
  onReported,
}: {
  targetType: ReportTarget;
  targetId: string;
  className?: string;
  /** Called after a successful report (the item may now be hidden). */
  onReported?: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/reports", { targetType, targetId, reason, details: details.trim() || undefined });
      setDone(true);
      setOpen(false);
      onReported?.();
    } catch (err) {
      setError(errorText(err, t));
    } finally {
      setBusy(false);
    }
  };

  if (done) return <span className={`text-xs text-zinc-500 ${className}`}>{t.report.done}</span>;

  const title = t.report.title(t.report.noun[targetType]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`text-xs text-zinc-500 underline-offset-2 hover:underline ${className}`}>
        {t.report.link}
      </button>

      {open && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 text-zinc-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="text-sm text-zinc-600">{t.report.hint}</p>
            <div className="space-y-2">
              {t.report.reasons[targetType].map((r) => (
                <label
                  key={r.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${reason === r.value ? "border-blue-600 bg-blue-50" : "border-zinc-200"}`}
                >
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-blue-600" />
                  <span className="text-sm">{r.label}</span>
                </label>
              ))}
            </div>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder={t.report.details}
              className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-base outline-none focus:border-blue-600"
            />
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-zinc-300 py-3 font-medium">
                {t.common.cancel}
              </button>
              <button type="button" disabled={!reason || busy} onClick={submit} className="rounded-xl bg-red-600 py-3 font-semibold text-white disabled:bg-zinc-400">
                {busy ? t.common.sending : t.report.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
