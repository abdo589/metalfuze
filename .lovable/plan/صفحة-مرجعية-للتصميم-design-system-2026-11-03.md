# صفحة مرجعية للتصميم (Design System)

صفحة جديدة `/design-system` تعرض هوية Metal Fuze الحالية كما هي، بدون تغيير أي لون أو صفحة موجودة.

## محتوى الصفحة
1. **الألوان**: كل ألوان الموقع (الأساسي، الخلفية، الكروت، النجاح، التحذير، الخطر، المعلومات، ألوان مراحل المبيعات السبعة، ألوان الرسوم البيانية) مع اسم كل لون وقيمته، في الوضع الفاتح والداكن.
2. **الخطوط**: الخط الأساسي وخط العناوين بأحجام العناوين والنصوص، عربي وإنجليزي.
3. **المسافات والحواف**: أحجام الزوايا الدائرية والظلال.
4. **العناصر**: أزرار بكل أشكالها، خانات الإدخال والقوائم المنسدلة (بما فيها "أخرى")، الكروت، الشارات، الجداول، التبويبات، النوافذ المنبثقة، التنبيهات، شريط التقدم.
5. **الشعار**: شعار Metal Fuze وطريقة استخدامه.
6. زر تبديل فاتح/داكن وعربي/إنجليزي لمعاينة كل حاجة.

## من يفتحها
- عبدالرحمن (المطوّر) فقط افتراضيًا. قولي لو عايز حد تاني يشوفها.

## Technical details
- New route `src/routes/design-system.tsx` with own head(); added to `DEV_PATHS` in permissions.ts.
- Reads tokens live via CSS variables (getComputedStyle) so the page never drifts from `src/styles.css`.
- Uses existing `src/components/ui/*` and shared i18n; no changes to styles.css or other pages (add-only).
- Add link in developer sidebar section without reordering existing items.
