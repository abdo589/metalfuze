# رفع Metal Fuze على Google Play وApp Store

## الإجابة المختصرة
- **Google Play: ممكن وسهل.** الموقع قابل للتثبيت أصلًا، فنقدر نغلّفه كتطبيق أندرويد رسمي (TWA) من غير ما نعيد بناءه.
- **App Store: ممكن بس أصعب.** Apple بتحتاج تطبيق مغلّف بأداة اسمها Capacitor على جهاز Mac فيه Xcode. وApple ساعات ترفض التطبيقات اللي بتفتح موقع بس، فممكن يحتاج يكون فيه حاجات زي الإشعارات.
- Lovable نفسه ما بيرفعش على المتاجر. الرفع النهائي بيبقى من حساباتك أنت.

## المطلوب منك
- حساب Google Play Developer (25 دولار مرة واحدة).
- حساب Apple Developer (99 دولار في السنة) + جهاز Mac أو مطوّر عنده Mac.
- اسم الشركة الرسمي وإيميل دعم، علشان صفحة التطبيق في المتجر.

## اللي هعمله في الموقع
1. أضيف ملف التحقق اللي Google بتطلبه (`/.well-known/assetlinks.json`) علشان التطبيق يفتح من غير شريط المتصفح.
2. أتأكد إن الأيقونات وصفحة الخصوصية (موجودة على /privacy) جاهزة لشروط المتاجر.
3. أكتبلك خطوات بالعربي: استخدام PWABuilder.com لعمل ملف أندرويد ورفعه على Play Console، وخطوات Capacitor لـ iPhone.

## حدود
- التطبيق محتاج إنترنت، زي الموقع بالظبط.
- أي تعديل في الموقع بيظهر في تطبيق أندرويد تلقائيًا من غير تحديث في المتجر.

## Technical details
- TWA via PWABuilder (Bubblewrap); package id e.g. `com.metalfuze.projects`. After the user generates the signing key, serve its SHA-256 fingerprint in `public/.well-known/assetlinks.json` (fingerprint requested from the user, not invented).
- iOS: Capacitor wrapper with `server.url` pointing at metalfuze.lovable.app, built in Xcode outside Lovable.
