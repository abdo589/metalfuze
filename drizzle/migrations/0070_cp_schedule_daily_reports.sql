CREATE OR REPLACE FUNCTION public.cp_can_plan(_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_write(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id=_project AND m.user_id=auth.uid() AND m.access_role IN ('admin','project_manager','planner')));
$$;
CREATE OR REPLACE FUNCTION public.cp_can_daily(_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.can_write(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id=_project AND m.user_id=auth.uid() AND m.access_role IN ('admin','project_manager','site_engineer')));
$$;

CREATE TABLE public.schedule_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  progress numeric NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  owner text NOT NULL DEFAULT '',
  depends_on uuid REFERENCES public.schedule_activities(id) ON DELETE SET NULL,
  sort integer NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (depends_on IS NULL OR depends_on <> id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_activities TO authenticated;
GRANT ALL ON public.schedule_activities TO service_role;
ALTER TABLE public.schedule_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sa read" ON public.schedule_activities FOR SELECT TO authenticated USING (public.cp_is_member(project_id));
CREATE POLICY "sa insert" ON public.schedule_activities FOR INSERT TO authenticated WITH CHECK (public.cp_can_plan(project_id));
CREATE POLICY "sa update" ON public.schedule_activities FOR UPDATE TO authenticated USING (public.cp_can_plan(project_id)) WITH CHECK (public.cp_can_plan(project_id));
CREATE POLICY "sa delete" ON public.schedule_activities FOR DELETE TO authenticated USING (public.cp_can_plan(project_id));

CREATE TABLE public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_date date NOT NULL DEFAULT current_date,
  weather text NOT NULL DEFAULT '',
  manpower jsonb NOT NULL DEFAULT '{}'::jsonb,
  work_done text NOT NULL DEFAULT '',
  issues text NOT NULL DEFAULT '',
  photos jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid DEFAULT auth.uid(),
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, report_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT ALL ON public.daily_reports TO service_role;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dr read" ON public.daily_reports FOR SELECT TO authenticated USING (public.cp_is_member(project_id));
CREATE POLICY "dr insert" ON public.daily_reports FOR INSERT TO authenticated WITH CHECK (public.cp_can_daily(project_id));
CREATE POLICY "dr update" ON public.daily_reports FOR UPDATE TO authenticated USING (public.cp_can_daily(project_id)) WITH CHECK (public.cp_can_daily(project_id));
CREATE POLICY "dr delete" ON public.daily_reports FOR DELETE TO authenticated USING (public.cp_can_manage(project_id));

CREATE OR REPLACE FUNCTION public.daily_reports_stamp() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_by_name := COALESCE((SELECT display_name FROM public.profiles WHERE id = auth.uid()), '');
  ELSE
    NEW.created_by := OLD.created_by; NEW.created_by_name := OLD.created_by_name; NEW.project_id := OLD.project_id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_daily_reports_stamp BEFORE INSERT OR UPDATE ON public.daily_reports FOR EACH ROW EXECUTE FUNCTION public.daily_reports_stamp();

CREATE POLICY "cp daily photos insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contract-files' AND (storage.foldername(name))[2] = 'daily' AND public.cp_can_daily(((storage.foldername(name))[1])::uuid));

INSERT INTO public.schedule_activities (id, project_id, name, start_date, end_date, progress, owner, depends_on, sort) VALUES
('22222222-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','أعمال الحفر','2026-09-01','2026-09-20',100,'مهندس الموقع',NULL,1),
('22222222-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','القواعد والخرسانة العادية','2026-09-21','2026-10-15',80,'مهندس الموقع','22222222-0000-4000-8000-000000000001',2),
('22222222-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','الهيكل الخرساني - الدور الأرضي','2026-10-16','2026-11-30',20,'مدير المشروع','22222222-0000-4000-8000-000000000002',3),
('22222222-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','تمديدات الكهرباء الأولية','2026-11-01','2026-12-15',0,'مهندس الكهرباء','22222222-0000-4000-8000-000000000003',4),
('22222222-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','تمديدات الميكانيكا','2026-11-15','2026-12-31',0,'مهندس الميكانيكا','22222222-0000-4000-8000-000000000003',5);
INSERT INTO public.daily_reports (project_id, report_date, weather, manpower, work_done, issues, created_by_name) VALUES
('11111111-1111-4111-8111-111111111111','2026-10-26','مشمس','{"مدني":18,"كهرباء":4,"ميكانيكا":2}','صب خرسانة قواعد المحور A','تأخر وصول حديد التسليح ساعتين','مهندس الموقع'),
('11111111-1111-4111-8111-111111111111','2026-10-27','مغبر','{"مدني":20,"كهرباء":4}','تركيب شدات أعمدة الدور الأرضي','','مهندس الموقع'),
('11111111-1111-4111-8111-111111111111','2026-10-28','مشمس','{"مدني":22,"كهرباء":5,"ميكانيكا":3}','تسليح أعمدة الدور الأرضي','عاصفة ترابية خفيفة بعد العصر','مهندس الموقع');