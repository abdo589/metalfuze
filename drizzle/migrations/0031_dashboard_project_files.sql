CREATE TABLE public.project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  category text NOT NULL,
  title text NOT NULL DEFAULT '',
  file_path text NOT NULL,
  file_name text NOT NULL,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_files_project_idx ON public.project_files(project_id);
GRANT SELECT, INSERT, DELETE ON public.project_files TO authenticated;
GRANT ALL ON public.project_files TO service_role;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read project files" ON public.project_files FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'executive'));
CREATE POLICY "admins add project files" ON public.project_files FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete project files" ON public.project_files FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "read dashboard project objects" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'dashboard-project-files' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'executive')));
CREATE POLICY "admins upload dashboard project objects" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'dashboard-project-files' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete dashboard project objects" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'dashboard-project-files' AND public.has_role(auth.uid(),'admin'));