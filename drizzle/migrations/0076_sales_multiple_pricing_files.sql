ALTER TABLE public.sales_deals ADD COLUMN pricing_files jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.sales_deals SET pricing_files = jsonb_build_array(jsonb_build_object('path',pricing_file_path,'name',coalesce(pricing_file_name,pricing_file_path))) WHERE pricing_file_path IS NOT NULL;
CREATE OR REPLACE FUNCTION public.sales_pricing_files_lock() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN NEW.pricing_files:='[]'::jsonb;
 ELSIF coalesce(current_setting('app.sales_wf',true),'') <> '1' THEN NEW.pricing_files:=OLD.pricing_files; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER sales_pricing_files_lock BEFORE INSERT OR UPDATE ON public.sales_deals FOR EACH ROW EXECUTE FUNCTION public.sales_pricing_files_lock();
CREATE OR REPLACE FUNCTION public.sales_advance_files(p_id uuid,p_action text,p_note text,p_price numeric DEFAULT NULL,p_files jsonb DEFAULT '[]'::jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.sales_deals; nxt text; f jsonb; first_file jsonb;
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
 first_file:=p_files->0;
 nxt:=public.sales_advance(p_id,p_action,p_note,p_price,first_file->>'path',first_file->>'name');
 IF d.workflow_step='haitham_pricing' AND p_action='approve' THEN
  UPDATE public.sales_deals SET pricing_files=p_files WHERE id=p_id;
 END IF;
 RETURN nxt;
END $$;
REVOKE ALL ON FUNCTION public.sales_advance_files(uuid,text,text,numeric,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_advance_files(uuid,text,text,numeric,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.can_read_sales_file(_path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT split_part(_path,'/',1)=auth.uid()::text OR EXISTS (SELECT 1 FROM public.sales_deals d WHERE d.owner_id=auth.uid() AND (d.pricing_file_path=_path OR d.quotation_file_path=_path OR d.request::text LIKE '%'||_path||'%' OR EXISTS(SELECT 1 FROM jsonb_array_elements(d.pricing_files) f WHERE f->>'path'=_path)));
$$;