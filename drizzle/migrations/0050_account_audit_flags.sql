CREATE TABLE public.account_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_name text NOT NULL DEFAULT '',
  target_id uuid,
  target_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_audit TO authenticated;
GRANT ALL ON public.account_audit TO service_role;
ALTER TABLE public.account_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "developer reads audit" ON public.account_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'developer'));

CREATE TABLE public.account_flags (
  user_id uuid PRIMARY KEY,
  force_logout_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_flags TO authenticated;
GRANT ALL ON public.account_flags TO service_role;
ALTER TABLE public.account_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own flag or developer" ON public.account_flags FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'developer'));