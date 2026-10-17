import { t } from "./i18n";

export function getPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error(t("الموقع غير متاح على هذا الجهاز")));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error(t("اسمح للموقع بالوصول إلى مكانك ثم حاول مرة أخرى"))),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

/** Shrinks a camera photo to a small JPEG data URL (max 720px). */
export async function resizePhoto(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 720 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.75);
}

export function checkinError(code: string) {
  if (code.startsWith("far:")) {
    const [, d, site] = code.split(":");
    return `${t("أنت على بعد")} ${d} ${t("متر من موقع")} ${site}`;
  }
  return ({
    nosite: t("لم يتم تحديد موقع عمل لهذا الموظف — تواصل مع الإدارة"),
    photo: t("الصورة غير صالحة، التقط صورة جديدة"),
    location: t("تعذر تحديد الموقع"),
    invalid: t("هذا الرابط غير صالح أو تم إيقافه"),
    employee: t("الموظف غير نشط"),
    forbidden: t("صلاحية العرض فقط — لا يمكنك التعديل"),
  } as Record<string, string>)[code] ?? t("تعذر الحفظ، حاول مرة أخرى");
}
