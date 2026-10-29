CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('MIR','SUB','SD','WIR','OTHER')),
  ref_no text NOT NULL DEFAULT '',
  seq integer NOT NULL DEFAULT 0,
  parent_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  discipline text NOT NULL DEFAULT 'civil' CHECK (discipline IN ('civil','electrical','mechanical','architectural')),
  submitted_date date,
  reply_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','under_review','replied')),
  code text CHECK (code IN ('A','B','C','D')),
  consultant_notes text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.submissions(project_id, type);
CREATE INDEX ON public.submissions(parent_id);
CREATE UNIQUE INDEX submissions_ref_rev ON public.submissions(project_id, type, seq, revision);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cp_can_submit(_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_write(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id=_project AND m.user_id=auth.uid() AND m.access_role IN ('admin','project_manager','site_engineer','document_controller')));
$$;

CREATE OR REPLACE FUNCTION public.submissions_before_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE root public.submissions; pcode text; abbr text;
BEGIN
  NEW.created_by := auth.uid();
  NEW.created_by_name := COALESCE((SELECT display_name FROM public.profiles WHERE id = auth.uid()), '');
  IF NEW.parent_id IS NOT NULL THEN
    SELECT * INTO root FROM public.submissions WHERE id = NEW.parent_id;
    IF root.parent_id IS NOT NULL THEN SELECT * INTO root FROM public.submissions WHERE id = root.parent_id; END IF;
    PERFORM pg_advisory_xact_lock(hashtext(root.id::text));
    NEW.parent_id := root.id; NEW.project_id := root.project_id; NEW.type := root.type;
    NEW.seq := root.seq; NEW.ref_no := root.ref_no;
    NEW.revision := (SELECT COALESCE(MAX(revision),0)+1 FROM public.submissions WHERE id = root.id OR parent_id = root.id);
  ELSE
    PERFORM pg_advisory_xact_lock(hashtext(NEW.project_id::text || NEW.type));
    SELECT NULLIF(code,'') INTO pcode FROM public.projects WHERE id = NEW.project_id;
    abbr := CASE NEW.type WHEN 'MIR' THEN 'MIR' WHEN 'SUB' THEN 'SUB' WHEN 'SD' THEN 'SD' WHEN 'WIR' THEN 'WIR' ELSE 'OTH' END;
    NEW.seq := (SELECT COALESCE(MAX(seq),0)+1 FROM public.submissions WHERE project_id = NEW.project_id AND type = NEW.type);
    NEW.revision := 0;
    NEW.ref_no := COALESCE(pcode,'PRJ') || '-' || abbr || '-' || lpad(NEW.seq::text, 3, '0');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_submissions_before_insert BEFORE INSERT ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.submissions_before_insert();

CREATE OR REPLACE FUNCTION public.submissions_lock_keys() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.project_id := OLD.project_id; NEW.type := OLD.type; NEW.ref_no := OLD.ref_no; NEW.seq := OLD.seq;
  NEW.revision := OLD.revision; NEW.parent_id := OLD.parent_id; NEW.created_by := OLD.created_by; NEW.created_by_name := OLD.created_by_name;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_submissions_lock_keys BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.submissions_lock_keys();

CREATE POLICY "members read submissions" ON public.submissions FOR SELECT TO authenticated USING (public.cp_is_member(project_id));
CREATE POLICY "submitters create submissions" ON public.submissions FOR INSERT TO authenticated WITH CHECK (public.cp_can_submit(project_id));
CREATE POLICY "submitters update submissions" ON public.submissions FOR UPDATE TO authenticated USING (public.cp_can_submit(project_id)) WITH CHECK (public.cp_can_submit(project_id));
CREATE POLICY "managers delete submissions" ON public.submissions FOR DELETE TO authenticated USING (public.cp_can_manage(project_id));

CREATE POLICY "cp submission files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='contract-files' AND (storage.foldername(name))[2] = 'submissions' AND public.cp_can_submit(((storage.foldername(name))[1])::uuid));

INSERT INTO public.submissions (project_id,type,title,discipline,submitted_date,reply_date,status,code,consultant_notes) VALUES
('11111111-1111-4111-8111-111111111111','MIR','توريد حديد تسليح قطر 16 مم','civil','2026-10-05','2026-10-08','replied','A',''),
('11111111-1111-4111-8111-111111111111','SD','مخطط تسليح سقف الدور الأول','civil','2026-10-12','2026-10-18','replied','C','يرجى توضيح تفاصيل الوصلات'),
('11111111-1111-4111-8111-111111111111','SUB','اعتماد مورد الكابلات الكهربائية','electrical','2026-10-15',NULL,'under_review',NULL,''),
('11111111-1111-4111-8111-111111111111','WIR','استلام صب قواعد المحور A','civil','2026-10-26','2026-10-27','replied','B','معالجة التعشيش في القاعدة F3'),
('11111111-1111-4111-8111-111111111111','WIR','استلام تمديدات الصرف الدور الأرضي','mechanical','2026-10-27',NULL,'submitted',NULL,'');