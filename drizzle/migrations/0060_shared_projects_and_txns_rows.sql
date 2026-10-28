CREATE TABLE public.shared_projects (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
CREATE TABLE public.shared_txns (
  id text PRIMARY KEY,
  project_id text,
  number text NOT NULL DEFAULT '',
  data jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);
CREATE SEQUENCE public.txn_rec_seq;
CREATE SEQUENCE public.txn_pay_seq;

GRANT SELECT, INSERT, UPDATE ON public.shared_projects, public.shared_txns TO authenticated;
GRANT ALL ON public.shared_projects, public.shared_txns TO service_role;
GRANT USAGE ON SEQUENCE public.txn_rec_seq, public.txn_pay_seq TO authenticated, service_role;

ALTER TABLE public.shared_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_txns ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_edit_shared() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.verified_email() = 'ceo@metalfuze.local';
$$;
CREATE OR REPLACE FUNCTION public.can_read_shared() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_edit_shared() OR public.has_role(auth.uid(),'executive');
$$;

CREATE POLICY sp_read ON public.shared_projects FOR SELECT TO authenticated USING (public.can_read_shared());
CREATE POLICY sp_ins ON public.shared_projects FOR INSERT TO authenticated WITH CHECK (public.can_edit_shared() AND public.can_write(auth.uid()));
CREATE POLICY sp_upd ON public.shared_projects FOR UPDATE TO authenticated USING (public.can_edit_shared() AND public.can_write(auth.uid())) WITH CHECK (public.can_edit_shared());
CREATE POLICY st_read ON public.shared_txns FOR SELECT TO authenticated USING (public.can_read_shared());
CREATE POLICY st_ins ON public.shared_txns FOR INSERT TO authenticated WITH CHECK (public.can_edit_shared() AND public.can_write(auth.uid()));
CREATE POLICY st_upd ON public.shared_txns FOR UPDATE TO authenticated USING (public.can_edit_shared() AND public.can_write(auth.uid())) WITH CHECK (public.can_edit_shared());

-- Backfill current shared data as-is.
INSERT INTO public.shared_projects (id, data)
SELECT DISTINCT ON (e->>'id') e->>'id', e FROM public.exec_snapshot s, jsonb_array_elements(s.data) e
WHERE s.key = 'projects' AND coalesce(e->>'id','') <> '' ON CONFLICT DO NOTHING;
INSERT INTO public.shared_txns (id, project_id, number, data)
SELECT DISTINCT ON (e->>'id') e->>'id',
  (SELECT p.id FROM public.shared_projects p WHERE trim(p.data->>'name') = trim(e->>'project') LIMIT 1),
  coalesce(nullif(e->>'number',''), 'OLD-' || (e->>'id')),
  e || jsonb_build_object('projectId', (SELECT p.id FROM public.shared_projects p WHERE trim(p.data->>'name') = trim(e->>'project') LIMIT 1))
FROM public.exec_snapshot s, jsonb_array_elements(s.data) e
WHERE s.key = 'transactions' AND coalesce(e->>'id','') <> '' ON CONFLICT DO NOTHING;
UPDATE public.shared_txns t SET number = t.number || '-' || t.id
WHERE EXISTS (SELECT 1 FROM public.shared_txns o WHERE o.number = t.number AND o.id < t.id);
UPDATE public.shared_txns SET data = jsonb_set(data, '{number}', to_jsonb(number));
SELECT setval('public.txn_rec_seq', greatest(1, coalesce((SELECT max((substring(number from '^REC-(\d+)$'))::int) FROM public.shared_txns), 1)), true);
SELECT setval('public.txn_pay_seq', greatest(1, coalesce((SELECT max((substring(number from '^PAY-(\d+)$'))::int) FROM public.shared_txns), 1)), true);
CREATE UNIQUE INDEX shared_txns_number_uq ON public.shared_txns(number);

-- Versions move forward by one on every save; receipt numbers come from the database and never change.
CREATE OR REPLACE FUNCTION public.shared_projects_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  IF TG_OP = 'UPDATE' THEN NEW.version := OLD.version + 1; ELSE NEW.version := 1; END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.shared_txns_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now(); NEW.updated_by := auth.uid();
  IF TG_OP = 'UPDATE' THEN
    NEW.version := OLD.version + 1;
    NEW.number := OLD.number;
  ELSE
    NEW.version := 1;
    IF NEW.data->>'type' = 'collect' THEN NEW.number := 'REC-' || lpad(nextval('public.txn_rec_seq')::text, 4, '0');
    ELSE NEW.number := 'PAY-' || lpad(nextval('public.txn_pay_seq')::text, 4, '0'); END IF;
  END IF;
  NEW.data := jsonb_set(NEW.data, '{number}', to_jsonb(NEW.number));
  NEW.project_id := nullif(NEW.data->>'projectId','');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_shared_projects_guard BEFORE INSERT OR UPDATE ON public.shared_projects FOR EACH ROW EXECUTE FUNCTION public.shared_projects_guard();
CREATE TRIGGER trg_shared_txns_guard BEFORE INSERT OR UPDATE ON public.shared_txns FOR EACH ROW EXECUTE FUNCTION public.shared_txns_guard();

CREATE TRIGGER trg_activity_shared_projects AFTER INSERT OR UPDATE OR DELETE ON public.shared_projects FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_shared_txns AFTER INSERT OR UPDATE OR DELETE ON public.shared_txns FOR EACH ROW EXECUTE FUNCTION public.log_activity();

ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_projects, public.shared_txns;
COMMENT ON TABLE public.exec_snapshot IS 'DEPRECATED for projects/transactions: replaced by shared_projects and shared_txns';