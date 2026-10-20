CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2020 AND 2100),
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  review_date date,
  reviewer_name text NOT NULL DEFAULT '',
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  total numeric NOT NULL DEFAULT 0 CHECK (total BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','approved')),
  manager_notes text NOT NULL DEFAULT '',
  development_plan text NOT NULL DEFAULT '',
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, year, quarter)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.performance_reviews TO authenticated;
GRANT ALL ON public.performance_reviews TO service_role;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read reviews" ON public.performance_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'viewer'));
CREATE POLICY "hr writes reviews" ON public.performance_reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'hr')) WITH CHECK (public.has_role(auth.uid(),'hr'));