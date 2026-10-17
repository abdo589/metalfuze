CREATE TABLE public.work_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 150,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_sites TO authenticated;
GRANT ALL ON public.work_sites TO service_role;
ALTER TABLE public.work_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read sites" ON public.work_sites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer'));
CREATE POLICY "Admins insert sites" ON public.work_sites FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update sites" ON public.work_sites FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete sites" ON public.work_sites FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.employees ADD COLUMN site_id uuid REFERENCES public.work_sites(id) ON DELETE SET NULL;
ALTER TABLE public.employees ADD COLUMN checkin_token text UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex');
UPDATE public.employees SET checkin_token = encode(gen_random_bytes(18), 'hex') WHERE checkin_token IS NULL;

ALTER TABLE public.attendance_logs ADD COLUMN source text NOT NULL DEFAULT 'device';
ALTER TABLE public.attendance_logs ADD COLUMN lat double precision;
ALTER TABLE public.attendance_logs ADD COLUMN lng double precision;
ALTER TABLE public.attendance_logs ADD COLUMN distance_m integer;
ALTER TABLE public.attendance_logs ADD COLUMN photo_path text;
ALTER TABLE public.attendance_logs ADD COLUMN site_name text;

CREATE POLICY "Staff read selfies" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'attendance-selfies' AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'viewer')));