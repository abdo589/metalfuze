import { createFileRoute, Link } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, CheckCircle2, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { t, useLanguage } from '@/lib/i18n';
import { useCanEditHr } from '@/lib/permissions';
import { usePayroll, monthKey, monthLabel } from '@/lib/payroll';
import { adjMonth, advanceBalance, advanceDeduction, advanceRepayments, type AdjRow } from '@/lib/advances';
import { fmtMoney } from '@/lib/projects';

export const Route = createFileRoute('/salary-deductions')({
  head: () => ({ meta: [
    { title: 'خصومات الرواتب والسلف — Metal Fuze' },
    { name: 'description', content: 'السلف وخصومات رواتب الموظفين الشهرية وأرصدة السداد في Metal Fuze.' },
    { property: 'og:title', content: 'خصومات الرواتب والسلف — Metal Fuze' },
    { property: 'og:description', content: 'متابعة الخصومات الشهرية والسلف والمتبقي من السداد.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }), component: SalaryDeductions,
});
type Row = AdjRow & { id: string; sort: number };
function SalaryDeductions() {
  useLanguage();
  const canEdit = useCanEditHr();
  const employees = usePayroll();
  const [month, setMonth] = useState(monthKey());
  const [employee, setEmployee] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<{ id: string; data: Record<string, unknown> } | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('hr_records').select('id,sheet,data,sort').eq('sheet', 'advances').order('sort');
    if (error) toast.error(t('تعذر التحميل')); else { setRows((data ?? []) as Row[]); setLoaded(true); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const visible = rows.filter(r => (!employee || String(r.data['رقم الموظف']) === employee) && adjMonth(r) && adjMonth(r) <= month);
  const total = visible.reduce((sum, r) => sum + advanceDeduction(r, month), 0);
  const name = (r: Row) => employees.find(e => e.id === String(r.data['رقم الموظف']))?.name ?? String(r.data['رقم الموظف']);
  async function save() {
    if (!edit || !canEdit || saving) return;
    const amount = Number(edit.data['المبلغ']);
    const paid = Number(edit.data['المسدد'] ?? 0);
    if (!edit.data['رقم الموظف'] || !/^\d{4}-\d{2}$/.test(String(edit.data['شهر الخصم'] ?? '')) || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(paid) || paid < 0 || paid > amount) { toast.error(t('راجع الموظف والشهر والمبالغ')); return; }
    setSaving(true);
    const result = edit.id
      ? await supabase.from('hr_records').update({ data: edit.data, updated_at: new Date().toISOString() }).eq('id', edit.id)
      : await supabase.from('hr_records').insert({ sheet: 'advances', data: edit.data, sort: rows.length });
    setSaving(false);
    if (result.error) { toast.error(t('تعذر الحفظ')); return; }
    setEdit(null); await load(); toast.success(t('تم الحفظ'));
  }
  async function settle(r: Row) {
    if (!canEdit || saving) return;
    const value = window.prompt(t('المبلغ المسدد من راتب هذا الشهر'), String(advanceDeduction(r, month)));
    if (value === null) return;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount > advanceBalance(r, month)) { toast.error(t('راجع الموظف والشهر والمبالغ')); return; }
    setSaving(true);
    const { error } = await supabase.from('hr_records').update({ data: { ...r.data, 'سداد شهري': { ...advanceRepayments(r), [month]: amount } }, updated_at: new Date().toISOString() }).eq('id', r.id);
    setSaving(false);
    if (error) toast.error(t('تعذر الحفظ')); else { await load(); toast.success(t('تم الحفظ')); }
  }
  const fields = ['رقم السلفة', 'تاريخ السلفة', 'شهر الخصم', 'المبلغ', 'المسدد', 'السبب'];
  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-2xl font-bold">{t('خصومات الرواتب والسلف')}</h1>
      <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link to="/payroll"><Banknote />{t('الرواتب')}</Link></Button>
      {canEdit && <Button onClick={() => setEdit({ id: '', data: { 'رقم الموظف': '', 'النوع': 'سلفة', 'شهر الخصم': month, 'المبلغ': 0, 'المسدد': 0, 'الحالة': 'نشطة', 'رقم السلفة': `S-${Date.now()}` } })}><Plus />{t('إضافة سلفة أو خصم')}</Button>}</div>
    </header>
    <div className="flex flex-wrap gap-3">
      <Input aria-label={t('اختيار الشهر')} type="month" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }} className="w-48" />
      <select aria-label={t('الموظف')} className="h-10 max-w-full rounded-md border border-input bg-background px-3" value={employee} onChange={e => setEmployee(e.target.value)}><option value="">{t('كل الموظفين')}</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
    </div>
    <section className="border-y border-border py-5"><div className="text-sm text-muted-foreground">{t('خصومات الشهر')} — {monthLabel(month)}</div><div className="mt-1 font-display text-3xl font-bold text-destructive">{fmtMoney(total)} {t('ر.س')}</div></section>
    <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-start text-sm"><thead><tr className="border-b border-border text-start text-muted-foreground">{['الموظف', 'النوع', 'شهر الخصم', 'المبلغ', 'المسدد سابقًا', 'المتبقي أول الشهر', 'خصومات الشهر', 'السداد المسجل للشهر', 'السبب', 'إجراءات'].map(k => <th className="p-3 text-start font-medium" key={k}>{t(k)}</th>)}</tr></thead><tbody>
      {visible.map(r => <tr key={r.id} className="border-b border-border"><td className="p-3 font-medium">{name(r)}</td><td className="p-3">{t(String(r.data['النوع'] ?? 'سلفة'))}</td><td className="p-3">{adjMonth(r)}</td><td className="p-3">{fmtMoney(Number(r.data['المبلغ']) || 0)}</td><td className="p-3">{fmtMoney((Number(r.data['المسدد']) || 0) + Object.entries(advanceRepayments(r)).filter(([m]) => m < month).reduce((s, [, v]) => s + v, 0))}</td><td className="p-3">{fmtMoney(advanceBalance(r, month))}</td><td className="p-3 font-bold text-destructive">{fmtMoney(advanceDeduction(r, month))}</td><td className="p-3">{advanceRepayments(r)[month] === undefined ? '—' : fmtMoney(advanceRepayments(r)[month])}</td><td className="p-3">{String(r.data['السبب'] ?? '—')}</td><td className="p-3">{canEdit && <div className="flex gap-1"><Button variant="ghost" size="icon" aria-label={t('تعديل')} title={t('تعديل')} onClick={() => setEdit({ id: r.id, data: { ...r.data } })}><Pencil /></Button><Button disabled={saving} variant="ghost" size="icon" aria-label={t('تسجيل سداد الشهر')} title={t('تسجيل سداد الشهر')} onClick={() => settle(r)}><CheckCircle2 /></Button></div>}</td></tr>)}
      {!visible.length && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">{t(loaded ? 'لا توجد سجلات' : 'جارٍ التحميل…')}</td></tr>}
    </tbody></table></div>
    <Dialog open={!!edit} onOpenChange={open => { if (!open && !saving) setEdit(null); }}><DialogContent className="max-h-[85dvh] overflow-y-auto"><DialogHeader><DialogTitle>{t(edit?.id ? 'تعديل' : 'إضافة سلفة أو خصم')}</DialogTitle></DialogHeader>{edit && <form onSubmit={e => { e.preventDefault(); save(); }} className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1">{t('الموظف')}<select required className="h-10 w-full rounded-md border border-input bg-background px-3" value={String(edit.data['رقم الموظف'] ?? '')} onChange={e => setEdit({ ...edit, data: { ...edit.data, 'رقم الموظف': e.target.value } })}><option value="">{t('اختر الموظف')}</option>{employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
      <label className="space-y-1">{t('النوع')}<select className="h-10 w-full rounded-md border border-input bg-background px-3" value={String(edit.data['النوع'] ?? 'سلفة')} onChange={e => setEdit({ ...edit, data: { ...edit.data, 'النوع': e.target.value } })}>{['سلفة', 'مخالفة', 'خصم راتب'].map(k => <option key={k} value={k}>{t(k)}</option>)}</select></label>
      {fields.map(k => <label key={k} className="space-y-1">{t(k)}<Input required={k === 'شهر الخصم' || k === 'المبلغ'} type={k === 'شهر الخصم' ? 'month' : k === 'تاريخ السلفة' ? 'date' : ['المبلغ', 'المسدد'].includes(k) ? 'number' : 'text'} min={0} step={['المبلغ', 'المسدد'].includes(k) ? '0.01' : undefined} value={String(edit.data[k] ?? '')} onChange={e => setEdit({ ...edit, data: { ...edit.data, [k]: ['المبلغ', 'المسدد'].includes(k) ? Number(e.target.value) : e.target.value } })} /></label>)}
      <Button disabled={saving} type="submit" className="sm:col-span-2">{t('حفظ')}</Button>
    </form>}</DialogContent></Dialog>
  </main>;
}
