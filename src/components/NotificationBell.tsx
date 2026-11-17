import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { badgeLabel, useBadgeCounts } from "@/lib/app-badge";
import { t } from "@/lib/i18n";

const ITEMS = [
  { k: "messages", to: "/messages", label: "رسائل غير مقروءة" },
  { k: "sales", to: "/sales", label: "طلبات مبيعات بانتظارك" },
  { k: "leaves", to: "/leaves", label: "طلبات إجازة بانتظار موافقتك" },
  { k: "meetings", to: "/meetings", label: "دعوات اجتماعات بانتظار ردك" },
] as const;

/** In-site bell with the same total as the red counter on the laptop/phone icon. */
export function NotificationBell() {
  const c = useBadgeCounts();
  const [open, setOpen] = useState(false);
  const total = c.messages + c.sales + c.leaves + c.meetings;
  const label = badgeLabel(total);
  const rows = ITEMS.filter((i) => c[i.k] > 0);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="relative shrink-0" aria-label={`${t("الإشعارات")}${label ? ` (${label})` : ""}`} title={t("الإشعارات")}>
          <Bell />
          {label && (
            <span data-testid="bell-count" className="absolute -top-0.5 -end-0.5 min-w-5 rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-5 text-destructive-foreground">
              {label}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-2">
        <p className="px-2 pb-2 text-sm font-semibold">{t("الإشعارات")}</p>
        {rows.length === 0 ? (
          <p className="px-2 pb-2 text-sm text-muted-foreground">{t("لا توجد إشعارات جديدة")}</p>
        ) : rows.map((i) => (
          <Link key={i.k} to={i.to} onClick={() => setOpen(false)}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent">
            <span>{t(i.label)}</span>
            <span className="min-w-6 rounded-full bg-destructive px-1.5 text-center text-xs font-bold leading-6 text-destructive-foreground">{badgeLabel(c[i.k])}</span>
          </Link>
        ))}
      </PopoverContent>
    </Popover>
  );
}
