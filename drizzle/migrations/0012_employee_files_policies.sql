CREATE POLICY "Staff read employee files" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'employee-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid())));
CREATE POLICY "Editors upload employee files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'employee-files' AND (public.has_role(auth.uid(),'admin') OR public.is_hr(auth.uid())));
CREATE POLICY "Editors update employee files" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'employee-files' AND (public.has_role(auth.uid(),'admin') OR public.is_hr(auth.uid())));
CREATE POLICY "Editors delete employee files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'employee-files' AND (public.has_role(auth.uid(),'admin') OR public.is_hr(auth.uid())));