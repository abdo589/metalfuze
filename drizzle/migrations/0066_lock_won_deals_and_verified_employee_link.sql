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

-- Only link a new account to an employee record when the email address is confirmed.
CREATE OR REPLACE FUNCTION public.handle_new_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp public.employees;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL THEN
    SELECT * INTO emp FROM public.employees WHERE email IS NOT NULL AND lower(email) = lower(coalesce(NEW.email,'')) LIMIT 1;
  END IF;
  INSERT INTO public.profiles(id, display_name, email, employee_id)
  VALUES (NEW.id, coalesce(emp.name, nullif(NEW.raw_user_meta_data->>'display_name',''), nullif(NEW.raw_user_meta_data->>'full_name',''), split_part(coalesce(NEW.email,''),'@',1)), coalesce(NEW.email,''), emp.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.link_employee_on_confirm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_id uuid;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    SELECT id INTO emp_id FROM public.employees WHERE email IS NOT NULL AND lower(email) = lower(coalesce(NEW.email,'')) LIMIT 1;
    IF emp_id IS NOT NULL THEN
      UPDATE public.profiles SET employee_id = emp_id WHERE id = NEW.id AND employee_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_confirmed_link ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_link AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW EXECUTE FUNCTION public.link_employee_on_confirm();

CREATE OR REPLACE FUNCTION public.link_employee_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET employee_id = NULL WHERE employee_id = NEW.id AND (NEW.email IS NULL OR lower(email) <> lower(NEW.email));
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    UPDATE public.profiles p SET employee_id = NEW.id, display_name = NEW.name
    WHERE lower(p.email) = lower(NEW.email)
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id AND u.email_confirmed_at IS NOT NULL);
  END IF;
  RETURN NEW;
END $$;