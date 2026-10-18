CREATE TABLE public.late_excuses (
  id uuid primary key default gen_random_uuid(),
  employee_id text not null,
  excuse_date date not null,
  reason text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (employee_id, excuse_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.late_excuses TO authenticated;
GRANT ALL ON public.late_excuses TO service_role;

ALTER TABLE public.late_excuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read late excuses"
ON public.late_excuses
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'viewer'::app_role) OR is_hr(auth.uid()));

CREATE POLICY "Admins and HR manage late excuses"
ON public.late_excuses
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR is_hr(auth.uid()))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR is_hr(auth.uid()));