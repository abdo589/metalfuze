import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type * as L from "leaflet";
import type { Site } from "@/components/RemoteAttendance";
import { currentLanguage } from "@/lib/i18n";

export type LivePoint = { id: string; name: string; lat: number; lng: number; label: string; onShift: boolean };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Last known spot of each employee, plus an optional trail for the selected one. */
export default function LiveTrackMap({ sites, points, trail }: { sites: Site[]; points: LivePoint[]; trail: [number, number][] }) {
  const box = useRef<HTMLDivElement | null>(null);
  const st = useRef<{ map: L.Map; L: typeof import("leaflet"); layer: L.LayerGroup } | null>(null);
  const draw = useRef<() => void>(() => {});
  const fitted = useRef(false);

  useEffect(() => {
    let alive = true;
    import("leaflet").then((Lm) => {
      if (!alive || !box.current || st.current) return;
      const map = Lm.map(box.current).setView([24.7624564, 46.6726382], 12);
      Lm.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
      st.current = { map, L: Lm, layer: Lm.layerGroup().addTo(map) };
      draw.current();
    });
    return () => { alive = false; st.current?.map.remove(); st.current = null; };
  }, []);

  draw.current = () => {
    const s = st.current;
    if (!s) return;
    const css = getComputedStyle(document.documentElement);
    const primary = css.getPropertyValue("--primary").trim() || "#0e7490";
    const success = css.getPropertyValue("--success").trim() || "#16a34a";
    const muted = css.getPropertyValue("--muted-foreground").trim() || "#888";
    const dir = currentLanguage() === "en" ? "ltr" : "rtl";
    s.layer.clearLayers();
    const pts: [number, number][] = [];
    for (const site of sites) {
      s.L.circle([site.lat, site.lng], { radius: site.radius_m, color: primary, weight: 1.5, fillOpacity: 0.08 }).bindPopup(esc(site.name)).addTo(s.layer);
    }
    if (trail.length > 1) s.L.polyline(trail, { color: primary, weight: 3, dashArray: "6 6" }).addTo(s.layer);
    for (const p of points) {
      const c = p.onShift ? success : muted;
      s.L.circleMarker([p.lat, p.lng], { radius: 9, color: c, weight: 2, fillColor: c, fillOpacity: 0.85 })
        .bindTooltip(esc(p.name), { permanent: points.length <= 15, direction: "top", offset: [0, -8] })
        .bindPopup(`<div dir="${dir}" style="font-size:12px;line-height:1.6"><b>${esc(p.name)}</b><br/>${esc(p.label)}</div>`)
        .addTo(s.layer);
      pts.push([p.lat, p.lng]);
    }
    pts.push(...trail);
    if (!fitted.current && pts.length) { fitted.current = true; s.map.fitBounds(s.L.latLngBounds(pts).pad(0.3), { maxZoom: 16 }); }
  };
  useEffect(() => { fitted.current = false; draw.current(); }, [trail.length > 0 ? trail[0]![0] : 0]);
  useEffect(() => { draw.current(); });

  return <div ref={box} className="h-[460px] rounded-lg border border-border" />;
}
