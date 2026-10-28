CREATE OR REPLACE FUNCTION public.assert_writable() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.can_write(auth.uid()) THEN
    RAISE EXCEPTION 'READ_ONLY' USING ERRCODE = '42501';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.assert_writable() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_writable() TO authenticated, service_role;

DO $do$
DECLARE f text; def text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.leave_create(text,text,date,date,text,text,text,boolean,date)',
    'public.leave_transition(uuid,text,text,text)',
    'public.leave_adjust(text,numeric,text,text)',
    'public.sales_advance(uuid,text,text,numeric,text,text)'
  ] LOOP
    def := pg_get_functiondef(f::regprocedure);
    IF position('assert_writable' in def) > 0 THEN CONTINUE; END IF;
    def := regexp_replace(def, '\nBEGIN\n', E'\nBEGIN\n  PERFORM public.assert_writable();\n');
    IF position('PERFORM public.assert_writable();' in def) = 0 THEN
      RAISE EXCEPTION 'read-only patch failed for %', f;
    END IF;
    EXECUTE def;
  END LOOP;
END $do$;

DROP POLICY IF EXISTS ro_block_storage_ins ON storage.objects;
DROP POLICY IF EXISTS ro_block_storage_upd ON storage.objects;
DROP POLICY IF EXISTS ro_block_storage_del ON storage.objects;
CREATE POLICY ro_block_storage_ins ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()));
CREATE POLICY ro_block_storage_upd ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_write(auth.uid()));
CREATE POLICY ro_block_storage_del ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (public.can_write(auth.uid()));

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND c.relname NOT IN ('account_access','account_flags','account_audit','activity_log','login_events','bug_reports','direct_messages','app_user_connections','attendance_logs','location_pings')
      AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname AND p.policyname = 'ro_block_ins')
  LOOP
    EXECUTE format('CREATE POLICY ro_block_ins ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.can_write(auth.uid()))', t);
    EXECUTE format('CREATE POLICY ro_block_upd ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.can_write(auth.uid()))', t);
    EXECUTE format('CREATE POLICY ro_block_del ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (public.can_write(auth.uid()))', t);
  END LOOP;
END $$;