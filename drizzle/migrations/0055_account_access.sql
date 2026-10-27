CREATE TABLE public.account_access (
  user_id uuid PRIMARY KEY,
  blocked_paths text[] NOT NULL DEFAULT '{}',
  read_only boolean NOT NULL DEFAULT false,
  days int[] NOT NULL DEFAULT '{}',
  start_time text NOT NULL DEFAULT '',
  end_time text NOT NULL DEFAULT '',
  allowed_ips text[] NOT NULL DEFAULT '{}',
  devices text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_access TO authenticated;
GRANT ALL ON public.account_access TO service_role;
ALTER TABLE public.account_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or developer read" ON public.account_access FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'developer'));
CREATE POLICY "developer insert" ON public.account_access FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "developer update" ON public.account_access FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'developer')) WITH CHECK (public.has_role(auth.uid(), 'developer'));
CREATE POLICY "developer delete" ON public.account_access FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'developer'));
CREATE TRIGGER trg_activity_account_access AFTER INSERT OR UPDATE OR DELETE ON public.account_access
  FOR EACH ROW EXECUTE FUNCTION public.log_activity();