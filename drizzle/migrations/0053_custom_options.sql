CREATE TABLE public.custom_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_name text NOT NULL,
  value text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_name, value)
);
GRANT SELECT, INSERT, DELETE ON public.custom_options TO authenticated;
GRANT ALL ON public.custom_options TO service_role;
ALTER TABLE public.custom_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "signed in read options" ON public.custom_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "signed in add options" ON public.custom_options FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());
CREATE POLICY "owner removes own option" ON public.custom_options FOR DELETE TO authenticated USING (created_by = auth.uid());
CREATE TRIGGER trg_activity_custom_options AFTER INSERT OR UPDATE OR DELETE ON public.custom_options FOR EACH ROW EXECUTE FUNCTION public.log_activity();