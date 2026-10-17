import { t, useLanguage, locale } from "@/lib/i18n";
import { WEEKEND, type DayRecord } from "@/lib/attendance";
import { monthLabel, type Employee } from "@/lib/payroll";

type Row = { e: Employee; s: { days: DayRecord[]; present: number; late: number; absent: number; linked: boolean } };

/** Monthly attendance grid: one row per employee, one column per day. Also the PDF layout. */
export function MonthlySheet({ rows, month, today, onSelect }: { rows: Row[]; month: string; today: string; onSelect: (id: string) => void }) {
  useLanguage();
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, i) => {
    const dt = new Date(Date.UTC(y!, m! - 1, i + 1));
    return { iso: dt.toISOString().slice(0, 10), n: i + 1, off: WEEKEND.includes(dt.getUTCDay()),
      wd: dt.toLocaleDateString(locale(), { weekday: "narrow", timeZone: "UTC" }) };
  });

  return (
    <section className="overflow-x-auto rounded-xl border border-border bg-card print:overflow-visible">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <h2 className="font-display text-lg font-bold">{t("جدول الحضور والانصراف الشهري")} — {monthLabel(month)}</h2>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          <span><span className="inline-block size-2.5 rounded-sm bg-success/30" /> {t("حضور")}</span>
          <span><span className="inline-block size-2.5 rounded-sm bg-warning/30" /> {t("تأخير")}</span>
          <span><span className="inline-block size-2.5 rounded-sm bg-destructive/25" /> {t("غياب")}</span>
          <span><span className="inline-block size-2.5 rounded-sm bg-muted" /> {t("عطلة")}</span>
        </div>
      </div>
      <table className="w-full min-w-[1000px] table-fixed border-collapse text-[9px] leading-tight">
        <thead>
          <tr className="text-muted-foreground">
            <th className="w-28 border border-border p-1 text-start text-[10px]">{t("الموظف")}</th>
            {days.map((d) => (
              <th key={d.iso} className={`border border-border p-0.5 text-center font-medium ${d.off ? "bg-muted" : ""}`}>
                <div>{d.n}</div><div className="font-normal">{d.wd}</div>
              </th>
            ))}
            <th className="w-9 border border-border p-0.5">{t("حضور")}</th>
            <th className="w-9 border border-border p-0.5">{t("تأخير")}</th>
            <th className="w-9 border border-border p-0.5">{t("غياب")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={count + 4} className="p-6 text-center text-xs text-muted-foreground">{t("أضف الموظفين من صفحة الرواتب أولًا")}</td></tr>}
          {rows.map(({ e, s }) => {
            const byDate = new Map(s.days.map((d) => [d.date, d]));
            return (
              <tr key={e.id} onClick={() => onSelect(e.id)} className="cursor-pointer hover:bg-muted/40">
                <td className="truncate border border-border p-1 text-[10px] font-medium" title={e.name}>{e.name}</td>
                {days.map((d) => {
                  const r = byDate.get(d.iso);
                  const absent = !r && !d.off && s.linked && d.iso <= today;
                  const cls = r ? (r.late ? "bg-warning/25" : "bg-success/20") : d.off ? "bg-muted" : absent ? "bg-destructive/20 text-destructive" : "";
                  return (
                    <td key={d.iso} className={`border border-border p-0.5 text-center ${cls}`}>
                      {r ? <><div>{r.in}</div>{r.out && <div className="text-muted-foreground">{r.out}</div>}</> : absent ? t("غ") : ""}
                    </td>
                  );
                })}
                <td className="border border-border p-0.5 text-center font-bold">{s.present}</td>
                <td className="border border-border p-0.5 text-center text-warning">{s.late}</td>
                <td className="border border-border p-0.5 text-center text-destructive">{s.absent}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
