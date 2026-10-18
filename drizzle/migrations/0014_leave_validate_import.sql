CREATE OR REPLACE FUNCTION public.leave_requests_validate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t public.leave_types;
BEGIN
  IF NEW.end_date < NEW.start_date THEN RAISE EXCEPTION 'LEAVE_DATES'; END IF;
  SELECT * INTO t FROM public.leave_types WHERE id = NEW.type_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'LEAVE_TYPE'; END IF;
  NEW.working_days := public.leave_working_days(NEW.start_date, NEW.end_date, t.calendar_days);
  IF NEW.working_days <= 0 AND NEW.via <> 'import' THEN RAISE EXCEPTION 'LEAVE_NO_WORKDAYS'; END IF;
  IF NEW.return_date IS NULL THEN NEW.return_date := public.leave_next_workday(NEW.end_date); END IF;
  IF NEW.status NOT IN ('rejected','cancelled') THEN
    IF EXISTS (SELECT 1 FROM public.leave_requests r WHERE r.employee_id = NEW.employee_id AND r.id <> NEW.id
               AND r.status NOT IN ('rejected','cancelled') AND r.start_date <= NEW.end_date AND r.end_date >= NEW.start_date) THEN
      RAISE EXCEPTION 'LEAVE_OVERLAP';
    END IF;
    IF NEW.status <> 'draft' AND t.requires_attachment AND NEW.attachment_path IS NULL AND NEW.via <> 'import' THEN
      RAISE EXCEPTION 'LEAVE_ATTACHMENT';
    END IF;
    IF t.max_days IS NOT NULL AND NEW.working_days > t.max_days AND NEW.via <> 'import' THEN
      RAISE EXCEPTION 'LEAVE_MAX_DAYS';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;