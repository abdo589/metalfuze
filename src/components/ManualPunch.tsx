import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { t } from "@/lib/i18n";
import { manualPunch } from "@/lib/checkin.functions";

const nowLocal = () => {
  const d = new Date(Date.now() + 3 * 3600_000); // Riyadh
  return d.toISOString().slice(0, 16);
};

/** HR/admin taps to mark an employee present or leaving (Riyadh time). */
export function ManualPunch({ employees, onDone }: { employees: { id: string; name: string; active: boolean }[]; onDone: () => void }) {
  const [emp, setEmp] = useState("");
  const [at, setAt] = useState(nowLocal());
  const [busy, setBusy] = useState(false);
  const punch = useServerFn(manualPunch);

  async function go(action: "in" | "out") {
    if (!emp) { toast.error(t("اختر الموظف")); return; }
    setBusy(true);
    try {
      const r = await punch({ data: { employeeId: emp, action, at: `${at}:00+03:00` } });
      if (!r.ok) toast.error(r.error === "future" ? t("لا يمكن التسجيل بوقت مستقبلي") : t("تعذر التسجيل"));
      else { toast.success(action === "in" ? t("تم تسجيل الحضور") : t("تم تسجيل الانصراف")); onDone(); }
    } catch { toast.error(t("تعذر التسجيل")); }
    setBusy(false);
  }

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4 print:hidden">
      <h2 className="font-display text-lg font-bold">{t("تسجيل حضور يدوي")}</h2>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={emp} onChange={(e) => setEmp(e.target.value)}>
          <option value="">{t("اختر الموظف")}</option>
          {employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.id} — {e.name}</option>)}
        </select>
        <Input type="datetime-local" dir="ltr" value={at} onChange={(e) => setAt(e.target.value)} />
        <Button disabled={busy} onClick={() => go("in")}><LogIn /> {t("تسجيل حضور")}</Button>
        <Button disabled={busy} variant="outline" onClick={() => go("out")}><LogOut /> {t("تسجيل انصراف")}</Button>
      </div>
    </section>
  );
}
