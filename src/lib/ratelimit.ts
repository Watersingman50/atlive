// Basic in-memory fixed-window rate limiter.
//
// Best-effort by design: serverless instances don't share memory, so this caps
// abuse PER INSTANCE, not globally — enough to blunt casual spam / accidental
// double-submits on the signup form. For hard global limits, swap the Map for
// Upstash/Redis (the call site doesn't change).

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

export interface RateResult {
  ok: boolean;
  /** Seconds until the window resets (for the Retry-After header). */
  retryAfter: number;
}

/** Allow up to `limit` hits per `windowMs` for `key`. `now` is injectable for tests. */
export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): RateResult {
  const w = buckets.get(key);
  if (!w || now >= w.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (w.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((w.resetAt - now) / 1000) };
  }
  w.count++;
  return { ok: true, retryAfter: 0 };
}

/** Drop expired windows so the map can't grow unbounded. */
export function sweep(now: number = Date.now()): void {
  for (const [k, w] of buckets) if (now >= w.resetAt) buckets.delete(k);
}
