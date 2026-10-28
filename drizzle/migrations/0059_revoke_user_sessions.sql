CREATE OR REPLACE FUNCTION public.revoke_user_sessions(_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
BEGIN
  DELETE FROM auth.refresh_tokens WHERE user_id = _uid::text;
  DELETE FROM auth.sessions WHERE user_id = _uid;
END $$;
REVOKE ALL ON FUNCTION public.revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_user_sessions(uuid) TO service_role;