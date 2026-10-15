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
      const origin = copy.getBoundingClientRect().top;
      protectedBlocks = Array.from(copy.querySelectorAll<HTMLElement>("tr, header, .print-letterhead, .surface:not(:has(table)), [data-pdf-keep]"))
        .filter((el) => el.getBoundingClientRect().height > 0)
        .map((el) => ({ top: el.getBoundingClientRect().top - origin, bottom: el.getBoundingClientRect().bottom - origin }));
    },
  });
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = 277;
  const pagePixels = Math.floor(180 * canvas.width / width);
  const scale = canvas.width / 1050;
  let start = 0;
  let page = 0;
  while (start < canvas.height) {
    let end = Math.min(start + pagePixels, canvas.height);
    const crossing = protectedBlocks.find((b) => b.top * scale < end && b.bottom * scale > end && b.top * scale > start);
    if (crossing) end = Math.floor(crossing.top * scale);
    if (end <= start) end = Math.min(start + pagePixels, canvas.height);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = end - start;
    const ctx = slice.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(canvas, 0, start, canvas.width, slice.height, 0, 0, canvas.width, slice.height);
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