import "server-only";
import { ConfigError } from "./config";

/** Verifies a Cloudflare Turnstile token. Tokens are single-use. */
export async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new ConfigError("TURNSTILE_SECRET_KEY");
  if (!token) return false;

  const body = new URLSearchParams({ secret, response: token, remoteip: ip });
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification failed", err);
    return false;
  }
}
