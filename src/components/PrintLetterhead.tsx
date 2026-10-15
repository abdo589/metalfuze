import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";

/** Branded header/footer that only appears on printed pages and saved PDFs. */
export function PrintLetterhead() {
  const today = new Date().toLocaleDateString("ar-SA-u-ca-gregory", { dateStyle: "long" });
  return (
    <>
      <div className="print-letterhead">
        <img src={logoAsset.url} alt="Metal Fuze" width={1600} height={665} />
        <div className="print-letterhead-meta">
          <strong>Metal Fuze</strong>
          <span>Accuracy Has No Limit</span>
          <span>تاريخ الإصدار: {today}</span>
        </div>
      </div>
      <div className="print-footer">Metal Fuze — مستند رسمي صادر من نظام متابعة المشاريع</div>
    </>
  );
}
