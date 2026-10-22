/**
 * Consistent hashing ring: maps keys to members so adding/removing a member
 * only moves the keys that belonged to it (about 1/N), not everything.
 */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  // Final avalanche so similar strings spread around the ring.
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return h >>> 0;
}

export class ConsistentHashRing {
  private ring: { point: number; member: string }[] = [];
  constructor(members: string[] = [], private replicas = 100) {
    members.forEach((m) => this.add(m));
  }
  add(member: string) {
    if (this.members().includes(member)) return;
    for (let i = 0; i < this.replicas; i++) this.ring.push({ point: hash(`${member}#${i}`), member });
    this.ring.sort((a, b) => a.point - b.point);
  }
  remove(member: string) {
    this.ring = this.ring.filter((n) => n.member !== member);
  }
  members() {
    return [...new Set(this.ring.map((n) => n.member))];
  }
  /** The member responsible for `key`, or null when the ring is empty. */
  get(key: string): string | null {
    if (!this.ring.length) return null;
    const h = hash(key);
    let lo = 0, hi = this.ring.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.ring[mid]!.point < h) lo = mid + 1; else hi = mid; }
    return this.ring[lo % this.ring.length]!.member;
  }
}
