CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read directory" ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.handle_new_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles(id, display_name, email)
  VALUES (NEW.id, coalesce(nullif(NEW.raw_user_meta_data->>'display_name',''), nullif(NEW.raw_user_meta_data->>'full_name',''), split_part(coalesce(NEW.email,''),'@',1)), coalesce(NEW.email,''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_profile AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

INSERT INTO public.profiles(id, display_name, email)
SELECT id, coalesce(nullif(raw_user_meta_data->>'display_name',''), nullif(raw_user_meta_data->>'full_name',''), split_part(coalesce(email,''),'@',1)), coalesce(email,'')
FROM auth.users ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  recipient_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX direct_messages_pair_idx ON public.direct_messages (sender_id, recipient_id, created_at);
CREATE INDEX direct_messages_recipient_idx ON public.direct_messages (recipient_id, read_at);
GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants read" ON public.direct_messages FOR SELECT TO authenticated USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Send as self" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND recipient_id <> sender_id);
CREATE POLICY "Recipient marks read" ON public.direct_messages FOR UPDATE TO authenticated USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.dm_lock_fields() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.body := OLD.body; NEW.sender_id := OLD.sender_id; NEW.recipient_id := OLD.recipient_id; NEW.created_at := OLD.created_at;
  RETURN NEW;
END $$;
CREATE TRIGGER dm_lock_fields BEFORE UPDATE ON public.direct_messages FOR EACH ROW EXECUTE FUNCTION public.dm_lock_fields();

ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;