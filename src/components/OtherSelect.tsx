/**
 * Dropdown whose "أخرى" entry means "add a new value": picking it opens a field,
 * and the typed value is saved so it appears in the list for everyone next time.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useCustomOptions } from "@/lib/custom-options";

const DEFAULT_CLS = "h-9 w-full rounded-md border bg-background px-2 text-sm";

type Props = {
  /** Identifies this dropdown's saved extras, e.g. "custody_category". */
  list: string;
  /** Fixed options; may contain "أخرى". */
  base: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
};

export function OtherSelect({ list, base, value, onChange, className = DEFAULT_CLS }: Props) {
  const { options, add } = useCustomOptions(list, base);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A value saved before (free text) that isn't in the list: keep it editable.
  const unknown = !!value && !options.includes(value);
  const showInput = adding || unknown;
  const draft = text ?? (adding ? "" : value);

  async function submit() {
    const v = draft.trim();
    if (!v || busy) return;
    setBusy(true);
    const saved = await add(v);
    setBusy(false);
    if (saved) { onChange(saved); setText(null); setAdding(false); }
  }

  return (
    <div className="space-y-2">
      <select
        className={className}
        value={options.includes(value) ? value : ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__other__") { setText(""); setAdding(true); return; }
          setText(null); setAdding(false); onChange(v);
        }}
      >
        <option value="">{t("اختر")}</option>
        {options.map((o) => <option key={o} value={o}>{t(o)}</option>)}
        <option value="__other__">{t("أخرى")}</option>
      </select>
      {showInput && <div className="flex gap-2">
        <Input value={draft} placeholder={t("اكتب اسمًا جديدًا")} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }} />
        <Button type="button" size="sm" variant="outline" onClick={() => void submit()} disabled={busy || !draft.trim()}>
          <Plus /> {t("إضافة")}
        </Button>
      </div>}
    </div>
  );
}
