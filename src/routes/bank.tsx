import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Landmark, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { t, useLanguage, locale } from "@/lib/i18n";
import { useCanEdit } from "@/lib/permissions";
import { fmtMoney } from "@/lib/projects";
import { txnTotals, type BankTxn } from "@/lib/bank";
import { bankStatus, disconnectBank, refreshBank, startBankConnect } from "@/lib/bank.functions";

export const Route = createFileRoute("/bank")({
  head: () => ({
    meta: [
      { title: "رصيد البنك — Metal Fuze" },
      { name: "description", content: "رصيد حساب بنك الرياض وآخر الحركات مباشرة." },
      { property: "og:title", content: "رصيد البنك — Metal Fuze" },
      { property: "og:description", content: "رصيد البنك وآخر الحركات." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Bank,
});

type Snap = { account_name: string; balance: number; available: number | null; currency: string; transactions: BankTxn[]; fetched_at: string };

declare global { interface Window { Lean?: { connect: (o: Record<string, unknown>) => void } } }

function loadLean() {
  return new Promise<void>((res, rej) => {
    if (window.Lean) return res();
    const s = document.createElement("script");
    s.src = "https://cdn.leantech.me/link/sdk/web/latest/Lean.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("sdk"));
    document.body.appendChild(s);
  });
}

function Bank() {
  useLanguage();
  const canEdit = useCanEdit();
  const statusFn = useServerFn(bankStatus), startFn = useServerFn(startBankConnect);
  const refreshFn = useServerFn(refreshBank), discFn = useServerFn(disconnectBank);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [connected, setConnected] = useState(false);
  const [snaps, setSnaps] = useState<Snap[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const { data: c } = await supabase.from("bank_connections").select("entity_id").limit(1).maybeSingle();
    setConnected(!!c?.entity_id);
    const { data } = await supabase.from("bank_snapshots").select("*").order("fetched_at", { ascending: false }).limit(20);
    const latest = new Map<string, Snap>();
    for (const s of (data ?? []) as unknown as Snap[]) if (!latest.has(s.account_name)) latest.set(s.account_name, s);
    setSnaps([...latest.values()]);
  }, []);

  const refresh = useCallback(async (silent = false) => {
    setBusy(true);
    try { const r = await refreshFn(); if (!r.ok && !silent) toast.error(t("الحساب غير مربوط بعد")); await load(); }
    catch { if (!silent) toast.error(t("تعذر تحديث الرصيد من البنك")); }
    finally { setBusy(false); }
  }, [refreshFn, load]);

  useEffect(() => {
    statusFn().then((s) => setConfigured(s.configured)).catch(() => setConfigured(false));
    load().then(() => refresh(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    setBusy(true);
    try {
      const cfg = await startFn();
      await loadLean();
      window.Lean!.connect({
        app_token: cfg.appToken, customer_id: cfg.customerId, access_token: cfg.accessToken,
        permissions: ["identity", "accounts", "balance", "transactions"], sandbox: cfg.sandbox,
        language: document.documentElement.lang === "en" ? "en" : "ar",
        callback: (r: { status?: string }) => { if (r?.status === "SUCCESS") refresh(); else setBusy(false); },
      });
    } catch { toast.error(t("تعذر بدء الربط مع البنك")); setBusy(false); }
  };

  const total = snaps.reduce((s, x) => s + Number(x.balance), 0);
  const available = snaps.reduce((s, x) => s + Number(x.available ?? x.balance), 0);
  const last = snaps[0]?.fetched_at;
  const txns = useMemo(() => snaps.flatMap((s) => s.transactions ?? [])
    .filter((x) => !q || x.description.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [snaps, q]);
  const tot = txnTotals(txns);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Landmark className="h-6 w-6 text-primary" />{t("رصيد البنك")} — {t("بنك الرياض")}</h1>
        <div className="flex gap-2">
          {connected && <Button variant="outline" onClick={() => refresh()} disabled={busy}><RefreshCw className="h-4 w-4" />{t("تحديث الآن")}</Button>}
          {canEdit && configured && !connected && <Button onClick={connect} disabled={busy}>{t("ربط بنك الرياض")}</Button>}
          {canEdit && connected && <Button variant="ghost" onClick={async () => { await discFn(); await load(); }}><Unplug className="h-4 w-4" />{t("فصل الحساب")}</Button>}
        </div>
      </div>

      {configured === false && (
        <div className="rounded-lg border border-border bg-muted p-4 text-sm">{t("لم يتم الربط بعد — بانتظار بيانات خدمة Lean من الإدارة")}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[[t("الرصيد الحالي"), fmtMoney(total)], [t("الرصيد المتاح"), fmtMoney(available)],
          [t("آخر تحديث"), last ? new Date(last).toLocaleString(locale()) : "—"]].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4"><div className="text-sm text-muted-foreground">{k}</div><div className="mt-1 text-2xl font-bold">{v}</div></div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t("آخر الحركات")}</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-primary">{t("وارد")}: {fmtMoney(tot.inflow)}</span>
            <span className="text-destructive">{t("صادر")}: {fmtMoney(tot.outflow)}</span>
            <Input className="w-48" placeholder={t("بحث")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-muted-foreground"><th className="p-2 text-start">{t("التاريخ")}</th><th className="p-2 text-start">{t("الوصف")}</th><th className="p-2 text-start">{t("وارد")}</th><th className="p-2 text-start">{t("صادر")}</th></tr></thead>
          <tbody>
            {txns.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("لا توجد حركات بعد")}</td></tr>}
            {txns.map((x, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="p-2">{x.date ? new Date(x.date).toLocaleDateString(locale()) : "—"}</td>
                <td className="p-2">{x.description}</td>
                <td className="p-2 text-primary">{x.type === "in" ? fmtMoney(x.amount) : ""}</td>
                <td className="p-2 text-destructive">{x.type === "out" ? fmtMoney(x.amount) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
