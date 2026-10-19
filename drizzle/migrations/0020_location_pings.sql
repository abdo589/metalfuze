CREATE TABLE public.location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy_m integer,
  distance_m integer,
  pinged_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX location_pings_emp_time ON public.location_pings(employee_id, pinged_at DESC);
GRANT SELECT ON public.location_pings TO authenticated;
GRANT ALL ON public.location_pings TO service_role;
ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read pings" ON public.location_pings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'viewer') OR public.is_hr(auth.uid()));
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_logs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.location_pings; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;