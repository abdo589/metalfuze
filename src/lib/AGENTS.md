- Sales attachment opening uses sales-file-open.ts to reserve preview tabs during the user gesture, download unsupported formats, and close failed tabs; this avoids Safari blank tabs without widening storage access.- Eilaf edits pricing/quotation attachments only through the sales_eilaf_set_files RPC (keeps legacy first-file columns in sync, accepts only existing or her own uploads); unlinked files stay in storage so nothing is deleted.

- Workflow approval (sales_advance_files) merges already-attached step files with new uploads, so files added via Eilaf's edit satisfy the file requirement and are never dropped.

- CEO-equivalent rights go through ceo-access.ts in the app and public.has_ceo_access() in the database; messages to the CEO are copied to Haitham by a DB trigger, so new CEO checks must use these instead of comparing the CEO email.
