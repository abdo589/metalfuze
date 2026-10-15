import { t as translate, currentLanguage, locale } from "./i18n";
import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";
import { downloadBlob } from "./export";

/** Brand colors (match the site palette). */
const TEAL = "FF1F8A87";
const DARK = "FF17494A";
const ZEBRA = "FFF1F8F7";
const BORDER = "FFCFDCDB";

export type Col = { header: string; width?: number; format?: "money" | "pct" | "int" | "text" };
export type SheetSpec = {
  name: string;
  title: string;
  columns: Col[];
  rows: (string | number | null | undefined)[][];
  /** Column indexes to sum into a totals row. */
  totals?: number[];
};
export type KV = [string, string | number, Col["format"]?];

let logoCache: ArrayBuffer | null = null;
async function getLogo() {
  if (!logoCache) logoCache = await (await fetch(logoAsset.url)).arrayBuffer();
  return logoCache;
}

const fmt = (f?: Col["format"]) =>
  f === "money" ? `#,##0 "${currentLanguage() === 'en' ? 'SAR' : 'ر.س'}"` : f === "pct" ? "0%" : f === "int" ? "#,##0" : undefined;

/**
 * Build a branded, RTL Excel workbook: company logo on top, report title and date,
 * optional summary block, styled header, zebra rows, borders, totals and frozen header.
 */
export async function exportBrandedExcel(opts: {
  filename: string;
  reportTitle: string;
  summary?: KV[];
  sheets: SheetSpec[];
}) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Metal Fuze";
  wb.created = new Date();
  const logoId = wb.addImage({ buffer: await getLogo(), extension: "png" });
  const today = new Date().toLocaleDateString(locale(), { dateStyle: "full" });

  const letterhead = (ws: import("exceljs").Worksheet, span: number, title: string) => {
    ws.views = [{ rightToLeft: currentLanguage() === "ar", showGridLines: false }];
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 30;
    ws.getRow(3).height = 22;
    ws.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 200, height: 83 } });
    const last = Math.max(span, 3);
    ws.mergeCells(1, 3, 1, last);
    const t = ws.getCell(1, 3);
    t.value = translate(opts.reportTitle);
    t.font = { name: "Arial", size: 18, bold: true, color: { argb: DARK } };
    t.alignment = { horizontal: "center", vertical: "middle" };
    ws.mergeCells(2, 3, 2, last);
    const s = ws.getCell(2, 3);
    s.value = translate(title);
    s.font = { name: "Arial", size: 13, bold: true, color: { argb: TEAL } };
    s.alignment = { horizontal: "center", vertical: "middle" };
    ws.mergeCells(3, 3, 3, last);
    const d = ws.getCell(3, 3);
    d.value = `${translate("تاريخ الإصدار:")} ${today}`;
    d.font = { name: "Arial", size: 10, color: { argb: "FF666666" } };
    d.alignment = { horizontal: "center" };
    ws.mergeCells(4, 1, 4, last);
    ws.getRow(4).height = 4;
    ws.getCell(4, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    ws.pageSetup = {
      paperSize: 9, orientation: span > 8 ? "landscape" : "portrait",
      fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    ws.headerFooter.oddFooter = currentLanguage() === "en" ? "&LMetal Fuze — Accuracy Has No Limit&RPage &P of &N" : "&LMetal Fuze — Accuracy Has No Limit&Rصفحة &P من &N";
  };

  const border = { style: "thin" as const, color: { argb: BORDER } };
  const allBorders = { top: border, left: border, bottom: border, right: border };

  if (opts.summary?.length) {
    const ws = wb.addWorksheet(translate("ملخص"));
    letterhead(ws, 4, "الملخص التنفيذي");
    ws.getColumn(1).width = 16;
    ws.getColumn(2).width = 16;
    ws.getColumn(3).width = 34;
    ws.getColumn(4).width = 26;
    opts.summary.forEach(([k, v, f], i) => {
      const r = 6 + i;
      ws.getRow(r).height = 24;
      const kc = ws.getCell(r, 3);
      const vc = ws.getCell(r, 4);
      kc.value = translate(k);
      vc.value = v;
      kc.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
      kc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
      vc.font = { name: "Arial", bold: true, size: 12, color: { argb: DARK } };
      vc.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      const numberFormat = fmt(f);
      if (numberFormat) vc.numFmt = numberFormat;
      [kc, vc].forEach((c) => {
        c.border = allBorders;
        c.alignment = { horizontal: "center", vertical: "middle" };
      });
    });
  }

  for (const sh of opts.sheets) {
    const ws = wb.addWorksheet(translate(sh.name).slice(0, 31));
    const n = sh.columns.length;
    letterhead(ws, n, sh.title);
    const H = 6;
    sh.columns.forEach((c, i) => (ws.getColumn(i + 1).width = c.width ?? 16));
    const hr = ws.getRow(H);
    hr.height = 28;
    sh.columns.forEach((c, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = translate(c.header);
      cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = allBorders;
    });
    sh.rows.forEach((row, ri) => {
      const r = ws.getRow(H + 1 + ri);
      r.height = 20;
      row.forEach((v, ci) => {
        const cell = r.getCell(ci + 1);
        cell.value = v ?? "";
        const f = fmt(sh.columns[ci]?.format);
        if (f && typeof v === "number") cell.numFmt = f;
        cell.font = { name: "Arial", size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = allBorders;
        if (ri % 2) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      });
    });
    if (sh.totals?.length) {
      const r = ws.getRow(H + 1 + sh.rows.length);
      r.height = 24;
      for (let ci = 0; ci < n; ci++) {
        const cell = r.getCell(ci + 1);
        if (ci === 0) cell.value = translate("الإجمالي");
        else if (sh.totals.includes(ci))
          cell.value = sh.rows.reduce((a, x) => a + (typeof x[ci] === "number" ? (x[ci] as number) : 0), 0);
        const f = fmt(sh.columns[ci]?.format);
        if (f && sh.totals.includes(ci)) cell.numFmt = f;
        cell.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: DARK } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = allBorders;
      }
    }
    ws.views = [{ rightToLeft: currentLanguage() === "ar", showGridLines: false, state: "frozen", ySplit: H }];
    ws.autoFilter = { from: { row: H, column: 1 }, to: { row: H, column: n } };
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    opts.filename,
  );
}
