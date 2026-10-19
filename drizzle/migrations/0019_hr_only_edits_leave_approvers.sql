CREATE OR REPLACE FUNCTION public.leave_can_approve(_uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ select public.is_hr(_uid) or _uid = '07bbb9e4-535d-49c7-b0c7-049bde665d27'::uuid $$;
GRANT EXECUTE ON FUNCTION public.leave_can_approve(uuid) TO authenticated;
DROP POLICY "Admins delete employees" ON public.employees;
DROP POLICY "Admins insert employees" ON public.employees;
DROP POLICY "Admins update employees" ON public.employees;
DROP POLICY "Admins and HR write hr records" ON public.hr_records;
CREATE POLICY "HR writes hr records" ON public.hr_records FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
DROP POLICY "Admins and HR manage late excuses" ON public.late_excuses;
CREATE POLICY "HR manages late excuses" ON public.late_excuses FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
DROP POLICY "Editors write residencies" ON public.residencies;
CREATE POLICY "HR writes residencies" ON public.residencies FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
DROP POLICY "Admins manage leave settings" ON public.leave_settings;
CREATE POLICY "HR manages leave settings" ON public.leave_settings FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
DROP POLICY "Admins manage leave types" ON public.leave_types;
CREATE POLICY "HR manages leave types" ON public.leave_types FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
DROP POLICY "Admins manage dept managers" ON public.department_managers;
CREATE POLICY "HR manages dept managers" ON public.department_managers FOR ALL TO authenticated USING (public.is_hr(auth.uid())) WITH CHECK (public.is_hr(auth.uid()));
DROP POLICY "Editors upload employee files" ON storage.objects;
DROP POLICY "Editors update employee files" ON storage.objects;
DROP POLICY "Editors delete employee files" ON storage.objects;
CREATE POLICY "HR uploads employee files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'employee-files' AND public.is_hr(auth.uid()));
CREATE POLICY "HR updates employee files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'employee-files' AND public.is_hr(auth.uid()));
CREATE POLICY "HR deletes employee files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'employee-files' AND public.is_hr(auth.uid()));
CREATE OR REPLACE FUNCTION public.leave_create(p_emp text, p_type text, p_start date, p_end date, p_reason text, p_attach_path text DEFAULT NULL::text, p_attach_name text DEFAULT NULL::text, p_submit boolean DEFAULT true, p_return date DEFAULT NULL::date)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_via text; st text; nid uuid;
BEGIN
  IF auth.role() = 'service_role' THEN v_via := 'link';
  ELSIF public.is_hr(auth.uid()) THEN v_via := 'staff';
  ELSE RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_emp AND active) THEN RAISE EXCEPTION 'LEAVE_EMPLOYEE'; END IF;
  st := CASE WHEN p_submit THEN 'pending_manager' ELSE 'draft' END;
  INSERT INTO public.leave_requests(employee_id, type_id, start_date, end_date, reason, attachment_path, attachment_name, status, via, created_by, return_date)
  VALUES (p_emp, p_type, p_start, p_end, coalesce(p_reason,''), p_attach_path, p_attach_name, st, v_via, auth.uid(), p_return)
  RETURNING id INTO nid;
  PERFORM public.leave_log(nid, 'create', NULL, st, NULL);
  RETURN nid;
END $function$;
CREATE OR REPLACE FUNCTION public.leave_adjust(p_emp text, p_days numeric, p_kind text, p_note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_hr(auth.uid())) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
  IF coalesce(trim(p_note),'') = '' THEN RAISE EXCEPTION 'LEAVE_REASON'; END IF;
  INSERT INTO public.leave_balance_adjustments(employee_id, kind, days, note, actor_id, actor_name)
  VALUES (p_emp, p_kind, p_days, p_note, auth.uid(), public.leave_actor_name(auth.uid()));
END $function$;
CREATE OR REPLACE FUNCTION public.leave_transition(p_id uuid, p_action text, p_note text DEFAULT NULL::text, p_emp text DEFAULT NULL::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.leave_requests; d text; t public.leave_types; nxt text; uid uuid := auth.uid(); avail numeric;
  v_hr boolean := public.is_hr(auth.uid());
  svc boolean := auth.role() = 'service_role';
BEGIN
  SELECT * INTO r FROM public.leave_requests WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'LEAVE_NOT_FOUND'; END IF;
  SELECT dept INTO d FROM public.employees WHERE id = r.employee_id;
  SELECT * INTO t FROM public.leave_types WHERE id = r.type_id;
  IF svc AND (p_emp IS NULL OR p_emp <> r.employee_id OR p_action NOT IN ('cancel','submit')) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
  IF p_action = 'submit' THEN
    IF r.status <> 'draft' THEN RAISE EXCEPTION 'LEAVE_STATE'; END IF;
    IF NOT (svc OR v_hr) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
    nxt := 'pending_manager';
  ELSIF p_action IN ('manager_approve','manager_reject') THEN
    IF r.status <> 'pending_manager' THEN RAISE EXCEPTION 'LEAVE_STATE'; END IF;
    IF NOT public.leave_can_approve(uid) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
    IF p_action = 'manager_reject' AND coalesce(trim(p_note),'') = '' THEN RAISE EXCEPTION 'LEAVE_REASON'; END IF;
    nxt := CASE WHEN p_action = 'manager_approve' THEN 'pending_hr' ELSE 'rejected' END;
    UPDATE public.leave_requests SET manager_note = p_note WHERE id = p_id;
  ELSIF p_action IN ('hr_approve','hr_reject') THEN
    IF r.status <> 'pending_hr' THEN RAISE EXCEPTION 'LEAVE_STATE'; END IF;
    IF NOT public.leave_can_approve(uid) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
    IF p_action = 'hr_reject' AND coalesce(trim(p_note),'') = '' THEN RAISE EXCEPTION 'LEAVE_REASON'; END IF;
    IF p_action = 'hr_approve' AND t.uses_balance THEN
      SELECT b.remaining INTO avail FROM public.leave_balances() b WHERE b.employee_id = r.employee_id;
      IF coalesce(avail,0) < r.working_days THEN RAISE EXCEPTION 'LEAVE_BALANCE'; END IF;
    END IF;
    nxt := CASE WHEN p_action = 'hr_approve' THEN 'approved' ELSE 'rejected' END;
    UPDATE public.leave_requests SET hr_note = p_note WHERE id = p_id;
  ELSIF p_action = 'cancel' THEN
    IF r.status IN ('rejected','cancelled') THEN RAISE EXCEPTION 'LEAVE_STATE'; END IF;
    IF svc AND r.status NOT IN ('draft','pending_manager','pending_hr') THEN RAISE EXCEPTION 'LEAVE_STATE'; END IF;
    IF NOT (svc OR v_hr) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
    nxt := 'cancelled';
  ELSE RAISE EXCEPTION 'LEAVE_ACTION'; END IF;
  UPDATE public.leave_requests SET status = nxt WHERE id = p_id;
  PERFORM public.leave_log(p_id, p_action, r.status, nxt, p_note);
  RETURN nxt;
END $function$;