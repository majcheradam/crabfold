/**
 * In-memory token bucket rate limiter.
 * Each bucket is keyed by API key ID and refills at `limit` tokens per minute.
 */

interface Bucket {
  tokens: number;
  lastRefill: number;
  limit: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Attempt to consume one token from a bucket.
 * Returns { allowed, remaining, resetMs }.
 */
export function checkRateLimit(
  keyId: string,
  limit: number
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let bucket = buckets.get(keyId);

  if (!bucket) {
    bucket = { lastRefill: now, limit, tokens: limit };
    buckets.set(keyId, bucket);
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  // tokens per ms
  const refillRate = bucket.limit / 60_000;
  const refilled = Math.min(bucket.limit, bucket.tokens + elapsed * refillRate);
  bucket.tokens = refilled;
  bucket.lastRefill = now;
  bucket.limit = limit;

  if (bucket.tokens < 1) {
    const resetMs = Math.ceil((1 - bucket.tokens) / refillRate);
    return { allowed: false, remaining: 0, resetMs };
  }

  bucket.tokens -= 1;
  return {
    allowed: true,
    remaining: Math.floor(bucket.tokens),
    resetMs: 0,
  };
}

/**
 * Reset a rate limit bucket (for testing).
 */
export function resetBucket(keyId: string): void {
  buckets.delete(keyId);
}

/**
 * Clear all buckets (for testing).
 */
export function clearAllBuckets(): void {
  buckets.clear();
}
