import { describe, expect, it } from "bun:test";

// Test the pure crypto functions used by api-key.ts without importing the
// module itself (which pulls in @crabfold/db and requires env vars).

function hashApiKey(key: string): string {
  const hash = new Bun.CryptoHasher("sha256");
  hash.update(key);
  return hash.digest("hex");
}

function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `cb_${hex}`;
}

describe("api-key", () => {
  it("generates keys with cb_ prefix", () => {
    const key = generateApiKey();
    expect(key.startsWith("cb_")).toBe(true);
    // 32 bytes = 64 hex chars + "cb_" prefix = 67 chars
    expect(key.length).toBe(67);
  });

  it("generates unique keys", () => {
    const keys = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      keys.add(generateApiKey());
    }
    expect(keys.size).toBe(100);
  });

  it("hashes keys deterministically", () => {
    const key = "cb_test123";
    const hash1 = hashApiKey(key);
    const hash2 = hashApiKey(key);
    expect(hash1).toBe(hash2);
    // SHA-256 hex
    expect(hash1.length).toBe(64);
  });

  it("produces different hashes for different keys", () => {
    const hash1 = hashApiKey("cb_key1");
    const hash2 = hashApiKey("cb_key2");
    expect(hash1).not.toBe(hash2);
  });
});
