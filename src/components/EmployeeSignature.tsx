import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";

const FONT = "'Aref Ruqaa', serif";

/** Handwritten-style Arabic signature (Ruqaa) of the employee's name, looked up by number, else by name. */
export function EmployeeSignature({ empId, name }: { empId?: string | null | undefined; name?: string | null | undefined }) {
  const [full, setFull] = useState<string | null>(name || null);
  useEffect(() => {
    let off = false;
    if (!empId) { setFull(name || null); return; }
    supabase.from("employees").select("name").eq("id", empId).maybeSingle().then(({ data }) => { if (!off) setFull(data?.name || name || null); });
    return () => { off = true; };
  }, [empId, name]);
  if (!full) return null;

  async function download() {
    try {
      await document.fonts.load(`700 64px ${FONT}`, full!);
      const c = document.createElement("canvas"), x = c.getContext("2d")!;
      x.font = `700 64px ${FONT}`;
      const w = Math.ceil(x.measureText(full!).width) + 80;
      c.width = w; c.height = 150;
      x.font = `700 64px ${FONT}`; x.direction = "rtl"; x.textAlign = "center"; x.textBaseline = "middle";
      x.fillStyle = "#1a2a5c"; x.fillText(full!, w / 2, 65);
      x.strokeStyle = "#1a2a5c"; x.lineWidth = 2.5; x.lineCap = "round";
      x.beginPath(); x.moveTo(30, 125); x.quadraticCurveTo(w / 2, 108, w - 30, 118); x.stroke();
      const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = `توقيع-${full}.png`; a.click();
    } catch { toast.error(t("تعذر تنزيل التوقيع")); }
  }

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-3 print:border-0">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold">{t("التوقيع")}</h4>
        <Button size="sm" variant="outline" className="print:hidden" onClick={download}><Download /> {t("تنزيل التوقيع")}</Button>
      </div>
      <div dir="rtl" className="flex justify-center rounded-lg bg-background px-4 py-3">
        <div className="inline-block border-b-2 border-foreground/70 px-4 pb-1 text-4xl leading-relaxed text-foreground" style={{ fontFamily: FONT, transform: "rotate(-3deg)" }}>{full}</div>
      </div>
    </section>
  );
}
