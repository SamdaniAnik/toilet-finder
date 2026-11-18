import "server-only";
import { unstable_rethrow } from "next/navigation";

/** Server settings every write endpoint needs. Names only, never values. */
const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "IP_HASH_SALT",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY",
] as const;

export function missingEnv(): string[] {
  return REQUIRED_ENV.filter((name) => !process.env[name]);
}

/** Thrown when a required setting is missing, so handlers can answer with a clear message. */
export class ConfigError extends Error {
  constructor(name: string) {
    super(`Missing ${name}`);
    this.name = "ConfigError";
  }
}

/**
 * Wraps a route handler so unexpected errors become a JSON reply instead of an
 * empty 500 (which breaks `res.json()` in the browser).
 */
export function withJsonErrors<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      // Let Next.js's own control-flow errors (e.g. "bail out of prerendering") through.
      unstable_rethrow(err);
      console.error(err);
      if (err instanceof ConfigError) {
        return Response.json(
          { error: "The server isn't fully set up yet. Please try again later." },
          { status: 503 },
        );
      }
      return Response.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
    }
  };
}
