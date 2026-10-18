# Make Metal Fuze installable as a phone/desktop app

We can't build an app for the App Store or Google Play. What we can do is make the site installable: people add it to their home screen and it opens like a real app, full screen, with the Metal Fuze icon and no browser bar.

## What you will get
- A "تثبيت التطبيق / Install app" button in the side menu. On Android and computers it installs in one tap. On iPhone it shows a short guide: Share, then "Add to Home Screen".
- The Metal Fuze logo as the app icon, plus the company colors on the opening screen and top bar.
- The app opens straight to the dashboard (or to the sign-in page if you're signed out).
- Employee check-in links (/checkin/...) also work after adding them to the home screen, so workers get a "check-in app" on their phones.
- Everything else stays the same: logins, permissions, data, Arabic/English.

## Limits
- It needs the internet. Data lives in the cloud, so there's no offline mode.
- It only works from the published site (metalfuze.lovable.app), not from the editor preview.
- No automatic notifications for now.

## Technical details
- Add `public/manifest.webmanifest` (name "METAL FUZE PROJECTS", short_name "Metal Fuze", display standalone, start_url "/", theme/background colors from the brand tokens, dir auto, lang ar).
- Generate 192px, 512px and maskable icons plus apple-touch-icon (180px) from the existing logo into `public/`.
- In `src/routes/__root.tsx` head: manifest link, apple-touch-icon, theme-color, apple-mobile-web-app-capable / status-bar / title meta.
- No service worker, so there's no offline cache and no risk of serving stale versions. Installing works from the manifest alone in Chrome/Edge/Android; iOS uses the meta tags.
- `InstallAppButton` in AppSidebar: listens for `beforeinstallprompt` and calls `prompt()`; on iOS Safari it opens a small dialog with the instructions; it hides when already running standalone (`display-mode: standalone`). i18n strings in both languages.
- Publish, then check the manifest and icons on the live site.
