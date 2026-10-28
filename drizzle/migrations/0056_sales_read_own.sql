DROP POLICY "sales read" ON public.sales_deals;
CREATE POLICY "sales read" ON public.sales_deals FOR SELECT TO authenticated USING (
  (has_role(auth.uid(),'sales'::app_role) AND owner_id = auth.uid())
  OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'hr'::app_role) OR has_role(auth.uid(),'viewer'::app_role));