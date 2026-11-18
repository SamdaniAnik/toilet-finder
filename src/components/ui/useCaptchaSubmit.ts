"use client";

import { useCallback, useState } from "react";
import { useT } from "@/i18n/LanguageProvider";
import type { Messages } from "@/i18n/messages";
import { readJson } from "@/lib/client/http";
import { apiFetch, OfflineError } from "@/lib/client/visitor";

/** Message to show for an error: offline errors in the current language, server errors as sent. */
export function errorText(err: unknown, t: Messages): string {
  if (err instanceof OfflineError) return t.common.offline;
  return (err as Error)?.message || t.common.somethingWrong;
}

/**
 * State for a captcha-protected form: token, busy/progress text, error, and a
 * `run` helper. After any attempt the captcha is reset (tokens are single-use).
 */
export function useCaptchaSubmit() {
  const t = useT();
  const [token, setToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Runs `work`; on error shows the message and resets the captcha. Resolves true on success. */
  const run = useCallback(
    async (work: (token: string, setProgress: (m: string) => void) => Promise<void>) => {
      if (!token) return false;
      setError(null);
      setProgress(t.common.sending);
      try {
        await work(token, setProgress);
        setProgress(null);
        setCaptchaReset((n) => n + 1);
        return true;
      } catch (err) {
        setError(errorText(err, t));
        setProgress(null);
        setCaptchaReset((n) => n + 1);
        return false;
      }
    },
    [token, t],
  );

  return { token, setToken, captchaReset, progress, busy: progress !== null, error, setError, run };
}

/** POSTs JSON with the device header; throws the server's error message on failure. */
export async function postJson(url: string, body: unknown): Promise<void> {
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson<{ ok?: boolean }>(res);
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
}
