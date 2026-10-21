CREATE TABLE public.fleet_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  car_type text NOT NULL DEFAULT '',
  model_year text NOT NULL DEFAULT '',
  employee_no text NOT NULL DEFAULT '',
  employee_name text NOT NULL DEFAULT '',
  handover_date date,
  return_date date,
  status text NOT NULL DEFAULT 'مسلمة للموظف',
  registration_expiry date,
  insurance_company text NOT NULL DEFAULT '',
  insurance_expiry date,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fleet_cars TO authenticated;
GRANT ALL ON public.fleet_cars TO service_role;
ALTER TABLE public.fleet_cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read cars" ON public.fleet_cars FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'viewer'));
CREATE POLICY "hr admin write cars" ON public.fleet_cars FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE TABLE public.traffic_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  violation_no text NOT NULL DEFAULT '',
  violation_type text NOT NULL DEFAULT '',
  plate text NOT NULL DEFAULT '',
  employee_no text NOT NULL DEFAULT '',
  employee_name text NOT NULL DEFAULT '',
  violation_date date,
  violation_time text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'جديدة',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.traffic_violations TO authenticated;
GRANT ALL ON public.traffic_violations TO service_role;
ALTER TABLE public.traffic_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read violations" ON public.traffic_violations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'viewer'));
CREATE POLICY "hr admin write violations" ON public.traffic_violations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));