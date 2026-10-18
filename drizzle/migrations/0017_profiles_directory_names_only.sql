DROP POLICY "Signed-in users read directory" ON public.profiles;
CREATE POLICY "Own profile or admins read" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.chat_directory()
RETURNS TABLE(id uuid, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.display_name FROM public.profiles p
  WHERE auth.uid() IS NOT NULL AND p.id <> auth.uid()
  ORDER BY p.display_name
$$;
REVOKE ALL ON FUNCTION public.chat_directory() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.chat_directory() TO authenticated;