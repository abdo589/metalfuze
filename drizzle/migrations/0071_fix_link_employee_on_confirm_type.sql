-- Bug fix: link_employee_on_confirm() declared emp_id uuid, but public.employees.id is text
-- (employee numbers like "1"/"12", payroll-generated ids like "e7x2k..."). Selecting a text id
-- into a uuid variable raised "invalid input syntax for type uuid" inside the trigger on
-- auth.users, aborting the email confirmation update so self-signup accounts never activated.
-- profiles.employee_id is text, so the variable must be text.
CREATE OR REPLACE FUNCTION public.link_employee_on_confirm() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_id text;
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    SELECT id INTO emp_id FROM public.employees WHERE email IS NOT NULL AND lower(email) = lower(coalesce(NEW.email,'')) LIMIT 1;
    IF emp_id IS NOT NULL THEN
      UPDATE public.profiles SET employee_id = emp_id WHERE id = NEW.id AND employee_id IS NULL;
    END IF;
  END IF;
  RETURN NEW;
END $$;
