ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
CREATE TABLE public.acct_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  rows jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.acct_sheets TO authenticated;
GRANT ALL ON public.acct_sheets TO service_role;
ALTER TABLE public.acct_sheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner only" ON public.acct_sheets FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());