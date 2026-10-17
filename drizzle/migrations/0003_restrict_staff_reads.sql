INSERT INTO public.user_roles (user_id, role)
SELECT id, 'viewer'::public.app_role FROM auth.users
WHERE email IN ('ceo@metalfuze.local','haitham@metalfuze.local')
ON CONFLICT (user_id, role) DO NOTHING;

DROP POLICY "Signed-in read employees" ON public.employees;
CREATE POLICY "Staff read employees" ON public.employees FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer'));
DROP POLICY "Signed-in read devices" ON public.attendance_devices;
CREATE POLICY "Staff read devices" ON public.attendance_devices FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer'));
DROP POLICY "Signed-in read logs" ON public.attendance_logs;
CREATE POLICY "Staff read logs" ON public.attendance_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer'));