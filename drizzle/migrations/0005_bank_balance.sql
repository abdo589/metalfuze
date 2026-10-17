CREATE TABLE public.bank_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id text NOT NULL,
  entity_id text,
  bank_name text NOT NULL DEFAULT 'Riyad Bank',
  status text NOT NULL DEFAULT 'pending',
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_connections TO authenticated;
GRANT ALL ON public.bank_connections TO service_role;
ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read bank connections" ON public.bank_connections FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'viewer'));

CREATE TABLE public.bank_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.bank_connections(id) ON DELETE CASCADE,
  account_name text NOT NULL DEFAULT '',
  balance numeric NOT NULL DEFAULT 0,
  available numeric,
  currency text NOT NULL DEFAULT 'SAR',
  transactions jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bank_snapshots TO authenticated;
GRANT ALL ON public.bank_snapshots TO service_role;
ALTER TABLE public.bank_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read bank snapshots" ON public.bank_snapshots FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'viewer'));