import { downloadBlob } from "./export";

/** Capture the paper layout and paginate between rows, never through them. */
export async function exportPdf() {
  const root = document.querySelector<HTMLElement>("[data-report-document]");
  if (!root) throw new Error("Report not found");
  await document.fonts.ready;
  await Promise.all(Array.from(root.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"), import("jspdf"),
  ]);
  const printRules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSMediaRule && rule.conditionText === "print") {
          printRules.push(...Array.from(rule.cssRules).filter((r) => !(r instanceof CSSPageRule)).map((r) => r.cssText));
        }
      }
    } catch { /* Cross-origin font styles are already loaded. */ }
  }
  let protectedBlocks: { top: number; bottom: number }[] = [];
  let tables: { top: number; bottom: number; headTop: number; headBottom: number }[] = [];
  let contentBottom = 0;
  const canvas = await html2canvas(root, {
    scale: 2, useCORS: true, windowWidth: 1120, scrollX: 0, scrollY: 0,
    onclone: (doc) => {
      const style = doc.createElement("style");
      style.textContent = printRules.join("\n");
      doc.head.append(style);
      const copy = doc.querySelector<HTMLElement>("[data-report-document]");
      if (!copy) return;
      copy.style.width = "1050px";
      copy.style.maxWidth = "1050px";
      // Keep full names on one line: find name columns by their header and stop them wrapping.
      const NAME_RE = /اسم|الاسم|الموظف|المدير|المقيّم|المقيم|name|employee|manager/i;
      copy.querySelectorAll("table").forEach((tb) => {
        const heads = Array.from(tb.querySelectorAll("thead tr:last-child th, thead tr:last-child td"));
        const idx = heads.map((h, i) => (NAME_RE.test(h.textContent ?? "") ? i : -1)).filter((i) => i >= 0);
        if (!idx.length) return;
        tb.querySelectorAll("tr").forEach((tr) => {
          idx.forEach((i) => {
            const cell = tr.children[i] as HTMLElement | undefined;
            if (cell) { cell.style.whiteSpace = "nowrap"; cell.style.wordBreak = "keep-all"; }
          });
        });
      });
      const origin = copy.getBoundingClientRect().top;
      protectedBlocks = Array.from(copy.querySelectorAll<HTMLElement>("tr, header, .print-letterhead, .surface:not(:has(table)), [data-pdf-keep]"))
        .filter((el) => el.getBoundingClientRect().height > 0)
        .map((el) => ({ top: el.getBoundingClientRect().top - origin, bottom: el.getBoundingClientRect().bottom - origin }));
      tables = Array.from(copy.querySelectorAll("table"))
        .filter((tb) => tb.getBoundingClientRect().height > 0)
        .map((tb) => {
          const r = tb.getBoundingClientRect();
          const head = tb.querySelector("thead") ?? tb.rows[0] ?? null;
          const hr = head?.getBoundingClientRect();
          return {
            top: r.top - origin, bottom: r.bottom - origin,
            headTop: hr ? hr.top - origin : r.top - origin,
            headBottom: hr ? hr.bottom - origin : r.top - origin,
          };
        });
      copy.querySelectorAll("*").forEach((el) => {
        if (el.children.length) return;
        const r = el.getBoundingClientRect();
        if (r.height > 0 && (el.textContent?.trim() || el.tagName === "IMG")) contentBottom = Math.max(contentBottom, r.bottom - origin);
      });
    },
  });
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = 277;
  const pagePixels = Math.floor(180 * canvas.width / width);
  const scale = canvas.width / 1050;
  // Stop at the last visible content so trailing whitespace never yields a blank page.
  const total = Math.min(canvas.height, Math.ceil(contentBottom * scale) + Math.ceil(6 * scale));
  let start = 0;
  let page = 0;
  while (start < total) {
    // When a page starts inside a table, repeat that table's header row on top.
    const startCss = start / scale;
    const spanning = tables.find((tb) => tb.top < startCss - 2 && tb.bottom > startCss + 2);
    const headH = spanning && spanning.headBottom > spanning.headTop ? Math.ceil((spanning.headBottom - spanning.headTop) * scale) : 0;
    const gap = headH ? Math.ceil(6 * scale) : 0;
    const avail = pagePixels - headH - gap;
    let end = Math.min(start + avail, total);
    const crossing = protectedBlocks.find((b) => b.top * scale < end && b.bottom * scale > end && b.top * scale > start);
    if (crossing) end = Math.floor(crossing.top * scale);
    if (end <= start) end = Math.min(start + avail, total);
    const sliceH = end - start;
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = headH + gap + sliceH;
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    if (headH && spanning) ctx.drawImage(canvas, 0, Math.floor(spanning.headTop * scale), canvas.width, headH, 0, 0, canvas.width, headH);
    ctx.drawImage(canvas, 0, start, canvas.width, sliceH, 0, headH + gap, canvas.width, sliceH);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/png"), "PNG", 10, 10, width, slice.height * width / canvas.width);
    pdf.setFontSize(9);
    pdf.text(`Metal Fuze | ${page + 1}`, 148.5, 202, { align: "center" });
    start = end;
    page++;
  }
  pdf.setProperties({ title: document.title, author: "Metal Fuze", creator: "Metal Fuze" });
  downloadBlob(pdf.output("blob"), `Metal-Fuze-${new Date().toISOString().slice(0, 10)}.pdf`);
}
/** Save one standalone element (invoice / statement) as a portrait A4 PDF. */
export async function exportElementPdf(el: HTMLElement, filename: string) {
  await document.fonts.ready;
  await Promise.all(Array.from(el.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)));
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const width = 190;
  const pagePx = Math.floor(267 * canvas.width / width);
  for (let start = 0, page = 0; start < canvas.height; start += pagePx, page++) {
    const h = Math.min(pagePx, canvas.height - start);
    const slice = document.createElement("canvas");
    slice.width = canvas.width; slice.height = h;
    slice.getContext("2d")!.drawImage(canvas, 0, start, canvas.width, h, 0, 0, canvas.width, h);
    if (page > 0) pdf.addPage();
    pdf.addImage(slice.toDataURL("image/png"), "PNG", 10, 10, width, h * width / canvas.width);
    pdf.setFontSize(9);
    pdf.text(`Metal Fuze | ${page + 1}`, 105, 290, { align: "center" });
  }
  downloadBlob(pdf.output("blob"), filename);
}
