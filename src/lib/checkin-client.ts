import { t } from "./i18n";

function locate(high: boolean): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error(t("الموقع غير متاح على هذا الجهاز")));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error(t("اسمح للموقع بالوصول إلى مكانك ثم حاول مرة أخرى"))),
      { enableHighAccuracy: high, timeout: high ? 15000 : 20000, maximumAge: 60000 },
    );
  });
}

/** High-accuracy GPS first, then falls back to a quicker network fix. */
export function getPosition(): Promise<{ lat: number; lng: number }> {
  return locate(true).catch(() => locate(false));
}

async function loadImage(file: File): Promise<{ src: CanvasImageSource; w: number; h: number }> {
  try {
    const b = await createImageBitmap(file);
    return { src: b, w: b.width, h: b.height };
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = url; });
    return { src: img, w: img.naturalWidth, h: img.naturalHeight };
  }
}

/** Shrinks a camera photo to a small JPEG data URL (max 720px). */
export async function resizePhoto(file: File): Promise<string> {
  const { src, w, h } = await loadImage(file);
  const scale = Math.min(1, 720 / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
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
