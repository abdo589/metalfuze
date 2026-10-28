CREATE TABLE public.sales_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES public.sales_deals(id) ON DELETE CASCADE,
  meeting_at timestamptz NOT NULL,
  place text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  attendees text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_meetings TO authenticated;
GRANT ALL ON public.sales_meetings TO service_role;
ALTER TABLE public.sales_meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read meetings" ON public.sales_meetings FOR SELECT TO authenticated USING (true);
CREATE POLICY "add meetings" ON public.sales_meetings FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.can_write(auth.uid()));
CREATE POLICY "own meetings update" ON public.sales_meetings FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY "own meetings delete" ON public.sales_meetings FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));