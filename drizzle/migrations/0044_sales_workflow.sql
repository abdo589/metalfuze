ALTER TABLE public.sales_deals
  ADD COLUMN workflow_step text NOT NULL DEFAULT 'sales_entry',
  ADD COLUMN workflow_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN pricing_value numeric,
  ADD COLUMN pricing_file_path text,
  ADD COLUMN pricing_file_name text,
  ADD COLUMN quotation_file_path text,
  ADD COLUMN quotation_file_name text;

CREATE OR REPLACE FUNCTION public.sales_wf_lock() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.sales_wf', true), '') <> '1' THEN
    NEW.workflow_step := OLD.workflow_step; NEW.workflow_log := OLD.workflow_log;
    NEW.pricing_value := OLD.pricing_value; NEW.pricing_file_path := OLD.pricing_file_path; NEW.pricing_file_name := OLD.pricing_file_name;
    NEW.quotation_file_path := OLD.quotation_file_path; NEW.quotation_file_name := OLD.quotation_file_name;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sales_wf_lock BEFORE UPDATE ON public.sales_deals FOR EACH ROW EXECUTE FUNCTION public.sales_wf_lock();

CREATE OR REPLACE FUNCTION public.sales_step_email(_step text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _step WHEN 'eilaf_review' THEN 'eilaf@metalfuze.local' WHEN 'haitham_pricing' THEN 'haitham@metalfuze.local'
    WHEN 'eilaf_quotation' THEN 'eilaf@metalfuze.local' WHEN 'haitham_approval' THEN 'haitham@metalfuze.local'
    WHEN 'ceo_approval' THEN 'ceo@metalfuze.local' ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.sales_advance(p_id uuid, p_action text, p_note text, p_price numeric DEFAULT NULL,
  p_file_path text DEFAULT NULL, p_file_name text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.sales_deals; me text; nxt text; actor text; msg text; r record;
  steps text[] := ARRAY['sales_entry','eilaf_review','haitham_pricing','eilaf_quotation','haitham_approval','ceo_approval','done'];
  labels text[] := ARRAY['بيانات التسعير من المبيعات','مراجعة وموافقة Eilaf','التسعير — Haitham','عرض السعر — Eilaf','التعميد — Haitham','موافقة وتعميد CEO','مكتمل'];
BEGIN
  SELECT * INTO d FROM public.sales_deals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not found'; END IF;
  SELECT email, display_name INTO me, actor FROM public.profiles WHERE id = auth.uid();
  IF d.workflow_step = 'sales_entry' THEN
    IF d.owner_id <> auth.uid() OR p_action <> 'approve' THEN RAISE EXCEPTION 'not allowed'; END IF;
  ELSIF d.workflow_step = 'done' OR me IS DISTINCT FROM public.sales_step_email(d.workflow_step) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF p_action = 'approve' THEN
    IF d.workflow_step = 'haitham_pricing' AND (p_price IS NULL OR p_file_path IS NULL) THEN RAISE EXCEPTION 'price and file required'; END IF;
    IF d.workflow_step = 'eilaf_quotation' AND p_file_path IS NULL THEN RAISE EXCEPTION 'file required'; END IF;
    nxt := steps[array_position(steps, d.workflow_step) + 1];
  ELSIF p_action = 'reject' THEN
    nxt := CASE WHEN d.workflow_step = 'eilaf_review' THEN 'sales_entry' ELSE 'eilaf_review' END;
  ELSE RAISE EXCEPTION 'bad action'; END IF;

  PERFORM set_config('app.sales_wf', '1', true);
  UPDATE public.sales_deals SET workflow_step = nxt, updated_at = now(),
    pricing_value = CASE WHEN d.workflow_step = 'haitham_pricing' AND p_action = 'approve' THEN p_price ELSE pricing_value END,
    quote_value = CASE WHEN d.workflow_step = 'haitham_pricing' AND p_action = 'approve' THEN p_price ELSE quote_value END,
    pricing_file_path = CASE WHEN d.workflow_step = 'haitham_pricing' AND p_action = 'approve' THEN p_file_path ELSE pricing_file_path END,
    pricing_file_name = CASE WHEN d.workflow_step = 'haitham_pricing' AND p_action = 'approve' THEN p_file_name ELSE pricing_file_name END,
    quotation_file_path = CASE WHEN d.workflow_step = 'eilaf_quotation' AND p_action = 'approve' THEN p_file_path ELSE quotation_file_path END,
    quotation_file_name = CASE WHEN d.workflow_step = 'eilaf_quotation' AND p_action = 'approve' THEN p_file_name ELSE quotation_file_name END,
    workflow_log = workflow_log || jsonb_build_object('at', now(), 'by', coalesce(actor, ''), 'from', d.workflow_step, 'to', nxt, 'action', p_action, 'note', coalesce(p_note, ''))
  WHERE id = p_id;

  msg := 'طلب تسعير «' || d.project || '» — ' || d.client || E'\n' ||
    CASE WHEN p_action = 'reject' THEN 'أُعيد إليك بعد رفض من ' ELSE 'وصل إلى مرحلة: ' || labels[array_position(steps, nxt)] || ' — من ' END ||
    coalesce(actor, '') || CASE WHEN coalesce(p_note, '') <> '' THEN E'\nملاحظة: ' || p_note ELSE '' END;
  FOR r IN SELECT id FROM public.profiles WHERE id <> auth.uid() AND (
      email = public.sales_step_email(nxt)
      OR (nxt = 'sales_entry' AND id = d.owner_id)
      OR (nxt = 'done' AND (id = d.owner_id OR email = 'eilaf@metalfuze.local'))) LOOP
    INSERT INTO public.direct_messages(sender_id, recipient_id, body) VALUES (auth.uid(), r.id, left(msg, 4000));
  END LOOP;
  RETURN nxt;
END $$;
REVOKE ALL ON FUNCTION public.sales_advance(uuid, text, text, numeric, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sales_advance(uuid, text, text, numeric, text, text) TO authenticated;

CREATE POLICY "sales wf files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sales-files'
  AND (auth.jwt() ->> 'email') IN ('eilaf@metalfuze.local','haitham@metalfuze.local') AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "sales wf files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'sales-files'
  AND (auth.jwt() ->> 'email') IN ('eilaf@metalfuze.local','haitham@metalfuze.local') AND (storage.foldername(name))[1] = auth.uid()::text);