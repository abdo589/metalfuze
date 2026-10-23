CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_name text NOT NULL DEFAULT '',
  table_name text NOT NULL,
  action text NOT NULL,
  row_id text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_created_idx ON public.activity_log (created_at DESC);
CREATE INDEX activity_log_user_idx ON public.activity_log (user_id, created_at DESC);
GRANT SELECT ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "developer reads activity" ON public.activity_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'developer'));

CREATE OR REPLACE FUNCTION public.log_activity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  j jsonb;
  nm text;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  j := to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
  SELECT coalesce(display_name, email, '') INTO nm FROM public.profiles WHERE id = uid;
  INSERT INTO public.activity_log (user_id, actor_name, table_name, action, row_id, label)
  VALUES (uid, coalesce(nm, ''), TG_TABLE_NAME, lower(TG_OP), coalesce(j->>'id', j->>'key', ''),
    left(coalesce(j->>'name', j->>'title', j->>'full_name', j->>'employee_name', j->>'client_name', j->>'project_name', j->>'subject', j->>'key', ''), 120));
  RETURN NULL;
EXCEPTION WHEN others THEN RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['acct_sheets','company_documents','department_managers','direct_messages','employees','est_records','exec_snapshot','financial_guarantees','fleet_cars','hr_records','late_excuses','leave_balance_adjustments','leave_requests','leave_settings','leave_types','mgr_projects','mgr_reports','performance_reviews','project_files','residencies','sales_deals','settlements','traffic_violations','work_sites','attendance_logs','attendance_devices'] LOOP
    EXECUTE format('CREATE TRIGGER trg_activity_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.log_activity()', t);
  END LOOP;
END $$;