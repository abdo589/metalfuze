/** Pricing values read from Eilaf's quotation files; the field shows the sum of every file a price was found in. */
export type FilePrice = { status: "reading" | "done" | "failed"; amount: number | null };

/** Turns a model/number-ish value ("1,250,000.50 SAR", "١٢٥٠٠") into a positive number, else null. */
export function toAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace(/٫/g, ".").replace(/[٬,\s]/g, "").replace(/[^\d.]/g, "");
  const n = Number(s);
  return s && Number.isFinite(n) && n > 0 ? n : null;
}

/** Sum of the prices found so far; null when no file had a price. Rounded to halalas. */
export function sumPrices(prices: (FilePrice | undefined)[]): number | null {
  const found = prices.filter((p): p is FilePrice => !!p && p.status === "done" && p.amount != null);
  if (!found.length) return null;
  return Math.round(found.reduce((a, p) => a + (p.amount as number), 0) * 100) / 100;
}

export const isSheet = (f: { name: string; type: string }) => /\.(xlsx|xlsm|xls|csv)$/i.test(f.name) || /spreadsheet|excel|csv/i.test(f.type);
/** Only PDF quotations are read for the price; Excel, pictures and other files are attached but never counted. */
export const isReadablePriceFile = (f: { name: string; type: string }) =>
  f.type === "application/pdf" || /\.pdf$/i.test(f.name);
