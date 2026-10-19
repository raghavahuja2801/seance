/**
 * Sliding-window rate limiter, in memory.
 *
 * shortcut: state lives in one server instance. On Vercel, instances scale out and
 * restart, so this is best effort: it stops a looping script, not a determined
 * attacker. For a hard cap, add a Vercel Firewall rate-limit rule on /api/session
 * or move the counts to a shared store (e.g. Redis).
 */
export function createLimiter({ limit, windowMs, now = Date.now }: { limit: number; windowMs: number; now?: () => number }) {
  const hits = new Map<string, number[]>();

  return {
    /** Records one hit for `key` if it is under the limit. */
    take(key: string): { ok: true } | { ok: false; retryAfterMs: number } {
      const t = now();
      if (hits.size > 10_000) {
        // Drop keys with nothing left in the window so memory stays bounded.
        for (const [k, times] of hits) if (t - times[times.length - 1]! >= windowMs) hits.delete(k);
      }
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterMs: windowMs - (t - recent[0]!) };
      }
      recent.push(t);
      hits.set(key, recent);
      return { ok: true };
    },
  };
}
