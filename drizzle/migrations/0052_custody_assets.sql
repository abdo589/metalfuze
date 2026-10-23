CREATE TABLE public.custody_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  serial_no text NOT NULL DEFAULT '',
  asset_no text NOT NULL DEFAULT '',
  specs text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'متاح',
  employee_no text NOT NULL DEFAULT '',
  employee_name text NOT NULL DEFAULT '',
  dept text NOT NULL DEFAULT '',
  handover_date date,
  confirmed boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custody_assets TO authenticated;
GRANT ALL ON public.custody_assets TO service_role;
ALTER TABLE public.custody_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read custody" ON public.custody_assets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "hr admin write custody" ON public.custody_assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE TABLE public.custody_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.custody_assets(id) ON DELETE CASCADE,
  action text NOT NULL,
  employee_name text NOT NULL DEFAULT '',
  employee_no text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  move_date date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custody_moves TO authenticated;
GRANT ALL ON public.custody_moves TO service_role;
ALTER TABLE public.custody_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read moves" ON public.custody_moves FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));
CREATE POLICY "hr admin write moves" ON public.custody_moves FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr'));

CREATE TRIGGER trg_activity_custody_assets AFTER INSERT OR UPDATE OR DELETE ON public.custody_assets FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE TRIGGER trg_activity_custody_moves AFTER INSERT OR UPDATE OR DELETE ON public.custody_moves FOR EACH ROW EXECUTE FUNCTION public.log_activity();