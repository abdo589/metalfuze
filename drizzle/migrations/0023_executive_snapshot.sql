ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'executive';
CREATE TABLE public.exec_snapshot (
  key text PRIMARY KEY,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.exec_snapshot TO authenticated;
GRANT ALL ON public.exec_snapshot TO service_role;
ALTER TABLE public.exec_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins and executives read summary" ON public.exec_snapshot FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text IN ('admin','executive')));
CREATE POLICY "admins write summary" ON public.exec_snapshot FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'admin'));
CREATE POLICY "admins update summary" ON public.exec_snapshot FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = 'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.exec_snapshot;