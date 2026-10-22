CREATE TABLE public.sales_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  client text NOT NULL DEFAULT '',
  project text NOT NULL DEFAULT '',
  client_type text NOT NULL DEFAULT 'جديد',
  shared boolean NOT NULL DEFAULT false,
  partner_name text NOT NULL DEFAULT '',
  my_share numeric NOT NULL DEFAULT 100,
  quote_value numeric NOT NULL DEFAULT 0,
  contract_value numeric NOT NULL DEFAULT 0,
  collected numeric NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL DEFAULT 2,
  payout_status text NOT NULL DEFAULT 'لم تُستحق',
  stage text NOT NULL DEFAULT 'تسعير',
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_deals TO authenticated;
GRANT ALL ON public.sales_deals TO service_role;
ALTER TABLE public.sales_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sales read" ON public.sales_deals FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'sales') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'viewer'));
CREATE POLICY "sales insert" ON public.sales_deals FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'sales') AND owner_id = auth.uid());
CREATE POLICY "sales update" ON public.sales_deals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'sales') AND owner_id = auth.uid());
CREATE POLICY "sales delete" ON public.sales_deals FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'sales') AND owner_id = auth.uid());