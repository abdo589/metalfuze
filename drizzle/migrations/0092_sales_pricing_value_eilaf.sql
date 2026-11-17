CREATE OR REPLACE FUNCTION public.sales_advance(p_id uuid, p_action text, p_note text, p_price numeric DEFAULT NULL::numeric, p_file_path text DEFAULT NULL::text, p_file_name text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d public.sales_deals; me text; nxt text; actor text; msg text; r record;
  steps text[] := ARRAY['sales_entry','eilaf_review','haitham_pricing','eilaf_quotation','haitham_approval','ceo_approval','done'];
  labels text[] := ARRAY['بيانات التسعير من المبيعات','مراجعة وموافقة Eilaf','التسعير — Haitham','عرض السعر — Eilaf','التعميد — Haitham','موافقة وتعميد CEO','مكتمل'];
BEGIN
  PERFORM public.assert_writable();
  SELECT * INTO d FROM public.sales_deals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  SELECT display_name INTO actor FROM public.profiles WHERE id = auth.uid(); me := public.verified_email();
  IF d.workflow_step = 'sales_entry' THEN
    IF d.owner_id <> auth.uid() OR p_action <> 'approve' THEN RAISE EXCEPTION 'not allowed'; END IF;
  ELSIF d.workflow_step IN ('done', 'rejected') OR NOT (me IS NOT DISTINCT FROM public.sales_step_email(d.workflow_step)
      OR (d.workflow_step = 'ceo_approval' AND public.has_ceo_access())) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF p_action = 'approve' THEN
    IF d.workflow_step = 'haitham_pricing' AND p_file_path IS NULL THEN RAISE EXCEPTION 'file required'; END IF;
    IF d.workflow_step = 'eilaf_quotation' AND p_file_path IS NULL THEN RAISE EXCEPTION 'file required'; END IF;
    nxt := steps[array_position(steps, d.workflow_step) + 1];
  ELSIF p_action = 'reject' THEN
    nxt := 'rejected';
  ELSE RAISE EXCEPTION 'bad action'; END IF;

  PERFORM set_config('app.sales_wf', '1', true);
  UPDATE public.sales_deals SET workflow_step = nxt, updated_at = now(),
    pricing_value = CASE WHEN d.workflow_step = 'eilaf_quotation' AND p_action = 'approve' AND p_price IS NOT NULL THEN p_price ELSE pricing_value END,
    quote_value = CASE WHEN d.workflow_step = 'eilaf_quotation' AND p_action = 'approve' THEN coalesce(p_price, quote_value) ELSE quote_value END,
    pricing_file_path = CASE WHEN d.workflow_step = 'haitham_pricing' AND p_action = 'approve' THEN p_file_path ELSE pricing_file_path END,
    pricing_file_name = CASE WHEN d.workflow_step = 'haitham_pricing' AND p_action = 'approve' THEN p_file_name ELSE pricing_file_name END,
    quotation_file_path = CASE WHEN d.workflow_step = 'eilaf_quotation' AND p_action = 'approve' THEN p_file_path ELSE quotation_file_path END,
    quotation_file_name = CASE WHEN d.workflow_step = 'eilaf_quotation' AND p_action = 'approve' THEN p_file_name ELSE quotation_file_name END,
    workflow_log = workflow_log || jsonb_build_object('at', now(), 'by', coalesce(actor, ''), 'from', d.workflow_step, 'to', nxt, 'action', p_action, 'note', coalesce(p_note, ''))
  WHERE id = p_id;

  msg := 'طلب تسعير «' || d.project || '» — ' || d.client || E'\n' ||
    CASE WHEN p_action = 'reject' THEN 'تم رفضه ونقله إلى «مشاريع مؤقتة» — رفض من ' ELSE 'وصل إلى مرحلة: ' || labels[array_position(steps, nxt)] || ' — من ' END ||
    coalesce(actor, '') || CASE WHEN coalesce(p_note, '') <> '' THEN E'\nملاحظة: ' || p_note ELSE '' END;
  FOR r IN SELECT id FROM public.profiles WHERE id <> auth.uid() AND (
      email = public.sales_step_email(nxt)
      OR (nxt = 'sales_entry' AND id = d.owner_id)
      OR (nxt IN ('done', 'rejected') AND (id = d.owner_id OR email = 'eilaf@metalfuze.local'))) LOOP
    INSERT INTO public.direct_messages(sender_id, recipient_id, body) VALUES (auth.uid(), r.id, left(msg, 4000));
  END LOOP;
  RETURN nxt;
END $function$;