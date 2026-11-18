import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";

const uuid = z.uuid();

export type Visitor = { deviceId: string; ipHash: string };

/** Client IP (first hop of x-forwarded-for on Vercel). */
function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

/** We never store raw IPs, only a salted hash. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) throw new Error("Missing IP_HASH_SALT");
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** Reads the anonymous visitor identity. Returns null if the device id header is missing/invalid. */
export function getVisitor(request: Request): Visitor | null {
  const parsed = uuid.safeParse(request.headers.get("x-device-id"));
  if (!parsed.success) return null;
  return { deviceId: parsed.data, ipHash: hashIp(clientIp(request)) };
}

export function getClientIp(request: Request): string {
  return clientIp(request);
}
