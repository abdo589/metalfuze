-- Eilaf may add or unlink pricing/quotation attachments on any sales deal at any time.
-- Unlinked files stay in storage (never deleted here); new files must be Eilaf's own uploads.
CREATE OR REPLACE FUNCTION public.sales_eilaf_set_files(p_id uuid, p_kind text, p_files jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.sales_deals; cur jsonb; f jsonb; first_file jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.verified_email() IS DISTINCT FROM 'eilaf@metalfuze.local' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  PERFORM public.assert_writable();
  IF p_kind NOT IN ('pricing', 'quotation') THEN RAISE EXCEPTION 'invalid kind'; END IF;
  IF jsonb_typeof(p_files) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid files'; END IF;
  SELECT * INTO d FROM public.sales_deals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  IF p_kind = 'pricing' THEN
    cur := coalesce(d.pricing_files, '[]'::jsonb);
    IF d.pricing_file_path IS NOT NULL THEN cur := cur || jsonb_build_array(jsonb_build_object('path', d.pricing_file_path, 'name', coalesce(d.pricing_file_name, d.pricing_file_path))); END IF;
  ELSE
    cur := coalesce(d.quotation_files, '[]'::jsonb);
    IF d.quotation_file_path IS NOT NULL THEN cur := cur || jsonb_build_array(jsonb_build_object('path', d.quotation_file_path, 'name', coalesce(d.quotation_file_name, d.quotation_file_path))); END IF;
  END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p_files) LOOP
    IF jsonb_typeof(f) IS DISTINCT FROM 'object' OR coalesce(f->>'name', '') = '' OR coalesce(f->>'path', '') = '' THEN RAISE EXCEPTION 'invalid file'; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(cur) c WHERE c->>'path' = f->>'path') AND (
      split_part(f->>'path', '/', 1) <> auth.uid()::text
      OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'sales-files' AND name = f->>'path')
    ) THEN RAISE EXCEPTION 'invalid file'; END IF;
  END LOOP;
  first_file := p_files->0;
  PERFORM set_config('app.sales_wf', '1', true);
  IF p_kind = 'pricing' THEN
    UPDATE public.sales_deals SET pricing_files = p_files, pricing_file_path = first_file->>'path', pricing_file_name = first_file->>'name' WHERE id = p_id;
  ELSE
    UPDATE public.sales_deals SET quotation_files = p_files, quotation_file_path = first_file->>'path', quotation_file_name = first_file->>'name' WHERE id = p_id;
  END IF;
  PERFORM set_config('app.sales_wf', '', true);
END $$;
REVOKE ALL ON FUNCTION public.sales_eilaf_set_files(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_eilaf_set_files(uuid, text, jsonb) TO authenticated;