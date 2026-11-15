ALTER TABLE public.sales_deals
  ADD COLUMN IF NOT EXISTS confirmed_contract_value numeric,
  ADD COLUMN IF NOT EXISTS confirmed_my_share numeric,
  ADD COLUMN IF NOT EXISTS confirmed_shared boolean,
  ADD COLUMN IF NOT EXISTS confirmed_commission_rate numeric,
  ADD COLUMN IF NOT EXISTS confirmed_owner_emp text,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid;

COMMENT ON COLUMN public.sales_deals.confirmed_contract_value IS 'HR-approved contract value; the only source for payroll/HR commission rows. Written only by sales_confirm_commission().';

-- Nobody writes the approved snapshot directly; only sales_confirm_commission() can.
CREATE OR REPLACE FUNCTION public.sales_commission_confirm_lock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.sales_commission_confirm', true), '') = '1' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.confirmed_contract_value := NULL; NEW.confirmed_my_share := NULL; NEW.confirmed_shared := NULL;
    NEW.confirmed_commission_rate := NULL; NEW.confirmed_owner_emp := NULL; NEW.confirmed_at := NULL; NEW.confirmed_by := NULL;
  ELSE
    NEW.confirmed_contract_value := OLD.confirmed_contract_value; NEW.confirmed_my_share := OLD.confirmed_my_share;
    NEW.confirmed_shared := OLD.confirmed_shared; NEW.confirmed_commission_rate := OLD.confirmed_commission_rate;
    NEW.confirmed_owner_emp := OLD.confirmed_owner_emp; NEW.confirmed_at := OLD.confirmed_at; NEW.confirmed_by := OLD.confirmed_by;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sales_commission_confirm_lock ON public.sales_deals;
CREATE TRIGGER sales_commission_confirm_lock BEFORE INSERT OR UPDATE ON public.sales_deals
FOR EACH ROW EXECUTE FUNCTION public.sales_commission_confirm_lock();

-- The approval update only touches the snapshot columns, so the salesperson guard must not rewrite other fields.
CREATE OR REPLACE FUNCTION public.sales_deals_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(current_setting('app.sales_commission_confirm', true), '') = '1' THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(),'admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.commission_rate := 2;
  NEW.my_share := LEAST(GREATEST(COALESCE(NEW.my_share,100),0),100);
  IF NEW.contract_value < 0 THEN NEW.contract_value := 0; END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.payout_status := OLD.payout_status;
    -- Once a deal is won (or payout started), commission inputs are frozen for non-admins.
    IF OLD.payout_status <> 'لم تُستحق' OR OLD.stage = 'فاز' THEN
      NEW.contract_value := OLD.contract_value;
      NEW.my_share := OLD.my_share;
      NEW.shared := OLD.shared;
      NEW.collected := OLD.collected;
      NEW.stage := OLD.stage;
    END IF;
  ELSE
    NEW.payout_status := 'لم تُستحق';
    NEW.collected := 0;
  END IF;
  RETURN NEW;
END $$;

-- HR approves the contract figures it has checked; approval fails if they changed meanwhile.
CREATE OR REPLACE FUNCTION public.sales_confirm_commission(p_id uuid, p_contract_value numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.sales_deals;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_hr(auth.uid()) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.sales_deals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'deal not found' USING ERRCODE = 'P0002'; END IF;
  IF d.owner_id = auth.uid() THEN RAISE EXCEPTION 'cannot approve own deal' USING ERRCODE = '42501'; END IF;
  IF coalesce(d.contract_value, 0) <= 0 THEN RAISE EXCEPTION 'no contract value' USING ERRCODE = '22023'; END IF;
  IF d.contract_value IS DISTINCT FROM p_contract_value THEN
    RAISE EXCEPTION 'contract value changed' USING ERRCODE = '40001';
  END IF;
  PERFORM set_config('app.sales_commission_confirm', '1', true);
  UPDATE public.sales_deals SET
    confirmed_contract_value = d.contract_value,
    confirmed_my_share = d.my_share,
    confirmed_shared = d.shared,
    confirmed_commission_rate = d.commission_rate,
    confirmed_owner_emp = nullif(d.request->>'owner_emp', ''),
    confirmed_at = now(),
    confirmed_by = auth.uid()
  WHERE id = p_id;
  PERFORM set_config('app.sales_commission_confirm', '', true);
END $$;
REVOKE ALL ON FUNCTION public.sales_confirm_commission(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sales_confirm_commission(uuid, numeric) TO authenticated;