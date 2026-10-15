import { t, useLanguage, locale } from "@/lib/i18n";
import logoAsset from "@/assets/metal-fuze-logo.png.asset.json";

/** Branded header/footer that only appears on printed pages and saved PDFs. */
export function PrintLetterhead() {
  useLanguage();
  const today = new Date().toLocaleDateString(locale(), { dateStyle: "long" });
  return (
    <>
      <div className="print-letterhead">
        <img src={logoAsset.url} alt="Metal Fuze" width={1600} height={665} />
        <div className="print-letterhead-meta">
          <strong>Metal Fuze</strong>
          <span>Accuracy Has No Limit</span>
          <span>{t("تاريخ الإصدار:")}{today}</span>
        </div>
      </div>
      <div className="print-footer">{t("Metal Fuze — مستند رسمي صادر من نظام متابعة المشاريع")}</div>
    </>
  );
}
