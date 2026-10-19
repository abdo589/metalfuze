import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Project } from "@/lib/projects";
import type { Txn } from "@/lib/transactions";
import { fmtMoney } from "@/lib/projects";

const C = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", color: "var(--popover-foreground)", borderRadius: 8 } };
const axis = { stroke: "var(--muted-foreground)", fontSize: 11 };
const k = (v: number) => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${Math.round(v / 1e3)}K` : String(v));

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-4"><div className="mb-3 text-sm font-semibold">{title}</div><div className="h-64" dir="ltr">{children}</div></div>;
}

export function ExecCharts({ projects, txns, payroll }: { projects: Project[]; txns: Txn[]; payroll: { gross: number; adv: number; com: number } }) {
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const st = { done: 0, ok: 0, behind: 0, late: 0 };
  for (const p of projects) {
    if ((p.progress || 0) >= 1) st.done++;
    else if (p.end && new Date(p.end) < t0) st.late++;
    else if ((p.planned || 0) - (p.progress || 0) >= 0.1) st.behind++;
    else st.ok++;
  }
  const status = [{ name: "مكتمل", v: st.done }, { name: "حسب الخطة", v: st.ok }, { name: "متأخر عن الخطة", v: st.behind }, { name: "تجاوز الموعد", v: st.late }].filter((x) => x.v);
  const statusColor = { "مكتمل": "var(--chart-3)", "حسب الخطة": "var(--chart-1)", "متأخر عن الخطة": "var(--chart-4)", "تجاوز الموعد": "var(--destructive)" } as Record<string, string>;
  const money = [...projects].filter((p) => p.contract).sort((a, b) => b.contract - a.contract).slice(0, 8)
    .map((p) => ({ name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name, "المحصّل": p.paid, "المتبقي": Math.max(0, p.contract - p.paid) }));
  const prog = projects.filter((p) => (p.progress || 0) < 1).map((p) => ({ name: p.name.length > 14 ? p.name.slice(0, 14) + "…" : p.name, "الفعلي": Math.round((p.progress || 0) * 100), "المخطط": Math.round((p.planned || 0) * 100) }));
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d.toISOString().slice(0, 7); });
  const flow = months.map((m) => ({ name: m.slice(5) + "/" + m.slice(2, 4),
    "تحصيل": txns.filter((x) => x.type === "collect" && x.date?.startsWith(m)).reduce((a, x) => a + x.amount, 0),
    "دفع": txns.filter((x) => x.type === "pay" && x.date?.startsWith(m)).reduce((a, x) => a + x.amount, 0) }));
  const pay = [{ name: "الرواتب", v: payroll.gross }, { name: "عمولات", v: payroll.com }, { name: "سلف وخصومات", v: payroll.adv }].filter((x) => x.v);
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card title="حالة المشاريع">
        <ResponsiveContainer><PieChart><Pie data={status} dataKey="v" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {status.map((s) => <Cell key={s.name} fill={statusColor[s.name]} />)}</Pie><Tooltip {...tip} /><Legend /></PieChart></ResponsiveContainer>
      </Card>
      <Card title="الإنجاز الفعلي مقابل المخطط (%)">
        <ResponsiveContainer><BarChart data={prog}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="name" {...axis} interval={0} angle={-25} textAnchor="end" height={60} /><YAxis {...axis} domain={[0, 100]} />
          <Tooltip {...tip} /><Legend /><Bar dataKey="المخطط" fill={C[1]} radius={[4, 4, 0, 0]} /><Bar dataKey="الفعلي" fill={C[0]} radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
      </Card>
      <Card title="التحصيل لكل مشروع (أكبر 8 عقود)">
        <ResponsiveContainer><BarChart data={money} layout="vertical"><CartesianGrid stroke="var(--border)" horizontal={false} /><XAxis type="number" {...axis} tickFormatter={k} /><YAxis type="category" dataKey="name" {...axis} width={110} />
          <Tooltip {...tip} formatter={(v: number) => fmtMoney(v)} /><Legend /><Bar dataKey="المحصّل" stackId="a" fill={C[2]} /><Bar dataKey="المتبقي" stackId="a" fill={C[3]} radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
      </Card>
      <Card title="الدفع والتحصيل — آخر 6 أشهر">
        <ResponsiveContainer><LineChart data={flow}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="name" {...axis} /><YAxis {...axis} tickFormatter={k} />
          <Tooltip {...tip} formatter={(v: number) => fmtMoney(v)} /><Legend /><Line dataKey="تحصيل" stroke={C[2]} strokeWidth={2} /><Line dataKey="دفع" stroke="var(--destructive)" strokeWidth={2} /></LineChart></ResponsiveContainer>
      </Card>
      <Card title="تكلفة الرواتب هذا الشهر">
        <ResponsiveContainer><PieChart><Pie data={pay} dataKey="v" nameKey="name" outerRadius={90}>
          {pay.map((s, i) => <Cell key={s.name} fill={C[i]} />)}</Pie><Tooltip {...tip} formatter={(v: number) => fmtMoney(v)} /><Legend /></PieChart></ResponsiveContainer>
      </Card>
    </div>
  );
}
