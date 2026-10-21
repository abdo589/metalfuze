CREATE TABLE public.financial_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  kind text NOT NULL DEFAULT '',
  bond_no text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  creditor text NOT NULL DEFAULT '',
  debtor text NOT NULL DEFAULT '',
  purpose text NOT NULL DEFAULT '',
  issue_date date,
  return_condition text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'قائم',
  file_path text,
  file_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_guarantees TO authenticated;
GRANT ALL ON public.financial_guarantees TO service_role;
ALTER TABLE public.financial_guarantees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read guarantees" ON public.financial_guarantees FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.has_role(auth.uid(),'executive') OR public.has_role(auth.uid(),'accountant'));
CREATE POLICY "admins manage guarantees" ON public.financial_guarantees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'accountant'));