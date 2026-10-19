DROP POLICY IF EXISTS "admins write summary" ON public.exec_snapshot;
DROP POLICY IF EXISTS "admins update summary" ON public.exec_snapshot;
CREATE POLICY "ceo writes summary" ON public.exec_snapshot FOR INSERT TO authenticated
WITH CHECK ((auth.jwt()->>'email') = 'ceo@metalfuze.local');
CREATE POLICY "ceo updates summary" ON public.exec_snapshot FOR UPDATE TO authenticated
USING ((auth.jwt()->>'email') = 'ceo@metalfuze.local') WITH CHECK ((auth.jwt()->>'email') = 'ceo@metalfuze.local');
DROP POLICY IF EXISTS "admins and executives read summary" ON public.exec_snapshot;
CREATE POLICY "admins ceo executives read summary" ON public.exec_snapshot FOR SELECT TO authenticated
USING ((auth.jwt()->>'email') = 'ceo@metalfuze.local' OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text IN ('admin','executive')));