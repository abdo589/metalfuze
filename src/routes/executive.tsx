import { createFileRoute } from "@tanstack/react-router";
import { ThemeToggle } from "@/components/ThemeToggle";
import { fmtMoney, fmtPct } from "@/lib/projects";
import { summarize, useExecSnapshot } from "@/lib/exec-snapshot";
import { monthKey, netSalary, usePayroll } from "@/lib/payroll";
import { useAdjustments } from "@/lib/advances";
import { ExecCharts } from "@/components/ExecCharts";

export const Route = createFileRoute("/executive")({
  head: () => ({
    meta: [
      { title: "الملخص التنفيذي — Metal Fuze" },
      { name: "description", content: "ملخص مباشر للمشاريع والميزانية والدفع والتحصيل للإدارة العليا." },
      { property: "og:title", content: "الملخص التنفيذي — Metal Fuze" },
      { property: "og:description", content: "أهم أرقام المشاريع والتحصيل في شاشة واحدة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Executive,
});

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "bad" | "warn" | "good" }) {
  const c = tone === "bad" ? "text-destructive" : tone === "warn" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Bar({ value }: { value: number }) {
  return <div className="h-2 w-full rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} /></div>;
}

function Executive() {
  const { projects, txns, updated, loading } = useExecSnapshot();
  const s = summarize(projects, txns);
  const month = monthKey();
  const emps = usePayroll().filter((e) => e.active);
  const adj = useAdjustments(month);
  let adv = 0, com = 0; adj.forEach((a) => { adv += a.advances; com += a.commissions; });
  const gross = emps.reduce((a, e) => a + netSalary(e), 0);
  const paidCount = emps.filter((e) => e.paidMonths?.includes(month)).length;
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const remainingList = projects.filter((p) => (p.progress || 0) < 1)
    .map((p) => ({ ...p, days: p.end ? Math.ceil((new Date(p.end).getTime() - t0.getTime()) / 86400000) : null }))
    .sort((a, b) => (a.days ?? 99999) - (b.days ?? 99999));
  const gap = s.avgProgress - s.avgPlanned;
  const top = [...projects].sort((a, b) => (b.contract - b.paid) - (a.contract - a.paid))[0];
  const insights = [
    gap >= 0 ? `الإنجاز العام متقدم عن المخطط بـ ${fmtPct(gap)}.` : `الإنجاز العام متأخر عن المخطط بـ ${fmtPct(-gap)}.`,
    `تم تحصيل ${fmtPct(s.collectedPct)} من قيمة العقود، والمتبقي ${fmtMoney(s.remaining)}.`,
    top && top.contract - top.paid > 0 ? `أكبر مبلغ متبقٍ للتحصيل في مشروع «${top.name}»: ${fmtMoney(top.contract - top.paid)}.` : "",
    s.overdue.length ? `${s.overdue.length} مشروع تجاوز موعد التسليم: ${s.overdue.map((p) => p.name).join("، ")}.` : "لا توجد مشاريع متجاوزة لموعد التسليم.",
    txns.length ? `صافي حركة الدفع والتحصيل ${fmtMoney(s.balance)}${s.balance < 0 ? " (المدفوع أكبر من المحصّل)" : ""}.` : "لم تُسجّل حركات دفع أو تحصيل بعد.",
    gross ? `تكلفة الرواتب هذا الشهر ${fmtMoney(gross - adv + com)}${s.monthCollected ? `، تعادل ${fmtPct((gross - adv + com) / s.monthCollected)} من تحصيل الشهر` : ""}.` : "",
  ].filter(Boolean);
  const watch = [...new Map([...s.overdue, ...s.behind, ...s.soon].map((p) => [p.id, p])).values()].slice(0, 6);
  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الملخص التنفيذي</h1>
          <p className="text-sm text-muted-foreground">{loading ? "جارٍ التحميل…" : updated ? `آخر تحديث: ${new Date(updated).toLocaleString("ar-SA")}` : "لا توجد بيانات بعد — تظهر تلقائيًا عند فتح حساب CEO للموقع"}</p>
        </div>
        <ThemeToggle />
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">المشاريع</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="إجمالي المشاريع" value={String(s.count)} hint={`${s.active} جارٍ · ${s.done} مكتمل`} />
          <Kpi label="متوسط الإنجاز" value={fmtPct(s.avgProgress)} hint={`المخطط ${fmtPct(s.avgPlanned)}`} tone={s.avgProgress + 0.05 < s.avgPlanned ? "warn" : "good"} />
          <Kpi label="متأخرة عن الموعد" value={String(s.overdue.length)} tone={s.overdue.length ? "bad" : "good"} />
          <Kpi label="تنتهي خلال 30 يوم" value={String(s.soon.length)} tone={s.soon.length ? "warn" : "good"} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">الميزانية</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Kpi label="قيمة العقود" value={fmtMoney(s.contract)} />
          <Kpi label="المحصّل من العقود" value={fmtMoney(s.paid)} hint={`${fmtPct(s.collectedPct)} من الإجمالي`} tone="good" />
          <Kpi label="المتبقي للتحصيل" value={fmtMoney(s.remaining)} tone={s.remaining ? "warn" : "good"} />
        </div>
        <Bar value={s.collectedPct} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">الدفع والتحصيل</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="إجمالي التحصيل" value={fmtMoney(s.collected)} tone="good" />
          <Kpi label="إجمالي المدفوعات" value={fmtMoney(s.spent)} />
          <Kpi label="الصافي" value={fmtMoney(s.balance)} tone={s.balance < 0 ? "bad" : "good"} />
          <Kpi label="هذا الشهر" value={fmtMoney(s.monthCollected - s.monthSpent)} hint={`تحصيل ${fmtMoney(s.monthCollected)} · دفع ${fmtMoney(s.monthSpent)}`} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">الرواتب والسلف — الشهر الحالي</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="صافي الرواتب" value={fmtMoney(gross - adv + com)} hint={`${emps.length} موظف نشط`} />
          <Kpi label="سلف ومخالفات تُخصم" value={fmtMoney(adv)} tone={adv ? "warn" : "good"} />
          <Kpi label="عمولات تُضاف" value={fmtMoney(com)} tone="good" />
          <Kpi label="تم صرف رواتبهم" value={`${paidCount} / ${emps.length}`} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">المتبقي لكل مشروع</h2>
        <div className="divide-y rounded-xl border bg-card">
          {remainingList.map((p) => (
            <div key={p.id} className="grid grid-cols-1 gap-2 p-3 text-sm md:grid-cols-[1.4fr_1fr_1fr_1fr] md:items-center">
              <span className="font-medium">{p.name}</span>
              <div className="space-y-1"><div className="text-xs text-muted-foreground">متبقي من العمل {fmtPct(1 - (p.progress || 0))}</div><Bar value={p.progress || 0} /></div>
              <span className={p.days === null ? "text-muted-foreground" : p.days < 0 ? "text-destructive" : p.days <= 30 ? "text-primary" : ""}>
                {p.days === null ? "بدون تاريخ انتهاء" : p.days < 0 ? `متأخر ${-p.days} يوم` : `متبقي ${p.days} يوم`}
              </span>
              <span className="text-muted-foreground">متبقي للتحصيل {fmtMoney(Math.max(0, p.contract - p.paid))}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">التحليل</h2>
        <ul className="space-y-1 rounded-xl border bg-card p-4 text-sm leading-7">
          {insights.map((x, i) => <li key={i}>• {x}</li>)}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">الرسوم البيانية</h2>
        <ExecCharts projects={projects} txns={txns} payroll={{ gross, adv, com }} />
      </section>

      {watch.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-semibold">تحتاج انتباه</h2>
          <div className="divide-y rounded-xl border bg-card">
            {watch.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <span className="font-medium">{p.name}</span>
                <span className="text-muted-foreground">{fmtPct(p.progress)} منجز من {fmtPct(p.planned)}{p.end ? ` · ينتهي ${p.end}` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
