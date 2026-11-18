"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/LanguageProvider";

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// NEXT_PUBLIC_* values are baked in at build time: after adding/changing it in
// Vercel you must redeploy for it to take effect.
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve() : reject(new Error("Captcha script loaded without API")));
    s.onerror = () => {
      scriptPromise = null;
      s.remove();
      reject(new Error("Couldn't load captcha"));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

type Problem = "missing-key" | "load-failed" | "widget-error" | null;

/**
 * Cloudflare Turnstile captcha. Calls onToken with a fresh token (or null when it
 * expires). Change `resetKey` to get a new token after a failed submit — tokens are single-use.
 */
export default function Turnstile({ onToken, resetKey = 0 }: { onToken: (t: string | null) => void; resetKey?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [problem, setProblem] = useState<Problem>(SITE_KEY ? null : "missing-key");
  const t = useT();
  const problemText: Record<Exclude<Problem, null>, string> = {
    "missing-key": t.captcha.missingKey,
    "load-failed": t.captcha.loadFailed,
    "widget-error": t.captcha.widgetError,
  };

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY) {
      console.error("Missing NEXT_PUBLIC_TURNSTILE_SITE_KEY");
      return;
    }
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          callback: (t: string) => {
            setProblem(null);
            onTokenRef.current(t);
          },
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": (code: string) => {
            console.error("Turnstile error", code);
            setProblem("widget-error");
            onTokenRef.current(null);
          },
        });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setProblem("load-failed");
        onTokenRef.current(null);
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  useEffect(() => {
    if (resetKey === 0 || !widgetId.current || !window.turnstile) return;
    onTokenRef.current(null);
    window.turnstile.reset(widgetId.current);
  }, [resetKey]);

  return (
    <div>
      <div ref={ref} className={problem === "missing-key" ? "" : "min-h-[65px]"} />
      {problem && (
        <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {problemText[problem]}
        </p>
      )}
    </div>
  );
}
