CREATE TABLE public.employees (
  id text PRIMARY KEY,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  dept text NOT NULL DEFAULT '',
  project text NOT NULL DEFAULT '',
  base numeric NOT NULL DEFAULT 0,
  allowances numeric NOT NULL DEFAULT 0,
  deductions numeric NOT NULL DEFAULT 0,
  joined date,
  active boolean NOT NULL DEFAULT true,
  paid_months text[] NOT NULL DEFAULT '{}',
  device_user_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update employees" ON public.employees FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete employees" ON public.employees FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.attendance_devices (
  serial_number text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  approved boolean NOT NULL DEFAULT false,
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_devices TO authenticated;
GRANT ALL ON public.attendance_devices TO service_role;
ALTER TABLE public.attendance_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read devices" ON public.attendance_devices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert devices" ON public.attendance_devices FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update devices" ON public.attendance_devices FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete devices" ON public.attendance_devices FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_sn text NOT NULL,
  device_user_id text NOT NULL,
  punched_at timestamptz NOT NULL,
  status integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_sn, device_user_id, punched_at)
);
CREATE INDEX attendance_logs_punched_idx ON public.attendance_logs (punched_at);
GRANT SELECT ON public.attendance_logs TO authenticated;
GRANT ALL ON public.attendance_logs TO service_role;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in read logs" ON public.attendance_logs FOR SELECT TO authenticated USING (true);