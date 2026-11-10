-- Haitham's account gets everything the CEO account has (CEO keeps working too).
CREATE OR REPLACE FUNCTION public.has_ceo_access()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT coalesce(public.verified_email() IN ('ceo@metalfuze.local','haitham@metalfuze.local'), false) $$;
GRANT EXECUTE ON FUNCTION public.has_ceo_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_edit_shared()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.has_role(auth.uid(),'admin') OR public.has_ceo_access(); $$;

CREATE OR REPLACE FUNCTION public.leave_can_approve(_uid uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ select public.is_hr(_uid) or _uid in ('07bbb9e4-535d-49c7-b0c7-049bde665d27'::uuid, 'c8dfbe10-7c82-4e02-989d-1d1dca235dc5'::uuid) $$;

CREATE OR REPLACE FUNCTION public.sales_advance(p_id uuid, p_action text, p_note text, p_price numeric DEFAULT NULL::numeric, p_file_path text DEFAULT NULL::text, p_file_name text DEFAULT NULL::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
  ELSIF d.workflow_step = 'done' OR NOT (me IS NOT DISTINCT FROM public.sales_step_email(d.workflow_step)
      OR (d.workflow_step = 'ceo_approval' AND public.has_ceo_access())) THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF p_action = 'approve' THEN
    IF d.workflow_step = 'haitham_pricing' AND p_file_path IS NULL THEN RAISE EXCEPTION 'file required'; END IF;
    IF d.workflow_step = 'eilaf_quotation' AND p_file_path IS NULL THEN RAISE EXCEPTION 'file required'; END IF;
    nxt := steps[array_position(steps, d.workflow_step) + 1];
  ELSIF p_action = 'reject' THEN
    nxt := CASE WHEN d.workflow_step = 'eilaf_review' THEN 'sales_entry' ELSE 'eilaf_review' END;
  ELSE RAISE EXCEPTION 'bad action'; END IF;

  PERFORM set_config('app.sales_wf', '1', true);
  UPDATE public.sales_deals SET workflow_step = nxt, updated_at = now(),
    pricing_value = CASE WHEN d.workflow_step = 'haitham_pricing' AND p_action = 'approve' THEN p_price ELSE pricing_value END,
    quote_value = CASE WHEN d.workflow_step = 'haitham_pricing' AND p_action = 'approve' THEN coalesce(p_price, quote_value) ELSE quote_value END,
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
END $function$;

-- Every message sent to the CEO account is also delivered to Haitham.
CREATE OR REPLACE FUNCTION public.dm_copy_ceo_to_haitham()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE ceo uuid; hai uuid;
BEGIN
  SELECT id INTO ceo FROM public.profiles WHERE lower(email) = 'ceo@metalfuze.local';
  SELECT id INTO hai FROM public.profiles WHERE lower(email) = 'haitham@metalfuze.local';
  IF ceo IS NULL OR hai IS NULL OR NEW.recipient_id <> ceo OR NEW.sender_id = hai THEN RETURN NEW; END IF;
  INSERT INTO public.direct_messages(sender_id, recipient_id, body, attachment_path, attachment_name)
  VALUES (NEW.sender_id, hai, left('📩 نسخة من رسالة إلى CEO:' || E'\n' || NEW.body, 4000), NEW.attachment_path, NEW.attachment_name);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dm_copy_ceo_to_haitham ON public.direct_messages;
CREATE TRIGGER trg_dm_copy_ceo_to_haitham AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.dm_copy_ceo_to_haitham();

-- Recipients may open attachments the sender uploaded from their own folder (needed for the copied CEO messages).
CREATE POLICY "dm files read by recipient" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'message-files' AND EXISTS (
  SELECT 1 FROM public.direct_messages m
  WHERE m.recipient_id = auth.uid() AND m.attachment_path = storage.objects.name
    AND (storage.foldername(storage.objects.name))[1] = m.sender_id::text));