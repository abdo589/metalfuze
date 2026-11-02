DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef('public.sales_advance(uuid,text,text,numeric,text,text)'::regprocedure) INTO definition;
  IF strpos(definition, '(p_price IS NULL OR p_file_path IS NULL)') = 0 THEN
    RAISE EXCEPTION 'Expected pricing validation not found';
  END IF;
  definition := replace(definition, '(p_price IS NULL OR p_file_path IS NULL)', 'p_file_path IS NULL');
  definition := replace(definition, 'price and file required', 'file required');
  definition := replace(definition,
    'quote_value = CASE WHEN d.workflow_step = ''haitham_pricing'' AND p_action = ''approve'' THEN p_price ELSE quote_value END',
    'quote_value = CASE WHEN d.workflow_step = ''haitham_pricing'' AND p_action = ''approve'' THEN coalesce(p_price, quote_value) ELSE quote_value END');
  EXECUTE definition;
END $migration$;
COMMENT ON FUNCTION public.sales_advance(uuid,text,text,numeric,text,text) IS 'Haitham pricing amount is optional; uploaded pricing file remains required. Missing amount preserves existing quote value.';