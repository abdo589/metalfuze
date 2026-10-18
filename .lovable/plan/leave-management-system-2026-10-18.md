# Leave management system

Built on the existing employees table (no duplicate employee data). Keeps the current design, sidebar and Arabic/English support.

## Decisions (from your answers)
- Each employee submits through a personal private link (like the phone check-in link), with no account needed.
- One direct manager per department (an existing staff account is assigned to each department), then HR (Aisha) reviews.
- Annual leave: 21 days, and 30 days after 5 years of service. This can be changed in the settings.

## Sections (the "الإجازات" page becomes tabs)
1. Summary dashboard: on leave today, pending requests, upcoming leaves, days used this month.
2. New request (HR/admin can file one on behalf of an employee; employees use their link).
3. All requests, with search and filters.
4. Pending approval (manager queue and HR queue).
5. Balances per employee: opening balance, earned, used, booked, remaining, service start date, and a log of every change with who made it.
6. Leave history.
7. Calendar (monthly view).
8. Reports by employee, type, period, department and status, with Excel export.
9. Settings (admins only): leave types and their rules, annual entitlement rules, and a manager for each department.

## Request form
Automatic request number. Employee chosen from the existing list (department and job title filled in). Leave type, start and end dates, working days counted automatically (Friday and Saturday off, by default), reason, attachment (for example a medical report), return-to-work date. Status: draft, waiting for manager, waiting for HR, approved, rejected, cancelled.

## Leave types (all editable)
Annual, sick, unpaid, marriage (5 days), bereavement (5 days), new baby (3 days), maternity (70 days), exams, compensatory, other. Each type is marked as paid or unpaid and whether it uses the annual balance.

## Approval flow
Employee submits, then the department manager approves or rejects with a reason, then HR reviews. Only final HR approval takes days off the balance. Rejected or cancelled requests never touch the balance. Nothing is ever approved automatically. Every action is saved in a history log, and in-app notifications reach the employee (on their link), the manager and HR.

## Checks
- No overlap with another active request.
- End date can't be before the start date.
- Enough balance for any type that uses the balance.
- An attachment is required where the type demands it (sick leave).

## Connections
- Attendance: approved leave days show as "leave", not absence, in the attendance records and the monthly sheet.
- Payroll: unpaid leave days are deducted pro-rata from that month's salary.
- Control panel: new alerts for pending requests and who is on leave today.
- Employee data: an employee's file shows their requests and balance.
- The existing 13 leave records are kept as approved historical requests.

## Permissions
- Employee (link): submit, follow up, view their own balance.
- Department manager: review their own department's requests.
- HR (Aisha): review, edit balances, see all records and reports.
- Admins (Eilaf, Abdelrhman): everything above plus settings and assigning managers.

## Technical details
- New tables: leave_types, leave_policy (entitlement tiers, weekend days), department_managers (dept to user_id), leave_requests (FK employees.id, status, working_days, request_no sequence), leave_request_events (audit trail), leave_balance_adjustments (balance changes, with actor), leave_notifications. RLS uses has_role/is_hr plus a manager-of-dept function; grants on every table.
- Status transitions run through a single SECURITY DEFINER function (`leave_transition`) that checks the role, writes the audit and notification rows, and re-validates overlap and balance on final approval.
- The employee link /leave/$token is a public route posting to /api/public/leave, which resolves employees.checkin_token. Attachments go in the private employee-files bucket.
- Shared pure logic in src/lib/leave-engine.ts (working-day count, entitlement, balance, overlap), with vitest tests. Attendance/payroll consume approved leave days.
- End-to-end test of the full cycle: submit, manager approval, HR approval, balance deducted, and the day showing in attendance.
