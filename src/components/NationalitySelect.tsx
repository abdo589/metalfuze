import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { t, useLanguage } from "@/lib/i18n";
import { NATIONALITIES, nationalityValue } from "@/lib/nationalities";

/** Nationality picked from a searchable list, in the language the screen is showing. */
export function NationalitySelect({ value, onChange, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const en = language === "en";
  const query = q.trim().toLowerCase();

  const matches = useMemo(
    () => NATIONALITIES.filter((n) => !query || n.ar.toLowerCase().includes(query) || n.en.toLowerCase().includes(query)),
    [query],
  );
  const exact = NATIONALITIES.some((n) => n.ar.toLowerCase() === query || n.en.toLowerCase() === query);
  const shown = en ? (NATIONALITIES.find((n) => n.ar === value)?.en ?? value) : value;

  const pick = (v: string) => { onChange(nationalityValue(v)); setOpen(false); setQ(""); };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQ(""); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open}
          className={`h-8 w-full justify-between px-3 font-normal ${className}`}>
          <span className="truncate">{shown || t("اختر الجنسية")}</span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t("ابحث عن جنسية…")} value={q} onValueChange={setQ} />
          <CommandList>
            <CommandEmpty>{query ? t("لا توجد جنسية بهذا الاسم") : ""}</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {matches.map((n) => (
                <CommandItem key={n.ar} value={n.ar} onSelect={() => pick(n.ar)} className="flex items-center justify-between gap-2">
                  <span className="truncate">{en ? n.en : n.ar}</span>
                  <Check className={value === n.ar ? "size-4 shrink-0" : "size-4 shrink-0 opacity-0"} />
                </CommandItem>
              ))}
              {query && !exact && (
                <CommandItem value={`__typed__:${q}`} onSelect={() => pick(q)} className="flex items-center justify-between gap-2">
                  <span className="truncate">{t("استخدم")} «{q.trim()}»</span>
                  <Check className="size-4 shrink-0 opacity-0" />
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
