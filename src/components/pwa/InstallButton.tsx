"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED_KEY = "tf.installDismissed";

/**
 * "Install app" pill, shown only when the browser offers installation
 * (Chrome/Edge/Samsung on Android and desktop). iPhone users use Share → Add to Home Screen.
 */
export default function InstallButton({ label, dismissLabel }: { label: string; dismissLabel: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // storage blocked
    }
    if (dismissed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault(); // show our own button instead of the browser's mini-bar
      setPromptEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => setPromptEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!promptEvent) return null;

  const install = async () => {
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setPromptEvent(null);
  };

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white py-1 pl-3 pr-1 text-sm shadow-md">
      <button type="button" onClick={install} className="font-semibold text-blue-700">
        📲 {label}
      </button>
      <button type="button" onClick={dismiss} aria-label={dismissLabel} className="px-2 text-lg leading-none text-zinc-400">
        ×
      </button>
    </div>
  );
}
