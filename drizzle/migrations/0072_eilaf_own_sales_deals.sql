CREATE POLICY "eilaf sales insert own" ON public.sales_deals FOR INSERT TO authenticated
WITH CHECK (public.verified_email() = 'eilaf@metalfuze.local' AND owner_id = auth.uid());
CREATE POLICY "eilaf sales update own" ON public.sales_deals FOR UPDATE TO authenticated
USING (public.verified_email() = 'eilaf@metalfuze.local' AND owner_id = auth.uid())
WITH CHECK (public.verified_email() = 'eilaf@metalfuze.local' AND owner_id = auth.uid());
CREATE POLICY "eilaf sales read own" ON public.sales_deals FOR SELECT TO authenticated
USING (public.verified_email() = 'eilaf@metalfuze.local' AND owner_id = auth.uid());
