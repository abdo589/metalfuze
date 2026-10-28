CREATE OR REPLACE FUNCTION public.sales_deals_insert_reset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  NEW.owner_id := auth.uid();
  NEW.workflow_step := 'sales_entry';
  NEW.workflow_log := '[]'::jsonb;
  NEW.pricing_value := NULL;
  NEW.pricing_file_path := NULL; NEW.pricing_file_name := NULL;
  NEW.quotation_file_path := NULL; NEW.quotation_file_name := NULL;
  NEW.collected := 0;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sales_deals_insert_reset ON public.sales_deals;
CREATE TRIGGER trg_sales_deals_insert_reset BEFORE INSERT ON public.sales_deals
FOR EACH ROW EXECUTE FUNCTION public.sales_deals_insert_reset();

CREATE OR REPLACE FUNCTION public.can_read_sales_file(_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT split_part(_path,'/',1) = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.sales_deals d WHERE d.owner_id = auth.uid()
      AND (d.pricing_file_path = _path OR d.quotation_file_path = _path OR d.request::text LIKE '%' || _path || '%'));
$$;

DROP POLICY IF EXISTS "sales files read" ON storage.objects;
CREATE POLICY "sales files read" ON storage.objects FOR SELECT TO authenticated USING (
  bucket_id = 'sales-files' AND (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'hr') OR has_role(auth.uid(),'viewer')
    OR (has_role(auth.uid(),'sales') AND public.can_read_sales_file(name))
  ));