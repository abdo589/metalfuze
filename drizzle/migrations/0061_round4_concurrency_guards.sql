CREATE UNIQUE INDEX IF NOT EXISTS attendance_remote_once_per_day
  ON public.attendance_logs (device_user_id, ((punched_at AT TIME ZONE 'Asia/Riyadh')::date), coalesce(status,-1))
  WHERE device_sn = 'REMOTE';

CREATE OR REPLACE FUNCTION public.leave_no_overlap() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('rejected','cancelled') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('leave:'||NEW.employee_id));
  IF EXISTS (SELECT 1 FROM public.leave_requests o WHERE o.employee_id = NEW.employee_id AND o.id <> NEW.id
      AND o.status NOT IN ('rejected','cancelled')
      AND o.start_date <= NEW.end_date AND o.end_date >= NEW.start_date) THEN
    RAISE EXCEPTION 'LEAVE_OVERLAP';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_leave_no_overlap ON public.leave_requests;
CREATE TRIGGER trg_leave_no_overlap BEFORE INSERT OR UPDATE OF start_date, end_date, status, employee_id ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_no_overlap();

CREATE OR REPLACE FUNCTION public.leave_transition(p_id uuid, p_action text, p_note text DEFAULT NULL::text, p_emp text DEFAULT NULL::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r public.leave_requests; d text; t public.leave_types; nxt text; uid uuid := auth.uid(); avail numeric;
  v_hr boolean := public.is_hr(auth.uid());
  svc boolean := auth.role() = 'service_role';
  v_emp text;
BEGIN
  SELECT employee_id INTO v_emp FROM public.leave_requests WHERE id = p_id;
  IF v_emp IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtext('leave:'||v_emp)); END IF;
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