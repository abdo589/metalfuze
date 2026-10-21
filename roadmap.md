# Roadmap

- [x] Make the side menu collapsible from an icon (hide/show, persisted per device, desktop rail + mobile drawer, content reflows 1040↔1232px; verified in browser).

- [x] Add branded weekly/monthly/yearly project reports with shared dashboard data and PDF/Excel exports; period controls, signed-in downloads, six PDF pages, Excel logos/totals and formula recalculation verified; wrapping and print spacing corrected.

- [x] Add Arabic/English selection throughout the site and exports; rename projects dashboard to METAL FUZE PROJECTS (signed-in switching, persistence, six pages, PDF and Excel exports verified).

- [x] Make company PDF exports readable, unclipped, and free of website links (all four downloads and pages visually verified; payroll status visibility corrected).

- [x] Add Google sign-in button to login screen (provider enabled; build OK, button verified on screen)
- [ ] Search domain availability for Metal Fuze project and present options to the user — done, waiting on the user's pick
- [x] Auth email templates (Metalfuze, notify.metalfuze.com)
- [x] Employee accounts link to employee record by matching email
- [x] Internal chat — private 1:1 messages for all accounts

- [x] Add "العنوان الوطني" field to employee data (hr-sheets.json employees columns).
- [x] Whole-system AI advisor: /api/chat fetches caller-scoped live system data (HR records, residencies, leave, attendance, settlements) beside project data; real payroll question verified end-to-end.
- [x] Documents: upload file → AI fills fields; view/download per document.
- [x] Sidebar: payroll + attendance under employee data; removed workers check-in.
- [x] Reviews use employees from the HR file.
- [x] Company-only payroll page (/est-payroll) linked to establishment records.
- [x] Project files in the project card: four ready folders + user-named folders, upload/view/download, delete a single file or a whole custom folder (verified in browser; backend rows and storage objects removed).
