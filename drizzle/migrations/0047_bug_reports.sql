CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid,
  reporter_name text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'user',
  page text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  dev_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bug_kind CHECK (kind IN ('user','auto')),
  CONSTRAINT bug_status CHECK (status IN ('open','in_progress','fixed')),
  CONSTRAINT bug_len CHECK (length(description) <= 10000 AND length(page) <= 500)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone signed in reports own bugs" ON public.bug_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status = 'open' AND dev_note = '');
CREATE POLICY "Reporters see own bugs" ON public.bug_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Developer updates bugs" ON public.bug_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'developer')) WITH CHECK (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "Developer deletes bugs" ON public.bug_reports FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));
CREATE INDEX bug_reports_created ON public.bug_reports (created_at DESC);