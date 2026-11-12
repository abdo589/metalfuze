DROP POLICY IF EXISTS "read meetings" ON public.sales_meetings;
CREATE POLICY "read meetings" ON public.sales_meetings FOR SELECT TO authenticated USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR (public.verified_email() IS NOT NULL AND public.verified_email() IN (SELECT lower(a) FROM unnest(sales_meetings.attendees) AS a))
  OR EXISTS (SELECT 1 FROM public.sales_deals d WHERE d.id = sales_meetings.deal_id)
);