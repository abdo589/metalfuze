CREATE OR REPLACE FUNCTION public.sales_eilaf_set_quotations(p_id uuid, p_files jsonb, p_price numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_price IS NOT NULL AND (p_price < 0 OR p_price > 1000000000000) THEN RAISE EXCEPTION 'invalid price'; END IF;
  -- Same Eilaf-only checks and file rules as editing any attachment list.
  PERFORM public.sales_eilaf_set_files(p_id, 'quotation', p_files);
  PERFORM set_config('app.sales_wf', '1', true);
  UPDATE public.sales_deals
    SET pricing_value = p_price, quote_value = coalesce(p_price, quote_value)
    WHERE id = p_id;
  PERFORM set_config('app.sales_wf', '', true);
END $function$;

REVOKE ALL ON FUNCTION public.sales_eilaf_set_quotations(uuid, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_eilaf_set_quotations(uuid, jsonb, numeric) TO authenticated;