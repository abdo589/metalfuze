CREATE POLICY "Executive reads employees" ON public.employees FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'executive'));
CREATE POLICY "Executive reads hr records" ON public.hr_records FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'executive'));