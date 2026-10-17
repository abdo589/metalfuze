import { useRef, useState } from "react";
import { Camera, LoaderCircle, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, useLanguage } from "@/lib/i18n";
import { getPosition, resizePhoto } from "@/lib/checkin-client";

/** Two big buttons: pick action → GPS → front camera selfie → submit. */
export function SelfieCheckin({ disabled, onSubmit }: {
  disabled?: boolean;
  onSubmit: (d: { action: "in" | "out"; lat: number; lng: number; photo: string }) => Promise<void>;
}) {
  useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [action, setAction] = useState<"in" | "out">("in");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setBusy(t("جارٍ تحديد موقعك…"));
      const pos = await getPosition();
      setBusy(t("جارٍ الإرسال…"));
      await onSubmit({ action, ...pos, photo: await resizePhoto(file) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  const start = (a: "in" | "out") => { setAction(a); input.current?.click(); };
  return (
    <div className="space-y-3">
      <input ref={input} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" className="h-24 flex-col text-lg" disabled={disabled || !!busy} onClick={() => start("in")}>
          <LogIn className="size-6" /> {t("تسجيل حضور")}
        </Button>
        <Button size="lg" variant="outline" className="h-24 flex-col text-lg" disabled={disabled || !!busy} onClick={() => start("out")}>
          <LogOut className="size-6" /> {t("تسجيل انصراف")}
        </Button>
      </div>
      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        {busy ? <><LoaderCircle className="size-4 animate-spin" /> {busy}</> : <><Camera className="size-4" /> {t("سيُطلب منك التقاط صورة سيلفي وتحديد موقعك")}</>}
      </p>
      {error && <p className="rounded-lg bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</p>}
    </div>
  );
}
