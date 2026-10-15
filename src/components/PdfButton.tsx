import { useState } from "react";
import { FileDown, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportPdf } from "@/lib/pdf";

export function PdfButton() {
  const [busy, setBusy] = useState(false);
  return <Button variant="outline" disabled={busy} onClick={async () => {
    setBusy(true);
    try { await exportPdf(); toast.success("تم حفظ PDF"); }
    catch { toast.error("تعذر حفظ PDF، حاول مرة أخرى"); }
    finally { setBusy(false); }
  }}>{busy ? <LoaderCircle className="animate-spin" /> : <FileDown />}{busy ? "جارٍ تجهيز PDF…" : "حفظ PDF"}</Button>;
}