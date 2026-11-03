import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { t, useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";

export const Route = createFileRoute("/design-system")({
  head: () => ({
    meta: [
      { title: "دليل التصميم | Metal Fuze" },
      { name: "description", content: "مرجع ألوان وخطوط وعناصر واجهة Metal Fuze." },
      { property: "og:title", content: "دليل التصميم | Metal Fuze" },
      { property: "og:description", content: "مرجع ألوان وخطوط وعناصر واجهة Metal Fuze." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesignSystemPage,
});

const COLORS = ["background", "foreground", "card", "primary", "primary-foreground", "secondary", "muted", "muted-foreground", "accent", "border", "success", "warning", "info", "destructive", "sidebar",
  "stage-1", "stage-2", "stage-3", "stage-4", "stage-5", "stage-6", "stage-7", "chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];
const RADII = ["sm", "md", "lg", "xl", "2xl"];

function Swatch({ name, tick }: { name: string; tick: number }) {
  const [value, setValue] = useState("");
  useEffect(() => { setValue(getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()); }, [name, tick]);
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-card">
      <div className="h-16 border-b border-border" style={{ background: `var(--${name})` }} />
      <div className="p-2 text-xs">
        <div className="font-medium text-foreground" dir="ltr">--{name}</div>
        <div className="text-muted-foreground break-all" dir="ltr">{value || "—"}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3"><h2 className="font-display text-xl font-bold text-foreground">{t(title)}</h2>{children}</section>;
}

function DesignSystemPage() {
  useLanguage();
  const [tick, setTick] = useState(0);
  const toggleTheme = () => {
    const el = document.documentElement;
    const dark = !el.classList.contains("dark");
    el.classList.toggle("dark", dark);
    try { localStorage.setItem("metalfuze.theme", dark ? "dark" : "light"); } catch { /* ignore */ }
    setTick((n) => n + 1);
  };
  return (
    <div className="mx-auto max-w-6xl space-y-10 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">{t("دليل التصميم")}</h1>
          <p className="text-muted-foreground">{t("ألوان وخطوط وعناصر واجهة Metal Fuze كما تظهر في الموقع.")}</p>
        </div>
        <Button variant="outline" onClick={toggleTheme}>{t("تبديل فاتح / داكن")}</Button>
      </header>

      <Section title="الشعار">
        <div className="flex flex-wrap gap-4">
          <div className="rounded-xl border border-border bg-background p-6"><img src={logoAsset.url} alt="Metal Fuze" className="h-20 w-auto" /></div>
          <div className="rounded-xl border border-border bg-sidebar p-6"><img src={logoAsset.url} alt="Metal Fuze" className="h-20 w-auto" /></div>
        </div>
        <p className="text-sm text-muted-foreground">{t("استخدم الشعار بمساحة فارغة حوله، ولا تغيّر ألوانه أو نسبه.")}</p>
      </Section>

      <Section title="الألوان">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {COLORS.map((c) => <Swatch key={c} name={c} tick={tick} />)}
        </div>
      </Section>

      <Section title="الخطوط">
        <Card><CardContent className="space-y-2 pt-6">
          <p className="font-display text-4xl font-bold text-foreground">{t("عنوان رئيسي")} — Heading 1</p>
          <p className="font-display text-2xl font-bold text-foreground">{t("عنوان فرعي")} — Heading 2</p>
          <p className="font-display text-xl font-semibold text-foreground">{t("عنوان قسم")} — Heading 3</p>
          <p className="text-base text-foreground">{t("نص عادي للمحتوى والفقرات.")} Body text.</p>
          <p className="text-sm text-muted-foreground">{t("نص ثانوي وملاحظات.")} Secondary text.</p>
        </CardContent></Card>
      </Section>

      <Section title="الزوايا والظلال">
        <div className="flex flex-wrap gap-4">
          {RADII.map((r) => (
            <div key={r} className="flex h-20 w-24 items-center justify-center border border-border bg-card text-xs text-foreground shadow-md" style={{ borderRadius: `var(--radius-${r})` }} dir="ltr">{r}</div>
          ))}
        </div>
      </Section>

      <Section title="الأزرار">
        <div className="flex flex-wrap gap-2">
          <Button>{t("أساسي")}</Button>
          <Button variant="secondary">{t("ثانوي")}</Button>
          <Button variant="outline">{t("إطار")}</Button>
          <Button variant="ghost">{t("شفاف")}</Button>
          <Button variant="destructive">{t("حذف")}</Button>
          <Button variant="link">{t("رابط")}</Button>
          <Button disabled>{t("معطّل")}</Button>
          <Button size="sm">{t("صغير")}</Button>
          <Button size="lg">{t("كبير")}</Button>
        </div>
      </Section>

      <Section title="الشارات">
        <div className="flex flex-wrap gap-2">
          <Badge>{t("افتراضي")}</Badge>
          <Badge variant="secondary">{t("ثانوي")}</Badge>
          <Badge variant="outline">{t("إطار")}</Badge>
          <Badge variant="destructive">{t("خطر")}</Badge>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => <span key={n} className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-primary-foreground" style={{ background: `var(--stage-${n})` }}>{t("مرحلة")} {n}</span>)}
        </div>
      </Section>

      <Section title="خانات الإدخال">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder={t("اكتب هنا")} />
          <Input disabled placeholder={t("معطّل")} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
            <option>{t("اختر")}</option><option>{t("أخرى")}</option>
          </select>
        </div>
      </Section>

      <Section title="الكروت والتبويبات">
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle>{t("عنوان الكارت")}</CardTitle><CardDescription>{t("وصف قصير")}</CardDescription></CardHeader>
            <CardContent className="space-y-2"><Progress value={65} /><p className="text-sm text-muted-foreground">65%</p></CardContent></Card>
          <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">{t("الأول")}</TabsTrigger><TabsTrigger value="b">{t("الثاني")}</TabsTrigger></TabsList>
            <TabsContent value="a" className="text-sm text-foreground">{t("محتوى التبويب الأول")}</TabsContent>
            <TabsContent value="b" className="text-sm text-foreground">{t("محتوى التبويب الثاني")}</TabsContent></Tabs>
        </div>
      </Section>

      <Section title="التنبيهات والنوافذ">
        <div className="space-y-3">
          <Alert><AlertTitle>{t("تنبيه")}</AlertTitle><AlertDescription>{t("رسالة معلومات للمستخدم.")}</AlertDescription></Alert>
          <Alert variant="destructive"><AlertTitle>{t("خطأ")}</AlertTitle><AlertDescription>{t("حدث خطأ أثناء الحفظ.")}</AlertDescription></Alert>
          <Dialog><DialogTrigger asChild><Button variant="outline">{t("افتح نافذة")}</Button></DialogTrigger>
            <DialogContent><DialogHeader><DialogTitle>{t("عنوان النافذة")}</DialogTitle><DialogDescription>{t("محتوى النافذة المنبثقة.")}</DialogDescription></DialogHeader></DialogContent></Dialog>
        </div>
      </Section>

      <Section title="الجداول">
        <Card><Table><TableHeader><TableRow><TableHead>{t("الاسم")}</TableHead><TableHead>{t("الحالة")}</TableHead><TableHead>{t("المبلغ")}</TableHead></TableRow></TableHeader>
          <TableBody>
            <TableRow><TableCell>{t("مشروع أ")}</TableCell><TableCell><Badge>{t("جاري")}</Badge></TableCell><TableCell>12,000</TableCell></TableRow>
            <TableRow><TableCell>{t("مشروع ب")}</TableCell><TableCell><Badge variant="secondary">{t("مكتمل")}</Badge></TableCell><TableCell>8,500</TableCell></TableRow>
          </TableBody></Table></Card>
      </Section>
    </div>
  );
}
