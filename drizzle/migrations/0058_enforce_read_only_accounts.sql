CREATE OR REPLACE FUNCTION public.can_write(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _uid IS NULL OR NOT COALESCE((SELECT read_only FROM public.account_access WHERE user_id = _uid), false);
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
      AND c.relname NOT IN ('account_access','account_flags','account_audit','activity_log','login_events','bug_reports','direct_messages','app_user_connections','attendance_logs','location_pings')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS ro_block_ins ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ro_block_upd ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ro_block_del ON public.%I', t);
    EXECUTE format('CREATE POLICY ro_block_ins ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()))', t);
    EXECUTE format('CREATE POLICY ro_block_upd ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_write(auth.uid()))', t);
    EXECUTE format('CREATE POLICY ro_block_del ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.can_write(auth.uid()))', t);
  END LOOP;
END $$;