import { t, useLanguage, locale } from "@/lib/i18n";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { deadlineAlert, daysLeft, fmtMoney, fmtPct, type Project } from "@/lib/projects";

export function statusClass(s: string) {
  if (s.includes("متأخر")) return "bg-destructive/15 text-destructive border-destructive/30";
  if (s.includes("متقدم")) return "bg-success/15 text-success border-success/30";
  if (s) return "bg-info/15 text-info border-info/30";
  return "bg-muted text-muted-foreground";
}

function statusClassRaw(s: string) {
  if (s.includes("متأخر")) return "#b91c1c";
  if (s.includes("متقدم")) return "#15803d";
  return "#1f6b70";
}

async function downloadProjectPdf(p: Project) {
  const { exportElementPdf } = await import("@/lib/pdf");
  const logo = (await import("@/assets/metal-fuze-logo.png.asset.json")).default.url;
  const esc = (v: unknown) => String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const d = daysLeft(p.end);
  const rows: [string, string][] = [
    [t("رمز المشروع"), p.code],
    [t("اسم المشروع"), p.name],
    [t("القطاع"), p.sector],
    [t("الإدارة"), p.dept],
    [t("مدير المشروع"), p.manager],
    [t("مالك المشروع"), p.owner],
    [t("تاريخ بداية المشروع"), p.start ?? "—"],
    [t("تاريخ انتهاء المشروع"), p.end ? `${p.end} (${deadlineAlert(p.end)}${d !== null ? ` ${d} ${t("يوم")}` : ""})` : "—"],
    [t("حالة المشروع"), p.status],
    [t("هل يوجد عقد شركة"), p.hasContract],
    [t("نسبة الإنجاز"), fmtPct(p.progress)],
    [t("نسبة الإنجاز المخطط"), fmtPct(p.planned)],
    [t("قيمة العقد"), `${fmtMoney(p.contract)} ${t("ريال")}`],
    [t("المدفوع"), `${fmtMoney(p.paid)} ${t("ريال")}`],
    [t("المتبقي للدفع"), `${fmtMoney(p.contract - p.paid)} ${t("ريال")}`],
    [t("الإشكاليات / العوائق"), p.issues],
    [t("ملاحظات مهمة"), p.notes],
  ];
  const el = document.createElement("div");
  el.dir = "rtl";
  el.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;padding:28px;background:#fff;color:#1a2b2c;font-family:Tajawal,Arial,sans-serif;font-size:12px";
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1f6b70;padding-bottom:12px;margin-bottom:16px">
      <div><div style="font-size:22px;font-weight:800;color:#1f6b70">${esc(t("بطاقة مشروع"))}</div><div style="font-size:16px;font-weight:700;margin-top:4px">${esc(p.name)}</div>
      <div style="color:#667;margin-top:4px">${new Date().toLocaleDateString(locale(), { dateStyle: "long" })}</div></div>
      <img src="${logo}" crossorigin="anonymous" style="height:64px" />
    </div>
    <div style="background:${statusClassRaw(p.status)};color:#fff;display:inline-block;font-weight:700;padding:4px 12px;border-radius:6px;margin-bottom:14px">${esc(p.status || "—")}</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:6px">${
      rows.filter(([, v]) => v !== undefined && v !== "").reduce<string[][]>((a, r, i) => { if (i % 2 === 0) a.push([r]); else a[a.length - 1]!.push(r); return a; }, [])
        .map((pair, i) => `<tr style="background:${i % 2 ? "#f1f8f7" : "#fff"}">${pair.map(([k, v]) => `<td style="border:1px solid #cfdcdb;padding:5px 8px;width:22%;color:#556;font-weight:600">${esc(k)}</td><td style="border:1px solid #cfdcdb;padding:5px 8px;width:28%;white-space:nowrap">${esc(v)}</td>`).join("")}${pair.length < 2 ? '<td style="border:1px solid #cfdcdb"></td><td style="border:1px solid #cfdcdb"></td>' : ""}</tr>`).join("")
    }</table>`;
  document.body.appendChild(el);
  try { await exportElementPdf(el, `مشروع-${p.code || p.name}.pdf`); } finally { el.remove(); }
}

export function ProjectDetails({ project, onClose }: { project: Project | null; onClose: () => void }) {
  useLanguage();
  const [busy, setBusy] = useState(false);
  if (!project) return null;
  const d = daysLeft(project.end);
  const bar = (v: number) => (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, v * 100))}%` }} />
      </div>
      <span className="text-xs tabular-nums">{fmtPct(v)}</span>
    </div>
  );
  const rows: [string, React.ReactNode][] = [
    [t("رمز المشروع"), project.code || "—"],
    [t("القطاع"), project.sector ? t(project.sector) : "—"],
    [t("الإدارة"), project.dept || "—"],
    [t("مدير المشروع"), project.manager ? <span dir="ltr">{project.manager}</span> : "—"],
    [t("مالك المشروع"), project.owner || "—"],
    [t("تاريخ بداية المشروع"), project.start ?? "—"],
    [t("تاريخ انتهاء المشروع"), project.end ? (
      <span>{project.end}
        {d !== null && <span className={`ms-2 text-xs ${d < 0 ? "text-destructive" : d <= 30 ? "text-warning" : "text-muted-foreground"}`}>{deadlineAlert(project.end)} ({d})</span>}
      </span>
    ) : "—"],
    [t("حالة المشروع"), project.status ? <Badge variant="outline" className={statusClass(project.status)}>{t(project.status)}</Badge> : "—"],
    [t("هل يوجد عقد شركة"), project.hasContract || "—"],
    [t("نسبة الإنجاز"), bar(project.progress)],
    [t("نسبة الإنجاز المخطط"), bar(project.planned)],
    [t("قيمة العقد"), <span className="tabular-nums">{fmtMoney(project.contract)} {t("ريال")}</span>],
    [t("المدفوع"), <span className="tabular-nums">{fmtMoney(project.paid)} {t("ريال")}</span>],
    [t("المتبقي للدفع"), <span className="tabular-nums font-semibold">{fmtMoney(project.contract - project.paid)} {t("ريال")}</span>],
  ];
  return (
    <Dialog open={!!project} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir={locale() === "en-GB" ? "ltr" : "rtl"} className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{project.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground">{k}</div>
              <div className="mt-0.5 text-sm font-medium">{v}</div>
            </div>
          ))}
          {project.issues && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 sm:col-span-2">
              <div className="text-xs text-destructive">{t("الإشكاليات / العوائق")}</div>
              <div className="mt-0.5 whitespace-pre-wrap text-sm">{project.issues}</div>
            </div>
          )}
          {project.notes && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 sm:col-span-2">
              <div className="text-xs text-muted-foreground">{t("ملاحظات مهمة")}</div>
              <div className="mt-0.5 whitespace-pre-wrap text-sm">{project.notes}</div>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button disabled={busy} onClick={async () => {
            setBusy(true);
            try { await downloadProjectPdf(project); toast.success(t("تم حفظ PDF")); }
            catch { toast.error(t("تعذر حفظ PDF، حاول مرة أخرى")); }
            finally { setBusy(false); }
          }}>{busy ? <LoaderCircle className="animate-spin" /> : <FileDown />}{t("تحميل PDF")}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
