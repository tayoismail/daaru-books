// Minimal in-memory fixed-window rate limiter for public endpoints
// (login, newsletter, contact). Good enough for a single-instance
// deployment to blunt brute-force and spam abuse; a multi-instance
// deployment should move this to Redis or the platform's rate limiter.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Prune expired buckets occasionally so the map cannot grow unbounded. */
function prune(now: number): void {
  if (buckets.size < 10_000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Allow at most `limit` calls per `windowMs` from an IP. Returns true when
 * the call is allowed, false when the caller is over the limit.
 */
export function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

/**
 * Best-effort client IP: honors X-Forwarded-For (set by reverse proxies)
 * and falls back to the socket address. Not a security boundary — the
 * limiter is a deterrent, not a defense against a distributed attacker.
 */
export function clientIp(
  req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }
): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}
