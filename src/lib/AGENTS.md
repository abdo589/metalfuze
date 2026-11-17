- Sales attachment opening uses sales-file-open.ts to reserve preview tabs during the user gesture, download unsupported formats, and close failed tabs; this avoids Safari blank tabs without widening storage access.- Eilaf edits pricing/quotation attachments only through the sales_eilaf_set_files RPC (keeps legacy first-file columns in sync, accepts only existing or her own uploads); unlinked files stay in storage so nothing is deleted.

- Workflow approval (sales_advance_files): new uploads replace the step's current files (no stale rejected file stays main); with no upload the already-attached files are kept, so Eilaf's edit still satisfies the file requirement. Replaced files stay in storage.

- CEO-equivalent rights go through ceo-access.ts in the app and public.has_ceo_access() in the database; messages to the CEO are copied to Haitham by a DB trigger, so new CEO checks must use these instead of comparing the CEO email.

- Sales commissions reach HR data only from the HR-approved snapshot (confirmed_* columns, written solely by sales_confirm_commission); typed contract values earn nothing until approved, so salespeople cannot raise their own commission.

- Rejecting a pricing request at any step sets workflow_step = 'rejected' (sales_advance); the sales page hides those rows and Eilaf's /temp-projects lists them. Only the sales_restore_rejected RPC (verified Eilaf) brings one back, at eilaf_review — so a rejected request can't silently re-enter the approval chain.

- Eilaf quotation-step pricing value is pre-filled by /api/extract-price (signed-in only, reads one file and counts it only if it is a client quotation, never a pricing/cost sheet, stores nothing; spreadsheets converted to CSV in the browser) and summed per file via sales-price.ts; typing in the field stops auto-fill, so the saved value is always what she sees.

- Project actual progress is derived in withAutoStatus (projects.ts progressFromPaid) whenever a contract value exists, so every dashboard/report reads one computed value; the typed progress is only a fallback for projects without a contract value.

- Eilaf's quotation-list edits save files and total together through sales_eilaf_set_quotations (wraps sales_eilaf_set_files), and attached PDFs are re-read in the browser by storage path, so the shown total always matches the saved one.

- The laptop/phone red counter is set only through app-badge.ts setAppBadgeCount (tab icon drawn on canvas + installed-app badge), fed by MessageAlerts in root, so one total covers every icon.
