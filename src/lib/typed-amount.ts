/** Parse an amount typed by hand: Arabic/Persian digits, thousands commas and Arabic decimal mark allowed; invalid → 0. */
export function parseTypedAmount(raw: string): number {
  const s = String(raw ?? "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, ".")
    .replace(/[,\u066C\s]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
