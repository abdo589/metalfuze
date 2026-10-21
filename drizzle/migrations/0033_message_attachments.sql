ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS attachment_path text, ADD COLUMN IF NOT EXISTS attachment_name text;
CREATE POLICY "dm files upload own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "dm files read participants" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR (storage.foldername(name))[2] = auth.uid()::text));