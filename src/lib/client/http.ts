/**
 * Reads a JSON reply without crashing on empty or non-JSON bodies (e.g. a
 * platform error page). Returns `{ error }` with a readable message instead.
 */
export async function readJson<T extends object>(res: Response): Promise<T & { error?: string }> {
  const text = await res.text();
  if (text) {
    try {
      return JSON.parse(text) as T & { error?: string };
    } catch {
      // fall through
    }
  }
  const error =
    res.status === 413
      ? "That's too large to upload."
      : res.status >= 500
        ? `Server error (${res.status}). Please try again in a moment.`
        : `Unexpected reply from the server (${res.status}).`;
  return { error } as T & { error?: string };
}
