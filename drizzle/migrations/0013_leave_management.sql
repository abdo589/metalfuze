
CREATE TABLE public.leave_types (
  id text PRIMARY KEY,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  paid boolean NOT NULL DEFAULT true,
  uses_balance boolean NOT NULL DEFAULT false,
  max_days integer,
  requires_attachment boolean NOT NULL DEFAULT false,
  calendar_days boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;
GRANT ALL ON public.leave_types TO service_role;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read leave types" ON public.leave_types FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid()));
CREATE POLICY "Admins manage leave types" ON public.leave_types FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.leave_types (id,name_ar,name_en,paid,uses_balance,max_days,requires_attachment,calendar_days,sort) VALUES
 ('annual','الإجازة السنوية','Annual Leave',true,true,NULL,false,false,1),
 ('sick','الإجازة المرضية','Sick Leave',true,false,NULL,true,false,2),
 ('unpaid','إجازة بدون راتب','Unpaid Leave',false,false,NULL,false,false,3),
 ('marriage','إجازة الزواج','Marriage Leave',true,false,5,false,false,4),
 ('bereavement','إجازة الوفاة','Bereavement Leave',true,false,5,false,false,5),
 ('newborn','إجازة المولود','Paternity Leave',true,false,3,false,false,6),
 ('maternity','إجازة الوضع','Maternity Leave',true,false,70,true,true,7),
 ('exam','إجازة الاختبارات','Exam Leave',true,false,NULL,true,false,8),
 ('compensatory','الإجازة التعويضية','Compensatory Leave',true,false,NULL,false,false,9),
 ('emergency','إجازة اضطرارية','Emergency Leave',true,false,NULL,false,false,10),
 ('other','أخرى','Other',true,false,NULL,false,false,11);

CREATE TABLE public.leave_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  tiers jsonb NOT NULL DEFAULT '[{"years":0,"days":21},{"years":5,"days":30}]'::jsonb,
  weekend integer[] NOT NULL DEFAULT '{5,6}',
  accrual_from date NOT NULL DEFAULT '2026-01-01'
);
GRANT SELECT, INSERT, UPDATE ON public.leave_settings TO authenticated;
GRANT ALL ON public.leave_settings TO service_role;
ALTER TABLE public.leave_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read leave settings" ON public.leave_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid()));
CREATE POLICY "Admins manage leave settings" ON public.leave_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.leave_settings (id) VALUES (1);

CREATE TABLE public.department_managers (
  dept text PRIMARY KEY,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_managers TO authenticated;
GRANT ALL ON public.department_managers TO service_role;
ALTER TABLE public.department_managers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read dept managers" ON public.department_managers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid()));
CREATE POLICY "Admins manage dept managers" ON public.department_managers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no bigint GENERATED ALWAYS AS IDENTITY (START WITH 1001) UNIQUE,
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  type_id text NOT NULL REFERENCES public.leave_types(id),
  start_date date NOT NULL,
  end_date date NOT NULL,
  working_days numeric NOT NULL DEFAULT 0,
  return_date date,
  reason text NOT NULL DEFAULT '',
  attachment_path text,
  attachment_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_manager','pending_hr','approved','rejected','cancelled')),
  manager_note text,
  hr_note text,
  via text NOT NULL DEFAULT 'staff',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leave_requests_emp_idx ON public.leave_requests(employee_id, start_date);
GRANT SELECT ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read leave requests" ON public.leave_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid()));

CREATE TABLE public.leave_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  note text,
  actor_id uuid,
  actor_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leave_request_events TO authenticated;
GRANT ALL ON public.leave_request_events TO service_role;
ALTER TABLE public.leave_request_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read leave events" ON public.leave_request_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid()));

CREATE TABLE public.leave_balance_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'adjust' CHECK (kind IN ('opening','adjust')),
  days numeric NOT NULL,
  note text NOT NULL DEFAULT '',
  actor_id uuid,
  actor_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leave_balance_adjustments TO authenticated;
GRANT ALL ON public.leave_balance_adjustments TO service_role;
ALTER TABLE public.leave_balance_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read balance adjustments" ON public.leave_balance_adjustments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid()));

CREATE TABLE public.leave_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  employee_id text,
  audience text NOT NULL CHECK (audience IN ('employee','manager','hr')),
  dept text,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.leave_notifications TO authenticated;
GRANT ALL ON public.leave_notifications TO service_role;
ALTER TABLE public.leave_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read leave notifications" ON public.leave_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid()));

CREATE OR REPLACE FUNCTION public.is_dept_manager(_uid uuid, _dept text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select exists(select 1 from public.department_managers where user_id=_uid and dept=_dept) $$;

CREATE OR REPLACE FUNCTION public.leave_actor_name(_uid uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select coalesce((select coalesce(nullif(raw_user_meta_data->>'full_name',''), email) from auth.users where id=_uid), '') $$;

CREATE OR REPLACE FUNCTION public.leave_is_weekend(_d date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select array_position(coalesce((select weekend from public.leave_settings where id=1), '{}'::integer[]), extract(dow from _d)::integer) is not null $$;

CREATE OR REPLACE FUNCTION public.leave_working_days(_start date, _end date, _calendar boolean) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select count(*)::int from generate_series(_start, _end, interval '1 day') d
  where _calendar or not public.leave_is_weekend(d::date) $$;

CREATE OR REPLACE FUNCTION public.leave_next_workday(_d date) RETURNS date
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  select min(d)::date from generate_series(_d + 1, _d + 10, interval '1 day') d
  where not public.leave_is_weekend(d::date) $$;

CREATE OR REPLACE FUNCTION public.leave_requests_validate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.leave_types;
BEGIN
  IF NEW.end_date < NEW.start_date THEN RAISE EXCEPTION 'LEAVE_DATES'; END IF;
  SELECT * INTO t FROM public.leave_types WHERE id = NEW.type_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'LEAVE_TYPE'; END IF;
  NEW.working_days := public.leave_working_days(NEW.start_date, NEW.end_date, t.calendar_days);
  IF NEW.working_days <= 0 THEN RAISE EXCEPTION 'LEAVE_NO_WORKDAYS'; END IF;
  IF NEW.return_date IS NULL THEN NEW.return_date := public.leave_next_workday(NEW.end_date); END IF;
  IF NEW.status NOT IN ('rejected','cancelled') THEN
    IF EXISTS (SELECT 1 FROM public.leave_requests r WHERE r.employee_id = NEW.employee_id AND r.id <> NEW.id
               AND r.status NOT IN ('rejected','cancelled') AND r.start_date <= NEW.end_date AND r.end_date >= NEW.start_date) THEN
      RAISE EXCEPTION 'LEAVE_OVERLAP';
    END IF;
    IF NEW.status <> 'draft' AND t.requires_attachment AND NEW.attachment_path IS NULL AND NEW.via <> 'import' THEN
      RAISE EXCEPTION 'LEAVE_ATTACHMENT';
    END IF;
    IF t.max_days IS NOT NULL AND NEW.working_days > t.max_days AND NEW.via <> 'import' THEN
      RAISE EXCEPTION 'LEAVE_MAX_DAYS';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER leave_requests_validate BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.leave_requests_validate();

CREATE OR REPLACE FUNCTION public.leave_balances() RETURNS TABLE (
  employee_id text, joined date, entitlement numeric, opening numeric, adjustments numeric,
  earned numeric, used numeric, booked numeric, remaining numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.leave_settings;
BEGIN
  IF NOT (auth.role() = 'service_role' OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid())) THEN
    RETURN;
  END IF;
  SELECT * INTO s FROM public.leave_settings WHERE id = 1;
  RETURN QUERY
  WITH e AS (SELECT x.id, x.joined FROM public.employees x),
  rate AS (
    SELECT e.id, (SELECT (t->>'days')::numeric FROM jsonb_array_elements(s.tiers) t
        WHERE (t->>'years')::numeric <= extract(year from age(d::date, coalesce(e.joined, s.accrual_from)))
        ORDER BY (t->>'years')::numeric DESC LIMIT 1) / 365.0 AS r
    FROM e, generate_series(greatest(coalesce(e.joined, s.accrual_from), s.accrual_from), current_date, interval '1 day') d
  ),
  earned AS (SELECT rate.id, round(sum(rate.r), 2) AS v FROM rate GROUP BY rate.id),
  adj AS (SELECT a.employee_id AS id,
      sum(a.days) FILTER (WHERE a.kind='opening') AS op, sum(a.days) FILTER (WHERE a.kind='adjust') AS ad
    FROM public.leave_balance_adjustments a GROUP BY a.employee_id),
  req AS (SELECT r.employee_id AS id,
      sum(r.working_days) FILTER (WHERE r.start_date <= current_date) AS u,
      sum(r.working_days) FILTER (WHERE r.start_date > current_date) AS b
    FROM public.leave_requests r JOIN public.leave_types t ON t.id = r.type_id
    WHERE r.status = 'approved' AND t.uses_balance GROUP BY r.employee_id)
  SELECT e.id, e.joined,
    (SELECT (t->>'days')::numeric FROM jsonb_array_elements(s.tiers) t
      WHERE (t->>'years')::numeric <= extract(year from age(current_date, coalesce(e.joined, current_date)))
      ORDER BY (t->>'years')::numeric DESC LIMIT 1),
    coalesce(adj.op,0), coalesce(adj.ad,0), coalesce(earned.v,0), coalesce(req.u,0), coalesce(req.b,0),
    round(coalesce(adj.op,0) + coalesce(adj.ad,0) + coalesce(earned.v,0) - coalesce(req.u,0) - coalesce(req.b,0), 2)
  FROM e LEFT JOIN earned ON earned.id = e.id LEFT JOIN adj ON adj.id = e.id LEFT JOIN req ON req.id = e.id;
END $$;

CREATE OR REPLACE FUNCTION public.leave_log(_req uuid, _action text, _from text, _to text, _note text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.leave_requests; d text; tn text; msg text;
BEGIN
  SELECT * INTO r FROM public.leave_requests WHERE id = _req;
  SELECT dept INTO d FROM public.employees WHERE id = r.employee_id;
  SELECT name_ar INTO tn FROM public.leave_types WHERE id = r.type_id;
  INSERT INTO public.leave_request_events(request_id, action, from_status, to_status, note, actor_id, actor_name)
  VALUES (_req, _action, _from, _to, _note, auth.uid(),
    CASE WHEN auth.uid() IS NULL THEN 'الموظف' ELSE public.leave_actor_name(auth.uid()) END);
  msg := '#' || r.request_no || '|' || tn || '|' || _to;
  INSERT INTO public.leave_notifications(request_id, employee_id, audience, dept, message) VALUES
    (_req, r.employee_id, 'employee', d, msg), (_req, r.employee_id, 'manager', d, msg), (_req, r.employee_id, 'hr', d, msg);
END $$;

CREATE OR REPLACE FUNCTION public.leave_create(p_emp text, p_type text, p_start date, p_end date, p_reason text,
  p_attach_path text DEFAULT NULL, p_attach_name text DEFAULT NULL, p_submit boolean DEFAULT true, p_return date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_via text; st text; nid uuid;
BEGIN
  IF auth.role() = 'service_role' THEN v_via := 'link';
  ELSIF public.has_role(auth.uid(),'admin') OR public.is_hr(auth.uid()) THEN v_via := 'staff';
  ELSE RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.employees WHERE id = p_emp AND active) THEN RAISE EXCEPTION 'LEAVE_EMPLOYEE'; END IF;
  st := CASE WHEN p_submit THEN 'pending_manager' ELSE 'draft' END;
  INSERT INTO public.leave_requests(employee_id, type_id, start_date, end_date, reason, attachment_path, attachment_name, status, via, created_by, return_date)
  VALUES (p_emp, p_type, p_start, p_end, coalesce(p_reason,''), p_attach_path, p_attach_name, st, v_via, auth.uid(), p_return)
  RETURNING id INTO nid;
  PERFORM public.leave_log(nid, 'create', NULL, st, NULL);
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.leave_transition(p_id uuid, p_action text, p_note text DEFAULT NULL, p_emp text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.leave_requests; d text; t public.leave_types; nxt text; uid uuid := auth.uid(); avail numeric;
  v_admin boolean := public.has_role(auth.uid(),'admin'); v_hr boolean := public.is_hr(auth.uid());
  svc boolean := auth.role() = 'service_role';
BEGIN
  SELECT * INTO r FROM public.leave_requests WHERE id = p_id FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'LEAVE_NOT_FOUND'; END IF;
  SELECT dept INTO d FROM public.employees WHERE id = r.employee_id;
  SELECT * INTO t FROM public.leave_types WHERE id = r.type_id;
  IF svc AND (p_emp IS NULL OR p_emp <> r.employee_id OR p_action NOT IN ('cancel','submit')) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;

  IF p_action = 'submit' THEN
    IF r.status <> 'draft' THEN RAISE EXCEPTION 'LEAVE_STATE'; END IF;
    IF NOT (svc OR v_admin OR v_hr) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
    nxt := 'pending_manager';
  ELSIF p_action IN ('manager_approve','manager_reject') THEN
    IF r.status <> 'pending_manager' THEN RAISE EXCEPTION 'LEAVE_STATE'; END IF;
    IF NOT (v_admin OR public.is_dept_manager(uid, d)) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
    IF p_action = 'manager_reject' AND coalesce(trim(p_note),'') = '' THEN RAISE EXCEPTION 'LEAVE_REASON'; END IF;
    nxt := CASE WHEN p_action = 'manager_approve' THEN 'pending_hr' ELSE 'rejected' END;
    UPDATE public.leave_requests SET manager_note = p_note WHERE id = p_id;
  ELSIF p_action IN ('hr_approve','hr_reject') THEN
    IF r.status <> 'pending_hr' THEN RAISE EXCEPTION 'LEAVE_STATE'; END IF;
    IF NOT (v_admin OR v_hr) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
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
    IF NOT (svc OR v_admin OR v_hr) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
    nxt := 'cancelled';
  ELSE RAISE EXCEPTION 'LEAVE_ACTION'; END IF;

  UPDATE public.leave_requests SET status = nxt WHERE id = p_id;
  PERFORM public.leave_log(p_id, p_action, r.status, nxt, p_note);
  RETURN nxt;
END $$;

CREATE OR REPLACE FUNCTION public.leave_adjust(p_emp text, p_days numeric, p_kind text, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.is_hr(auth.uid())) THEN RAISE EXCEPTION 'LEAVE_FORBIDDEN'; END IF;
  IF coalesce(trim(p_note),'') = '' THEN RAISE EXCEPTION 'LEAVE_REASON'; END IF;
  INSERT INTO public.leave_balance_adjustments(employee_id, kind, days, note, actor_id, actor_name)
  VALUES (p_emp, p_kind, p_days, p_note, auth.uid(), public.leave_actor_name(auth.uid()));
END $$;

REVOKE EXECUTE ON FUNCTION public.leave_create(text,text,date,date,text,text,text,boolean,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_transition(uuid,text,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_adjust(text,numeric,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_balances() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.leave_log(uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.leave_create(text,text,date,date,text,text,text,boolean,date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_transition(uuid,text,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_adjust(text,numeric,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_balances() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.leave_working_days(date,date,boolean) TO authenticated, service_role;
