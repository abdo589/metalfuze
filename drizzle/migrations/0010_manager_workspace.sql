CREATE TABLE public.mgr_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  owner_name text NOT NULL DEFAULT '',
  name text NOT NULL,
  code text NOT NULL DEFAULT '',
  client text NOT NULL DEFAULT '',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'طبيعي',
  progress numeric NOT NULL DEFAULT 0,
  contract numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  issues text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.mgr_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.mgr_projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  kind text NOT NULL DEFAULT 'note',
  body text NOT NULL DEFAULT '',
  progress numeric,
  amount numeric,
  direction text,
  file_path text,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mgr_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mgr_reports TO authenticated;
GRANT ALL ON public.mgr_projects TO service_role;
GRANT ALL ON public.mgr_reports TO service_role;
ALTER TABLE public.mgr_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mgr_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own projects" ON public.mgr_projects FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Admins read manager projects" ON public.mgr_projects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner manages own reports" ON public.mgr_reports FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.mgr_projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));
CREATE POLICY "Admins read manager reports" ON public.mgr_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner reads own project files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'project-files' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Owner uploads own project files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owner deletes own project files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'project-files' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.handle_self_signup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(NEW.raw_user_meta_data->>'self_signup','') = 'true' THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'manager');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_self_signup AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_self_signup();