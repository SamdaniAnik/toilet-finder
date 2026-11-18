"use client";

import { useState } from "react";
import { postJson } from "@/components/ui/useCaptchaSubmit";
import type { ReportReason, ReportTarget } from "@/lib/validation";

const REASONS: Record<ReportTarget, { value: ReportReason; label: string }[]> = {
  toilet: [
    { value: "not_exist", label: "Doesn't exist / permanently closed" },
    { value: "wrong_info", label: "Wrong location or details" },
    { value: "inappropriate", label: "Offensive or inappropriate" },
    { value: "spam", label: "Spam or fake" },
    { value: "other", label: "Something else" },
  ],
  photo: [
    { value: "inappropriate", label: "Offensive or inappropriate" },
    { value: "wrong_info", label: "Not a photo of this toilet" },
    { value: "spam", label: "Spam or advert" },
    { value: "other", label: "Something else" },
  ],
  review: [
    { value: "inappropriate", label: "Offensive or abusive" },
    { value: "wrong_info", label: "False or misleading" },
    { value: "spam", label: "Spam or advert" },
    { value: "other", label: "Something else" },
  ],
  comment: [
    { value: "inappropriate", label: "Offensive or abusive" },
    { value: "wrong_info", label: "False or misleading" },
    { value: "spam", label: "Spam or advert" },
    { value: "other", label: "Something else" },
  ],
};

const NOUN: Record<ReportTarget, string> = { toilet: "toilet", photo: "photo", review: "review", comment: "comment" };

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
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) return <span className={`text-xs text-zinc-500 ${className}`}>Reported, thanks</span>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`text-xs text-zinc-500 underline-offset-2 hover:underline ${className}`}>
        🚩 Report
      </button>

      {open && (
        <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Report this ${NOUN[targetType]}`}
            className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 text-zinc-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Report this {NOUN[targetType]}</h2>
            <p className="text-sm text-zinc-600">
              It will be hidden if several people report it, and an admin will review it.
            </p>
            <div className="space-y-2">
              {REASONS[targetType].map((r) => (
                <label key={r.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 ${reason === r.value ? "border-blue-600 bg-blue-50" : "border-zinc-200"}`}>
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
              placeholder="More details (optional)"
              className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-base outline-none focus:border-blue-600"
            />
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-zinc-300 py-3 font-medium">
                Cancel
              </button>
              <button type="button" disabled={!reason || busy} onClick={submit} className="rounded-xl bg-red-600 py-3 font-semibold text-white disabled:bg-zinc-400">
                {busy ? "Sending…" : "Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
