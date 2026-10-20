ALTER TABLE public.company_documents ADD COLUMN IF NOT EXISTS file_path text, ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.performance_reviews DROP CONSTRAINT IF EXISTS performance_reviews_employee_id_fkey;
CREATE POLICY "staff read company doc files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'company-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'viewer')));
CREATE POLICY "hr admin upload company doc files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'company-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')));
CREATE POLICY "hr admin delete company doc files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'company-docs' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr')));