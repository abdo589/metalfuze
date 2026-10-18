ALTER TABLE public.employees ADD COLUMN email text;
CREATE UNIQUE INDEX employees_email_lower_idx ON public.employees (lower(email)) WHERE email IS NOT NULL AND email <> '';
ALTER TABLE public.profiles ADD COLUMN employee_id text REFERENCES public.employees(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.handle_new_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp public.employees;
BEGIN
  SELECT * INTO emp FROM public.employees WHERE email IS NOT NULL AND lower(email) = lower(coalesce(NEW.email,'')) LIMIT 1;
  INSERT INTO public.profiles(id, display_name, email, employee_id)
  VALUES (NEW.id, coalesce(emp.name, nullif(NEW.raw_user_meta_data->>'display_name',''), nullif(NEW.raw_user_meta_data->>'full_name',''), split_part(coalesce(NEW.email,''),'@',1)), coalesce(NEW.email,''), emp.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.link_employee_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET employee_id = NULL WHERE employee_id = NEW.id AND (NEW.email IS NULL OR lower(email) <> lower(NEW.email));
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    UPDATE public.profiles SET employee_id = NEW.id, display_name = NEW.name WHERE lower(email) = lower(NEW.email);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER employees_link_profile AFTER INSERT OR UPDATE OF email, name ON public.employees FOR EACH ROW EXECUTE FUNCTION public.link_employee_profile();