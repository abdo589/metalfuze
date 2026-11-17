import { supabase } from "@/integrations/supabase/client";
import { isSheet, toAmount } from "./sales-price";

const fileToBase64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => { const s = String(r.result ?? ""); res(s.slice(s.indexOf(",") + 1)); };
  r.onerror = () => rej(r.error);
  r.readAsDataURL(f);
});

/** Asks the server to read the total price in one file; null when none was found. */
export async function readFilePrice(f: File): Promise<number | null> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error("signed out");
  let body: Record<string, string>;
  if (isSheet(f)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
    body = { name: f.name, text: wb.SheetNames.map((n) => `## ${n}\n${(wb.Sheets[n] ? XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false }) : "")}`).join("\n\n") };
  } else {
    const mediaType = f.type || (/\.pdf$/i.test(f.name) ? "application/pdf" : "");
    body = { name: f.name, mediaType, data: await fileToBase64(f) };
  }
  const r = await fetch("/api/extract-price", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`read failed ${r.status}`);
  const j = await r.json();
  return toAmount(j.amount);
}
