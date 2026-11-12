- Sales attachment opening uses sales-file-open.ts to reserve preview tabs during the user gesture, download unsupported formats, and close failed tabs; this avoids Safari blank tabs without widening storage access.- Eilaf edits pricing/quotation attachments only through the sales_eilaf_set_files RPC (keeps legacy first-file columns in sync, accepts only existing or her own uploads); unlinked files stay in storage so nothing is deleted.

- Workflow approval (sales_advance_files): new uploads replace the step's current files (no stale rejected file stays main); with no upload the already-attached files are kept, so Eilaf's edit still satisfies the file requirement. Replaced files stay in storage.

- CEO-equivalent rights go through ceo-access.ts in the app and public.has_ceo_access() in the database; messages to the CEO are copied to Haitham by a DB trigger, so new CEO checks must use these instead of comparing the CEO email.
