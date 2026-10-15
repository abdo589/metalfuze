import { daysLeft, deadlineAlert, fmtPct, type Project } from "./projects";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** Build a formatted Arabic Excel report (summary + full projects table). */
export async function exportExcel(projects: Project[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();

  const contract = projects.reduce((a, p) => a + (p.contract || 0), 0);
  const paid = projects.reduce((a, p) => a + (p.paid || 0), 0);
  const late = projects.filter((p) => {
    const d = daysLeft(p.end);
    return (d !== null && d < 0 && p.progress < 1) || p.status.includes("متأخر");
  }).length;
  const done = projects.filter((p) => p.progress >= 1).length;
  const withProg = projects.filter((p) => p.progress > 0);
  const avg = withProg.length ? withProg.reduce((a, p) => a + p.progress, 0) / withProg.length : 0;

  const summary = [
    ["تقرير متابعة المشاريع — Metal Fuze"],
    [`تاريخ التقرير: ${new Date().toLocaleDateString("ar-SA-u-ca-gregory", { dateStyle: "full" })}`],
    [],
    ["إجمالي المشاريع", projects.length],
    ["المشاريع المكتملة", done],
    ["المشاريع المتأخرة", late],
    ["متوسط الإنجاز", fmtPct(avg)],
    ["إجمالي قيمة العقود (ريال)", contract],
    ["إجمالي المدفوع (ريال)", paid],
    ["المتبقي للدفع (ريال)", contract - paid],
    ["نسبة الصرف", fmtPct(contract ? paid / contract : 0)],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary["!cols"] = [{ wch: 30 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "ملخص");

  const head = [
    "رمز المشروع", "اسم المشروع", "القطاع", "الإدارة", "مدير المشروع",
    "تاريخ البداية", "تاريخ الانتهاء", "الأيام المتبقية", "حالة الموعد", "حالة المشروع",
    "نسبة الإنجاز", "نسبة الإنجاز المخطط", "قيمة العقد", "المدفوع", "المتبقي للدفع",
    "الإشكاليات / العوائق", "ملاحظات",
  ];
  const rows = projects.map((p) => {
    const d = daysLeft(p.end);
    return [
      p.code, p.name, p.sector, p.dept, p.manager,
      p.start ?? "", p.end ?? "", d ?? "", deadlineAlert(p.end), p.status,
      fmtPct(p.progress), fmtPct(p.planned), p.contract, p.paid, p.contract - p.paid,
      p.issues, p.notes,
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([head, ...rows]);
  ws["!cols"] = head.map((_, i) => ({ wch: i === 1 ? 35 : i >= 15 ? 30 : 16 }));
  XLSX.utils.book_append_sheet(wb, ws, "المشاريع");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `تقرير-المشاريع-${stamp}.xlsx`,
  );
}
