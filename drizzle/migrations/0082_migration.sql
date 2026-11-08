-- Eilaf may edit pricing-request details on every sales deal; commission, payout and ownership stay with the owner.
CREATE POLICY "eilaf sales update all" ON public.sales_deals
  FOR UPDATE TO authenticated
  USING (public.verified_email() = 'eilaf@metalfuze.local')
  WITH CHECK (public.verified_email() = 'eilaf@metalfuze.local');

CREATE OR REPLACE FUNCTION public.sales_eilaf_edit_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF coalesce(current_setting('app.sales_wf', true), '') = '1' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR OLD.owner_id = auth.uid() OR public.verified_email() IS DISTINCT FROM 'eilaf@metalfuze.local' THEN
    RETURN NEW;
  END IF;
  NEW.owner_id := OLD.owner_id;
  NEW.created_at := OLD.created_at;
  NEW.commission_rate := OLD.commission_rate;
  NEW.payout_status := OLD.payout_status;
  NEW.contract_value := OLD.contract_value;
  NEW.collected := OLD.collected;
  NEW.my_share := OLD.my_share;
  NEW.shared := OLD.shared;
  NEW.partner_name := OLD.partner_name;
  NEW.stage := OLD.stage;
  NEW.quote_value := OLD.quote_value;
  IF OLD.request ? 'owner_emp' THEN
    NEW.request := jsonb_set(coalesce(NEW.request, '{}'::jsonb), '{owner_emp}', OLD.request->'owner_emp');
  ELSE
    NEW.request := coalesce(NEW.request, '{}'::jsonb) - 'owner_emp';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_sales_eilaf_edit_lock BEFORE UPDATE ON public.sales_deals
  FOR EACH ROW EXECUTE FUNCTION public.sales_eilaf_edit_lock();