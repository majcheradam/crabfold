import { describe, expect, it, beforeEach } from "bun:test";

import { checkRateLimit, clearAllBuckets } from "./rate-limiter";

describe("rate-limiter", () => {
  beforeEach(() => {
    clearAllBuckets();
  });

  it("allows requests within the limit", () => {
    const result = checkRateLimit("key-1", 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.resetMs).toBe(0);
  });

  it("tracks remaining tokens across calls", () => {
    for (let i = 0; i < 5; i += 1) {
      checkRateLimit("key-2", 10);
    }
    const result = checkRateLimit("key-2", 10);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("rejects when tokens are exhausted", () => {
    // Consume all 3 tokens
    for (let i = 0; i < 3; i += 1) {
      const r = checkRateLimit("key-3", 3);
      expect(r.allowed).toBe(true);
    }
    // Next should be rejected
    const result = checkRateLimit("key-3", 3);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetMs).toBeGreaterThan(0);
  });

  it("uses separate buckets per key", () => {
    // Exhaust key-a
    for (let i = 0; i < 2; i += 1) {
      checkRateLimit("key-a", 2);
    }
    const exhausted = checkRateLimit("key-a", 2);
    expect(exhausted.allowed).toBe(false);

    // key-b should still work
    const fresh = checkRateLimit("key-b", 2);
    expect(fresh.allowed).toBe(true);
  });

  it("clearAllBuckets resets state", () => {
    // Exhaust tokens
    for (let i = 0; i < 2; i += 1) {
      checkRateLimit("key-c", 2);
    }
    expect(checkRateLimit("key-c", 2).allowed).toBe(false);

    // Clear and verify fresh state
    clearAllBuckets();
    expect(checkRateLimit("key-c", 2).allowed).toBe(true);
    expect(checkRateLimit("key-c", 2).remaining).toBe(0);
  });
});
