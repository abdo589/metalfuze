import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { Map as MapIcon } from "lucide-react";
import type * as L from "leaflet";
import { riyadh } from "@/lib/attendance";
import type { Punch } from "@/lib/attendance";
import { currentLanguage, t } from "@/lib/i18n";
import type { Site } from "@/components/RemoteAttendance";

type Leaflet = typeof import("leaflet");
type MapState = { map: L.Map; L: Leaflet; layer: L.LayerGroup };

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[c]!));

/** One map for the attendance page: work sites with their radius, plus every phone punch at its exact spot. */
export function AttendanceMap({ sites, punches, nameOf }: { sites: Site[]; punches: Punch[]; nameOf: (id: string) => string }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const state = useRef<MapState | null>(null);
  const drawRef = useRef<() => void>(() => {});
  const fitted = useRef(false);

  useEffect(() => {
    let alive = true;
    import("leaflet").then((Lmod) => {
      if (!alive || !boxRef.current || state.current) return;
      const map = Lmod.map(boxRef.current).setView([24.7136, 46.6753], 11);
      Lmod.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
      state.current = { map, L: Lmod, layer: Lmod.layerGroup().addTo(map) };
      drawRef.current();
    });
    return () => {
      alive = false;
      state.current?.map.remove();
      state.current = null;
    };
  }, []);

  function draw() {
    const s = state.current;
    if (!s) return;
    const { L: Lmod, map, layer } = s;
    layer.clearLayers();
    const style = getComputedStyle(document.documentElement);
    const primary = style.getPropertyValue("--primary").trim() || "#0e7490";
    const success = style.getPropertyValue("--success").trim() || "#16a34a";
    const warning = style.getPropertyValue("--warning").trim() || "#d97706";
    const dir = currentLanguage() === "en" ? "ltr" : "rtl";
    const pts: [number, number][] = [];

    for (const site of sites) {
      Lmod.circle([site.lat, site.lng], {
        radius: site.radius_m, color: primary, weight: 1.5, fillColor: primary, fillOpacity: 0.08,
      }).addTo(layer);
      Lmod.marker([site.lat, site.lng], {
        icon: Lmod.divIcon({
          className: "",
          html: `<div style="width:24px;height:24px;border-radius:50%;background:${primary};color:#fff;display:grid;place-items:center;font-size:12px;font-weight:700;box-shadow:0 2px 6px rgb(0 0 0/.35);border:2px solid #fff">◆</div>`,
          iconSize: [24, 24], iconAnchor: [12, 12],
        }),
      }).bindPopup(`<div dir="${dir}" style="font-size:12px;line-height:1.6"><b>${esc(site.name)}</b><br/>${site.radius_m} ${esc(t("متر"))}</div>`).addTo(layer);
      pts.push([site.lat, site.lng]);
    }

    for (const p of punches) {
      if (p.source !== "remote" || p.lat == null || p.lng == null) continue;
      const label = p.status === 1 ? t("انصراف") : t("حضور");
      const color = p.status === 1 ? warning : success;
      const d = riyadh(p.punched_at);
      const body = `<b>${esc(nameOf(p.device_user_id))}</b><br/>${esc(label)} · ${d.date} ${d.time}`
        + (p.site_name ? `<br/>${esc(p.site_name)}` : "")
        + (p.distance_m != null ? ` · ${p.distance_m} ${esc(t("متر"))}` : "");
      Lmod.circleMarker([p.lat, p.lng], { radius: 8, color, weight: 2, fillColor: color, fillOpacity: 0.85 })
        .bindPopup(`<div dir="${dir}" style="font-size:12px;line-height:1.6">${body}</div>`)
        .addTo(layer);
      pts.push([p.lat, p.lng]);
    }

    if (!fitted.current && pts.length > 0) {
      fitted.current = true;
      map.fitBounds(Lmod.latLngBounds(pts).pad(0.25));
    }
  }

  useEffect(() => {
    drawRef.current = draw;
    drawRef.current();
  });

  const empty = sites.length === 0 && !punches.some((p) => p.source === "remote" && p.lat != null);
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><MapIcon className="size-5" /> {t("خريطة المواقع والبصمات")}</h2>
      <p className="text-sm text-muted-foreground">{t("كل بصمة جوال تظهر في مكانها الفعلي، وكل موقع عمل داخل دائرة المسافة المسموحة.")}</p>
      <div ref={boxRef} className="h-[420px] rounded-lg border border-border" />
      {empty && <p className="text-sm text-muted-foreground">{t("لا توجد مواقع ولا بصمات جوال على الخريطة بعد")}</p>}
    </section>
  );
}
