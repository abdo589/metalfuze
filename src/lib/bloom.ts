/**
 * Small Bloom filter for duplicate warnings: "no" is certain, "maybe" is confirmed
 * by an exact check before warning the user, so there are never false alarms.
 */
export class BloomFilter {
  private bits: Uint8Array;
  constructor(private size = 8192, private hashes = 5) {
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }
  private positions(value: string) {
    // Double hashing with FNV-1a and djb2.
    let h1 = 2166136261, h2 = 5381;
    for (let i = 0; i < value.length; i++) {
      const c = value.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = ((h2 << 5) + h2 + c) >>> 0;
    }
    return Array.from({ length: this.hashes }, (_, i) => (h1 + i * ((h2 | 1) >>> 0)) % this.size);
  }
  add(value: string) {
    for (const p of this.positions(value)) this.bits[p >> 3]! |= 1 << (p & 7);
  }
  mightContain(value: string) {
    return this.positions(value).every((p) => ((this.bits[p >> 3] ?? 0) & (1 << (p & 7))) !== 0);
  }
}

/** Normalises text so "  ABC-1 " and "abc-1" count as the same entry. */
export const normKey = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

/** Returns the existing values that duplicate `value` (empty list = no duplicate). */
export function findDuplicate(existing: unknown[], value: unknown): boolean {
  const key = normKey(value);
  if (!key) return false;
  const keys = existing.map(normKey).filter(Boolean);
  const f = new BloomFilter(Math.max(1024, keys.length * 10));
  keys.forEach((k) => f.add(k));
  if (!f.mightContain(key)) return false;
  return keys.includes(key);
}
