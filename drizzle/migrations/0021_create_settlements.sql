CREATE TABLE public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  employee_name text NOT NULL,
  reason text NOT NULL,
  last_day date NOT NULL,
  joined date,
  wage numeric NOT NULL DEFAULT 0,
  eos numeric NOT NULL DEFAULT 0,
  leave_days numeric NOT NULL DEFAULT 0,
  leave_pay numeric NOT NULL DEFAULT 0,
  other_dues numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  net numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  notes text NOT NULL DEFAULT '',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT ALL ON public.settlements TO service_role;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read settlements" ON public.settlements FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'viewer'));
CREATE POLICY "hr writes settlements" ON public.settlements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'hr'));