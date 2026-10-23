CREATE TABLE public.login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  event text NOT NULL CHECK (event IN ('login','logout')),
  ip text NOT NULL DEFAULT '',
  country text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  device text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX login_events_created_idx ON public.login_events (created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insert" ON public.login_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "developer reads" ON public.login_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "developer deletes" ON public.login_events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'developer'));