DROP POLICY "read meetings" ON public.sales_meetings;
CREATE POLICY "read meetings" ON public.sales_meetings FOR SELECT TO authenticated USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(),'admin')
  OR lower(coalesce(auth.jwt()->>'email','')) = ANY (SELECT lower(a) FROM unnest(attendees) a)
  OR EXISTS (SELECT 1 FROM public.sales_deals d WHERE d.id = deal_id)
);