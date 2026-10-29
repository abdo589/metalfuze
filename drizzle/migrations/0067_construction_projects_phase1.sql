CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  client text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','active','on_hold','completed')),
  description text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_contracts (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  contract_no text NOT NULL DEFAULT '',
  value numeric NOT NULL DEFAULT 0,
  signed_date date,
  duration_days integer,
  consultant text NOT NULL DEFAULT '',
  pmo text NOT NULL DEFAULT '',
  contract_file text,
  specs_file text,
  tender_drawings_file text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid,
  access_role text NOT NULL DEFAULT 'viewer' CHECK (access_role IN ('admin','project_manager','site_engineer','document_controller','planner','accountant','viewer')),
  name text NOT NULL,
  job text NOT NULL,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  manager_id uuid REFERENCES public.project_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.project_members(project_id);
CREATE INDEX ON public.project_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects, public.project_contracts, public.project_members TO authenticated;
GRANT ALL ON public.projects, public.project_contracts, public.project_members TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cp_is_member(_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id=_project AND m.user_id=auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.cp_can_manage(_project uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.can_write(auth.uid()) AND (public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.project_members m WHERE m.project_id=_project AND m.user_id=auth.uid() AND m.access_role IN ('admin','project_manager')));
$$;

CREATE POLICY "members read projects" ON public.projects FOR SELECT TO authenticated USING (public.cp_is_member(id));
CREATE POLICY "admins create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') AND public.can_write(auth.uid()));
CREATE POLICY "managers update projects" ON public.projects FOR UPDATE TO authenticated USING (public.cp_can_manage(id)) WITH CHECK (public.cp_can_manage(id));
CREATE POLICY "admins delete projects" ON public.projects FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') AND public.can_write(auth.uid()));

CREATE POLICY "members read contracts" ON public.project_contracts FOR SELECT TO authenticated USING (public.cp_is_member(project_id));
CREATE POLICY "managers write contracts" ON public.project_contracts FOR ALL TO authenticated USING (public.cp_can_manage(project_id)) WITH CHECK (public.cp_can_manage(project_id));

CREATE POLICY "members read team" ON public.project_members FOR SELECT TO authenticated USING (public.cp_is_member(project_id));
CREATE POLICY "managers write team" ON public.project_members FOR ALL TO authenticated USING (public.cp_can_manage(project_id)) WITH CHECK (public.cp_can_manage(project_id));

CREATE POLICY "cp files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='contract-files' AND public.cp_is_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "cp files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='contract-files' AND public.cp_can_manage(((storage.foldername(name))[1])::uuid));
CREATE POLICY "cp files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='contract-files' AND public.cp_can_manage(((storage.foldername(name))[1])::uuid));

INSERT INTO public.projects (id,name,code,client,location,start_date,end_date,status,description) VALUES
('11111111-1111-4111-8111-111111111111','مبنى إداري - حي الملقا','MF-DEMO-001','شركة الأفق العقارية','الرياض - حي الملقا','2026-03-01','2027-06-30','active','مشروع تجريبي: إنشاء مبنى إداري من 6 أدوار مع موقف سيارات سفلي.');
INSERT INTO public.project_contracts (project_id,contract_no,value,signed_date,duration_days,consultant,pmo) VALUES
('11111111-1111-4111-8111-111111111111','C-2026-014',18500000,'2026-02-15',480,'دار الهندسة','مكتب نماء لإدارة المشاريع');
INSERT INTO public.project_members (id,project_id,access_role,name,job,phone,email,manager_id) VALUES
('22222222-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','project_manager','م. خالد العتيبي','مدير مشروع','0501111111','khaled@example.com',NULL),
('22222222-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','site_engineer','م. أحمد سمير','مهندس موقع','0502222222','ahmed@example.com','22222222-0000-4000-8000-000000000001'),
('22222222-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','viewer','فهد القحطاني','مدير سلامة','0503333333','fahad@example.com','22222222-0000-4000-8000-000000000001'),
('22222222-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','document_controller','سارة محمد','مراقب وثائق','0504444444','sara@example.com','22222222-0000-4000-8000-000000000001'),
('22222222-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','viewer','محمود علي','مشرف','0505555555','','22222222-0000-4000-8000-000000000002'),
('22222222-0000-4000-8000-000000000006','11111111-1111-4111-8111-111111111111','viewer','ياسر حسن','كهرباء','0506666666','','22222222-0000-4000-8000-000000000005'),
('22222222-0000-4000-8000-000000000007','11111111-1111-4111-8111-111111111111','viewer','عمر صالح','ميكانيكا','0507777777','','22222222-0000-4000-8000-000000000005'),
('22222222-0000-4000-8000-000000000008','11111111-1111-4111-8111-111111111111','viewer','نايف الدوسري','مسؤول سلامة','0508888888','','22222222-0000-4000-8000-000000000003');