CREATE OR REPLACE FUNCTION public.verified_email() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT lower(email) FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.verified_email() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.verified_email() TO authenticated;

DROP POLICY IF EXISTS "admins ceo executives read summary" ON public.exec_snapshot;
CREATE POLICY "admins ceo executives read summary" ON public.exec_snapshot FOR SELECT TO authenticated
  USING (public.verified_email() = 'ceo@metalfuze.local' OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role::text = ANY (ARRAY['admin','executive'])));
DROP POLICY IF EXISTS "ceo updates summary" ON public.exec_snapshot;
CREATE POLICY "ceo updates summary" ON public.exec_snapshot FOR UPDATE TO authenticated
  USING (public.verified_email() = 'ceo@metalfuze.local') WITH CHECK (public.verified_email() = 'ceo@metalfuze.local');
DROP POLICY IF EXISTS "ceo writes summary" ON public.exec_snapshot;
CREATE POLICY "ceo writes summary" ON public.exec_snapshot FOR INSERT TO authenticated
  WITH CHECK (public.verified_email() = 'ceo@metalfuze.local');

DROP POLICY IF EXISTS "sales wf files insert" ON storage.objects;
CREATE POLICY "sales wf files insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sales-files' AND public.verified_email() IN ('eilaf@metalfuze.local','haitham@metalfuze.local') AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "sales wf files delete" ON storage.objects;
CREATE POLICY "sales wf files delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sales-files' AND public.verified_email() IN ('eilaf@metalfuze.local','haitham@metalfuze.local') AND (storage.foldername(name))[1] = auth.uid()::text);

DO $do$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef('public.sales_advance(uuid,text,text,numeric,text,text)'::regprocedure) INTO def;
  def := replace(def, 'SELECT email, display_name INTO me, actor FROM public.profiles WHERE id = auth.uid();',
    'SELECT display_name INTO actor FROM public.profiles WHERE id = auth.uid(); me := public.verified_email();');
  IF position('me := public.verified_email()' in def) = 0 THEN RAISE EXCEPTION 'sales_advance patch failed'; END IF;
  EXECUTE def;
END $do$;