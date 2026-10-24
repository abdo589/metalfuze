import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { t } from "@/lib/i18n";
import logo from "@/assets/metal-fuze-logo.png.asset.json";

type Sig = { name: string; role: string; dept: string; email: string };
const SITE = "https://metalfuze.lovable.app";
const WEB = "www.metalfuze.com";

/** Builds the e-mail signature HTML (inline styles only, so Outlook/Gmail keep it). */
export function signatureHtml(s: Sig) {
  const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<table dir="rtl" cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#222"><tr>
<td style="padding-left:14px;border-left:3px solid #c8102e"><img src="${SITE}${logo.url}" alt="Metal Fuze" width="110" style="display:block"/></td>
<td style="padding-right:14px"><div style="font-size:15px;font-weight:bold">${esc(s.name)}</div>
${s.role ? `<div style="color:#555">${esc(s.role)}${s.dept ? ` — ${esc(s.dept)}` : ""}</div>` : ""}
<div style="margin-top:6px">${s.email ? `<a href="mailto:${esc(s.email)}" style="color:#c8102e;text-decoration:none">${esc(s.email)}</a> · ` : ""}<a href="https://${WEB}" style="color:#c8102e;text-decoration:none">${WEB}</a></div>
<div style="color:#777;font-size:12px">Metal Fuze — ميتال فيوز</div></td></tr></table>`;
}

/** E-mail signature card for one employee (looked up by number, else by name), with a copy button for Outlook. */
export function EmployeeSignature({ empId, name }: { empId?: string | null; name?: string | null }) {
  const [sig, setSig] = useState<Sig | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      const q = supabase.from("employees").select("name,role,dept,email");
      const { data } = empId ? await q.eq("id", empId).maybeSingle() : name ? await q.eq("name", name).maybeSingle() : { data: null };
      const r = data ?? (empId && name ? (await supabase.from("employees").select("name,role,dept,email").eq("name", name).maybeSingle()).data : null);
      if (!off) setSig(r ? { name: r.name, role: r.role ?? "", dept: r.dept ?? "", email: r.email ?? "" } : name ? { name, role: "", dept: "", email: "" } : null);
    })();
    return () => { off = true; };
  }, [empId, name]);
  if (!sig) return null;

  async function copy() {
    const html = signatureHtml(sig!);
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([`${sig!.name}\n${sig!.role}\n${sig!.email}\n${WEB}`], { type: "text/plain" }) })]);
      toast.success(t("تم نسخ التوقيع — الصقه في إعدادات التوقيع في Outlook"));
    } catch { toast.error(t("تعذر النسخ")); }
  }

  return (
    <section className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold">{t("التوقيع الإلكتروني")}</h4>
        <Button size="sm" variant="outline" className="print:hidden" onClick={copy}><Copy /> {t("نسخ للإيميل")}</Button>
      </div>
      <div className="flex items-center gap-3 rounded-lg bg-background p-3">
        <img src={logo.url} alt="Metal Fuze" className="h-10 w-auto border-e-2 border-primary pe-3" />
        <div className="text-sm">
          <div className="font-bold">{sig.name}</div>
          {sig.role && <div className="text-muted-foreground">{sig.role}{sig.dept ? ` — ${sig.dept}` : ""}</div>}
          <div className="text-xs text-primary" dir="ltr">{sig.email ? `${sig.email} · ` : ""}{WEB}</div>
        </div>
      </div>
    </section>
  );
}
