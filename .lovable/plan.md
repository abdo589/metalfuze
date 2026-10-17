# Remote attendance (phone check-in with GPS and selfie)

Employees and supervisors can record arrival and leaving from a phone. Remote check-ins show up on the «الحضور والانصراف» page and in payroll, next to the fingerprint device punches.

## What users will get

**1. Work sites (new section on the attendance page, admins only)**
- Add the office and each project site: name, location on the map ("use my current location" button), and allowed distance (default 150 m).
- Each employee gets a home work site.

**2. Employee self check-in**
- Each employee gets a personal check-in link. An admin can copy it or send it by WhatsApp from the employee's row.
- Opening the link on a phone shows the employee's name, the current time, and two big buttons: «تسجيل حضور» and «تسجيل انصراف».
- Tapping a button:
  1. Gets the phone's GPS location.
  2. Opens the front camera to take a selfie.
  3. Sends both. The check-in is accepted only when the employee is inside the allowed distance of their site. Otherwise it is refused with a message like "You are 820 m from Osool site".
- Admins can turn a link off, or make a new one if a link is shared.

**3. Supervisor check-in for workers**
- New page «تسجيل حضور العمال», open to the admin accounts (Eilaf and Eng Abdelrhman).
- The supervisor picks a worker, takes the worker's selfie, and records arrival or leaving. The same GPS site rule applies.

**4. Review**
- The attendance page shows a "Phone" or "Device" tag on each punch.
- Remote punches have a small selfie thumbnail and the distance from the site, and can be opened to check.
- Lateness and absence rules stay the same (start 09:00, late after 09:30). They apply to both kinds of punch, so payroll counts update on their own.

## Technical details

- Migration:
  - `work_sites` table (id, name, lat, lng, radius_m).
  - `employees.site_id` and `employees.checkin_token` columns (random, unique).
  - `attendance_logs.source` column ('device' | 'remote'), plus `lat`, `lng`, `distance_m` and `photo_path`.
  - Grants and row security follow the existing pattern: staff read, admins write.
- Private storage bucket `attendance-selfies`. Only staff can read, through short-lived signed links.
- Public route `src/routes/checkin.$token.tsx`. It has its own simple layout and doesn't need sign-in.
- Public server route `/api/public/checkin` receives the token, the action, GPS, and the photo. It checks:
  - the token is valid and the employee is active;
  - the photo type and size (max 2 MB, resized on the phone first);
  - the distance from the site (haversine formula);
  - repeated taps within 1 minute are ignored.

  Then it stores the punch and the selfie with server-only access. Nothing private is sent back.
- Supervisor check-in uses an authenticated server function with an admin role check. It reuses the same distance and storage logic from a shared server helper.
- `summarize()` in attendance already reads `attendance_logs` by `device_user_id`. Remote punches are stored with the employee's device id, or the employee id when there is none, so existing payroll links keep working.
- Unit tests:
  - the distance and radius rule (inside 150 m accepted, outside refused);
  - the 1-minute repeat rule.

## Notes for you
- GPS and the camera need the phone to allow location and camera access. Phones only allow this on the published site, which already uses https.
- Site locations aren't known yet. You'll set them once from the new Work sites section, standing at each site or picking it on the map.
