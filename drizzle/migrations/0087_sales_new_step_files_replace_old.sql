-- New uploads at a file step replace the step's current files (so a revised pricing after rejection becomes the only/main file); with no new upload, the files already attached are kept.
CREATE OR REPLACE FUNCTION public.sales_advance_files(p_id uuid, p_action text, p_note text, p_price numeric DEFAULT NULL::numeric, p_files jsonb DEFAULT '[]'::jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE d public.sales_deals; nxt text; f jsonb; cur jsonb := '[]'::jsonb; merged jsonb := '[]'::jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not allowed' USING ERRCODE='42501'; END IF;
 PERFORM public.assert_writable();
 SELECT * INTO d FROM public.sales_deals WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
 IF jsonb_typeof(p_files) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid files'; END IF;
 IF p_action='approve' THEN
  FOR f IN SELECT value FROM jsonb_array_elements(p_files) LOOP
   IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR coalesce(f->>'name','')='' OR split_part(coalesce(f->>'path',''), '/',1) <> auth.uid()::text OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id='sales-files' AND name=f->>'path') THEN RAISE EXCEPTION 'invalid file'; END IF;
  END LOOP;
 END IF;
 IF d.workflow_step='haitham_pricing' THEN
  cur := coalesce(d.pricing_files,'[]'::jsonb);
  IF d.pricing_file_path IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cur) c WHERE c->>'path'=d.pricing_file_path) THEN
   cur := jsonb_build_array(jsonb_build_object('path',d.pricing_file_path,'name',coalesce(d.pricing_file_name,d.pricing_file_path))) || cur; END IF;
 ELSIF d.workflow_step='eilaf_quotation' THEN
  cur := coalesce(d.quotation_files,'[]'::jsonb);
  IF d.quotation_file_path IS NOT NULL AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cur) c WHERE c->>'path'=d.quotation_file_path) THEN
   cur := jsonb_build_array(jsonb_build_object('path',d.quotation_file_path,'name',coalesce(d.quotation_file_name,d.quotation_file_path))) || cur; END IF;
 END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(p_files) LOOP
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(merged) c WHERE c->>'path'=f->>'path') THEN merged := merged || jsonb_build_array(f); END IF;
 END LOOP;
 IF jsonb_array_length(merged) = 0 THEN merged := cur; END IF;
 nxt:=public.sales_advance(p_id,p_action,p_note,p_price,merged->0->>'path',merged->0->>'name');
 IF d.workflow_step='haitham_pricing' AND p_action='approve' THEN
  UPDATE public.sales_deals SET pricing_files=merged WHERE id=p_id;
 ELSIF d.workflow_step='eilaf_quotation' AND p_action='approve' THEN
  UPDATE public.sales_deals SET quotation_files=merged WHERE id=p_id;
 END IF;
 RETURN nxt;
END $function$;