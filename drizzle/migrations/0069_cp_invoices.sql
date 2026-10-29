CREATE OR REPLACE FUNCTION public.cp_can_invoice(_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_write(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id=_project AND m.user_id=auth.uid() AND m.access_role IN ('admin','project_manager','accountant')));
$$;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  invoice_no integer NOT NULL DEFAULT 0,
  period_from date,
  period_to date,
  wir_ids uuid[] NOT NULL DEFAULT '{}',
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  retention_pct numeric NOT NULL DEFAULT 10 CHECK (retention_pct >= 0 AND retention_pct <= 100),
  net_amount numeric GENERATED ALWAYS AS (round(amount * (1 - retention_pct / 100), 2)) STORED,
  submitted_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','paid','rejected')),
  paid_date date,
  notes text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, invoice_no)
);
CREATE TABLE public.invoice_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  note_date date NOT NULL DEFAULT current_date,
  note text NOT NULL,
  author_id uuid DEFAULT auth.uid(),
  author_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.invoice_notes(invoice_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices, public.invoice_notes TO authenticated;
GRANT ALL ON public.invoices, public.invoice_notes TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_notes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.invoices_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE bad int;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtext('inv' || NEW.project_id::text));
    NEW.invoice_no := (SELECT COALESCE(MAX(invoice_no),0)+1 FROM public.invoices WHERE project_id = NEW.project_id);
    NEW.created_by := auth.uid();
  ELSE
    NEW.project_id := OLD.project_id; NEW.invoice_no := OLD.invoice_no; NEW.created_by := OLD.created_by; NEW.updated_at := now();
  END IF;
  SELECT count(*) INTO bad FROM unnest(NEW.wir_ids) w
    WHERE NOT EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = w AND s.project_id = NEW.project_id AND s.type = 'WIR' AND s.code IN ('A','B'));
  IF bad > 0 THEN RAISE EXCEPTION 'Only WIRs of this project with code A or B can be linked'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_invoices_guard BEFORE INSERT OR UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.invoices_guard();

CREATE OR REPLACE FUNCTION public.invoice_notes_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.author_id := auth.uid();
  NEW.author_name := COALESCE((SELECT display_name FROM public.profiles WHERE id = auth.uid()), '');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_invoice_notes_stamp BEFORE INSERT ON public.invoice_notes FOR EACH ROW EXECUTE FUNCTION public.invoice_notes_stamp();

CREATE POLICY "members read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.cp_is_member(project_id));
CREATE POLICY "finance create invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (public.cp_can_invoice(project_id));
CREATE POLICY "finance update invoices" ON public.invoices FOR UPDATE TO authenticated USING (public.cp_can_invoice(project_id)) WITH CHECK (public.cp_can_invoice(project_id));
CREATE POLICY "finance delete invoices" ON public.invoices FOR DELETE TO authenticated USING (public.cp_can_invoice(project_id));

CREATE POLICY "members read invoice notes" ON public.invoice_notes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.cp_is_member(i.project_id)));
CREATE POLICY "finance add invoice notes" ON public.invoice_notes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_id AND public.cp_can_invoice(i.project_id)));

CREATE POLICY "cp invoice files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='contract-files' AND (storage.foldername(name))[2] = 'invoices' AND public.cp_can_invoice(((storage.foldername(name))[1])::uuid));

INSERT INTO public.invoices (project_id,period_from,period_to,wir_ids,amount,retention_pct,submitted_date,status,paid_date,notes) VALUES
('11111111-1111-4111-8111-111111111111','2026-03-01','2026-05-31','{}',1850000,10,'2026-06-05','paid','2026-07-10','مستخلص رقم 1 - أعمال الحفر والقواعد'),
('11111111-1111-4111-8111-111111111111','2026-06-01','2026-08-31','{}',2400000,10,'2026-09-10','approved',NULL,'مستخلص رقم 2 - الهيكل الخرساني');
INSERT INTO public.invoices (project_id,period_from,period_to,wir_ids,amount,retention_pct,submitted_date,status,notes)
SELECT '11111111-1111-4111-8111-111111111111','2026-09-01','2026-10-31', ARRAY(SELECT id FROM public.submissions WHERE project_id='11111111-1111-4111-8111-111111111111' AND type='WIR' AND code IN ('A','B')), 1250000,10,'2026-10-28','submitted','مستخلص رقم 3';