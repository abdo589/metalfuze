CREATE OR REPLACE FUNCTION public.sales_deals_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(),'admin') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.commission_rate := 2;
  NEW.my_share := LEAST(GREATEST(COALESCE(NEW.my_share,100),0),100);
  IF NEW.contract_value < 0 THEN NEW.contract_value := 0; END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.payout_status := OLD.payout_status;
    IF OLD.payout_status <> 'لم تُستحق' THEN
      NEW.contract_value := OLD.contract_value;
      NEW.my_share := OLD.my_share;
      NEW.shared := OLD.shared;
    END IF;
  ELSE
    NEW.payout_status := 'لم تُستحق';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sales_deals_guard ON public.sales_deals;
CREATE TRIGGER trg_sales_deals_guard BEFORE INSERT OR UPDATE ON public.sales_deals
FOR EACH ROW EXECUTE FUNCTION public.sales_deals_guard();