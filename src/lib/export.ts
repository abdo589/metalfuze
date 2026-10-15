import { daysLeft, deadlineAlert, type Project } from "./projects";

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

/** Build a branded Arabic Excel report (summary + full projects table). */
export async function exportExcel(projects: Project[]) {
  const { exportBrandedExcel } = await import("./branded-excel");
  const contract = projects.reduce((a, p) => a + (p.contract || 0), 0);
  const paid = projects.reduce((a, p) => a + (p.paid || 0), 0);
  const late = projects.filter((p) => {
    const d = daysLeft(p.end);
    return (d !== null && d < 0 && p.progress < 1) || p.status.includes("متأخر");
  }).length;
  const done = projects.filter((p) => p.progress >= 1).length;
  const withProg = projects.filter((p) => p.progress > 0);
  const avg = withProg.length ? withProg.reduce((a, p) => a + p.progress, 0) / withProg.length : 0;
  const stamp = new Date().toISOString().slice(0, 10);

  await exportBrandedExcel({
    filename: `تقرير-المشاريع-${stamp}.xlsx`,
    reportTitle: "تقرير متابعة المشاريع",
    summary: [
      ["إجمالي المشاريع", projects.length, "int"],
      ["المشاريع المكتملة", done, "int"],
      ["المشاريع المتأخرة", late, "int"],
      ["متوسط الإنجاز", avg, "pct"],
      ["إجمالي قيمة العقود", contract, "money"],
      ["إجمالي المدفوع", paid, "money"],
      ["المتبقي للدفع", contract - paid, "money"],
      ["نسبة الصرف", contract ? paid / contract : 0, "pct"],
    ],
    sheets: [{
      name: "المشاريع",
      title: "تفاصيل المشاريع",
      columns: [
        { header: "رمز المشروع", width: 13 }, { header: "اسم المشروع", width: 34 },
        { header: "القطاع" }, { header: "الإدارة" }, { header: "مدير المشروع", width: 18 },
        { header: "تاريخ البداية", width: 13 }, { header: "تاريخ الانتهاء", width: 13 },
        { header: "الأيام المتبقية", width: 12, format: "int" }, { header: "حالة الموعد" },
        { header: "حالة المشروع", width: 13 }, { header: "نسبة الإنجاز", width: 12, format: "pct" },
        { header: "الإنجاز المخطط", width: 12, format: "pct" }, { header: "قيمة العقد", width: 17, format: "money" },
        { header: "المدفوع", width: 17, format: "money" }, { header: "المتبقي للدفع", width: 17, format: "money" },
        { header: "الإشكاليات / العوائق", width: 30 }, { header: "ملاحظات", width: 30 },
      ],
      rows: projects.map((p) => [
        p.code, p.name, p.sector, p.dept, p.manager, p.start ?? "", p.end ?? "",
        daysLeft(p.end) ?? "", deadlineAlert(p.end), p.status, p.progress, p.planned,
        p.contract, p.paid, p.contract - p.paid, p.issues, p.notes,
      ]),
      totals: [12, 13, 14],
    }],
  });
}
