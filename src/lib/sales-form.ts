// Shared pricing-request form, approval chain and labels for the sales and temporary-projects pages.
export type Req = Record<string, string | string[]>;
export type F = { k: string; l: string; req?: boolean; opts?: string[]; multi?: boolean; hint?: string; long?: boolean; link?: boolean };
export type LogE = { at: string; by: string; from: string; to: string; action: string; note: string };

/** Rejected requests leave the approval chain and wait in Eilaf's «مشاريع مؤقتة» list. */
export const REJECTED_STEP = "rejected";

// Approval chain: sales → Eilaf review → Haitham pricing → Eilaf quotation → Haitham approval → CEO → back to Hala & Eilaf.
export const WF: { k: string; l: string; email?: string }[] = [
  { k: "sales_entry", l: "بيانات التسعير من المبيعات" },
  { k: "eilaf_review", l: "مراجعة وموافقة Eilaf", email: "eilaf@metalfuze.local" },
  { k: "haitham_pricing", l: "التسعير — Haitham", email: "haitham@metalfuze.local" },
  { k: "eilaf_quotation", l: "عرض السعر — Eilaf", email: "eilaf@metalfuze.local" },
  { k: "haitham_approval", l: "التعميد — Haitham", email: "haitham@metalfuze.local" },
  { k: "ceo_approval", l: "موافقة وتعميد CEO", email: "ceo@metalfuze.local" },
  { k: "done", l: "مكتمل — المبيعات و Eilaf" },
];
export const wfLabel = (k: string) => k === REJECTED_STEP ? "مشاريع مؤقتة" : WF.find((s) => s.k === k)?.l ?? k;
export const logActionLabel = (a: string) => a === "reject" ? "رفض" : a === "restore" ? "إرجاع للمبيعات" : a === "move" ? "نقل" : "موافقة";

// Questions of the "طلب تسعيرة مشروع جديد" pricing-request form, built into the site.
export const REQUEST_FORM: { title: string; fields: F[] }[] = [
  { title: "بيانات موظف المبيعات", fields: [
    { k: "sales_name", l: "اسم موظف المبيعات", req: true, opts: ["هالة الخميسي", "نجلاء عساف", "أخرى"] },
    { k: "sales_email", l: "البريد الإلكتروني لموظف المبيعات", req: true },
    { k: "work_type", l: "نوع الأعمال", req: true, opts: ["أعمال العظم", "أعمال التشطيب", "أعمال الإيبوكسي", "أعمال الخشبيات", "أعمال اللوحات", "أعمال متعددة التخصصات"] },
  ] },
  { title: "بيانات العميل", fields: [
    { k: "contact_name", l: "اسم مسؤول التواصل", req: true },
    { k: "contact_title", l: "المسمى الوظيفي لمسؤول التواصل", req: true, opts: ["مالك", "مدير عام", "مدير مشروع", "مهندس مشروع", "مهندس موقع", "مدير مشتريات", "مهندس مشتريات", "أخرى"] },
    { k: "contact_phone", l: "رقم جوال مسؤول التواصل", req: true },
    { k: "contact_email", l: "البريد الإلكتروني لمسؤول التواصل", req: true },
    { k: "client_capacity", l: "صفة جهة العميل", req: true, opts: ["مالك المشروع", "مقاول رئيسي", "مقاول من الباطن", "استشاري", "أخرى"] },
  ] },
  { title: "بيانات المشروع", fields: [
    { k: "in_riyadh", l: "هل المشروع داخل مدينة الرياض؟", opts: ["نعم", "لا"] },
    { k: "scope", l: "وصف مختصر لنطاق العمل المطلوب", req: true, long: true },
    { k: "project_state", l: "حالة المشروع الحالية", req: true, multi: true, opts: ["لم يبدأ", "تحت التنفيذ", "قائم ويحتاج تجديدًا"] },
    { k: "start_time", l: "موعد بدء التنفيذ المتوقع", req: true, opts: ["فوري", "خلال شهر", "خلال 1-3 أشهر", "أكثر من 3 أشهر", "غير محدد"] },
    { k: "has_consultant", l: "هل يوجد استشاري للمشروع؟", opts: ["نعم", "لا", "غير معروف"] },
  ] },
  { title: "بيانات طلب التسعير والمستندات", fields: [
    { k: "pricing_type", l: "نوع التسعيرة", req: true, opts: ["تسعيرة مبدئية", "تسعيرة تفصيلية", "مناقصة"] },
    { k: "has_docs", l: "هل توجد مستندات للمشروع؟", opts: ["نعم", "لا"] },
    { k: "budget_mentioned", l: "هل ذكر العميل ميزانية أو سعرًا متوقعًا للمشروع؟", req: true, opts: ["نعم", "لا"] },
    { k: "budget", l: "الميزانية أو النطاق السعري المتوقع من العميل (ريال سعودي)", hint: "يُعبأ فقط إذا ذكر العميل مبلغًا محددًا أو نطاقًا تقريبيًا، ولا يُكتب أي رقم غير مؤكد." },
    { k: "link_url", l: "رابط المشروع", link: true, hint: "الصق رابطًا خارجيًا: مجلد Google Drive، ملف، صور المشروع، أو أي صفحة مطلوبة للتسعير." },
  ] },
];

/** Open a pasted link even when the user forgot "https://". */
export const href = (s: string) => (/^https?:\/\//i.test(s) ? s : `https://${s}`);
export const docFileName = (p: string) => (p.split("/").pop() ?? p).replace(/^\d+_/, "");
