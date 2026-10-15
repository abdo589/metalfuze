import { t, useLanguage, locale } from "@/lib/i18n";
import { useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportPdf } from "@/lib/pdf";

export function PdfButton() {
  useLanguage();
  const [busy, setBusy] = useState(false);
  return <Button variant="outline" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await exportPdf(); toast.success(t("تم حفظ PDF")); }
    catch { toast.error(t("تعذر حفظ PDF، حاول مرة أخرى")); }
    finally { setBusy(false); }
  }}>{busy ? <LoaderCircle className="animate-spin" /> : <FileDown />}{busy ? t("جارٍ تجهيز PDF…") : t("حفظ PDF")}</Button>;
}