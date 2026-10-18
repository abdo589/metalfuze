CREATE TABLE public.hr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hr_records TO authenticated;
GRANT ALL ON public.hr_records TO service_role;
ALTER TABLE public.hr_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read hr records" ON public.hr_records FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'viewer') OR is_hr(auth.uid()));
CREATE POLICY "Admins and HR write hr records" ON public.hr_records FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR is_hr(auth.uid()))
  WITH CHECK (has_role(auth.uid(),'admin') OR is_hr(auth.uid()));