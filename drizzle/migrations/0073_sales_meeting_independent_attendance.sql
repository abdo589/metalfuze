ALTER TABLE public.sales_meetings ADD COLUMN topic text NOT NULL DEFAULT '', ADD COLUMN client_name text NOT NULL DEFAULT '', ADD COLUMN project_name text NOT NULL DEFAULT '';
UPDATE public.sales_meetings m SET client_name=d.client, project_name=d.project FROM public.sales_deals d WHERE d.id=m.deal_id;
CREATE TABLE public.sales_meeting_responses (
 meeting_id uuid NOT NULL REFERENCES public.sales_meetings(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES public.profiles(id),
 attendee_email text NOT NULL,
 response text NOT NULL CHECK (response IN ('accepted','declined')),
 note text NOT NULL DEFAULT '', responded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (meeting_id,user_id)
);
GRANT SELECT ON public.sales_meeting_responses TO authenticated;
GRANT ALL ON public.sales_meeting_responses TO service_role;
ALTER TABLE public.sales_meeting_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read meeting responses" ON public.sales_meeting_responses FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.sales_meetings m WHERE m.id=meeting_id));
CREATE OR REPLACE FUNCTION public.sales_meeting_prepare() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.created_by:=auth.uid();
  IF NOT EXISTS (SELECT 1 FROM public.sales_deals d WHERE d.id=NEW.deal_id AND d.owner_id=auth.uid() AND (public.has_role(auth.uid(),'sales') OR public.verified_email()='eilaf@metalfuze.local')) THEN RAISE EXCEPTION 'MEETING_FORBIDDEN' USING ERRCODE='42501'; END IF;
  SELECT client,project INTO NEW.client_name,NEW.project_name FROM public.sales_deals WHERE id=NEW.deal_id;
  NEW.attendees:=ARRAY(SELECT DISTINCT lower(e) FROM unnest(NEW.attendees || ARRAY['hisham@metalfuze.local','haitham@metalfuze.local']) e);
 ELSE
  NEW.created_by:=OLD.created_by; NEW.deal_id:=OLD.deal_id; NEW.client_name:=OLD.client_name; NEW.project_name:=OLD.project_name;
  NEW.attendees:=OLD.attendees;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sales_meeting_prepare() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_sales_meeting_prepare BEFORE INSERT OR UPDATE ON public.sales_meetings FOR EACH ROW EXECUTE FUNCTION public.sales_meeting_prepare();
CREATE OR REPLACE FUNCTION public.sales_meeting_respond(p_meeting uuid,p_response text,p_note text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.sales_meetings; email text:=public.verified_email(); actor text;
BEGIN
 IF auth.uid() IS NULL OR email IS NULL OR email NOT IN ('hisham@metalfuze.local','haitham@metalfuze.local') THEN RAISE EXCEPTION 'MEETING_FORBIDDEN' USING ERRCODE='42501'; END IF;
 PERFORM public.assert_writable();
 IF p_response IS NULL OR p_response NOT IN ('accepted','declined') THEN RAISE EXCEPTION 'MEETING_RESPONSE'; END IF;
 SELECT * INTO m FROM public.sales_meetings WHERE id=p_meeting FOR UPDATE;
 IF m.id IS NULL OR NOT (email=ANY(m.attendees)) THEN RAISE EXCEPTION 'MEETING_FORBIDDEN' USING ERRCODE='42501'; END IF;
 INSERT INTO public.sales_meeting_responses(meeting_id,user_id,attendee_email,response,note) VALUES(p_meeting,auth.uid(),email,p_response,left(coalesce(p_note,''),2000))
 ON CONFLICT(meeting_id,user_id) DO UPDATE SET response=EXCLUDED.response,note=EXCLUDED.note,responded_at=now();
 SELECT display_name INTO actor FROM public.profiles WHERE id=auth.uid();
 IF m.created_by<>auth.uid() THEN
 INSERT INTO public.direct_messages(sender_id,recipient_id,body) VALUES(auth.uid(),m.created_by,left(coalesce(actor,email)||CASE WHEN p_response='accepted' THEN ' وافق على حضور الاجتماع' ELSE ' رفض حضور الاجتماع' END||' — '||m.client_name||' — '||m.project_name||E'\nالموعد: '||to_char(m.meeting_at AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD HH24:MI')||E'\n'||coalesce(p_note,''),4000));
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.sales_meeting_respond(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_meeting_respond(uuid,text,text) TO authenticated;
CREATE TRIGGER trg_activity_sales_meeting_responses AFTER INSERT OR UPDATE OR DELETE ON public.sales_meeting_responses FOR EACH ROW EXECUTE FUNCTION public.log_activity();
CREATE OR REPLACE FUNCTION public.sales_meeting_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text;
BEGIN
 b:='📅 اجتماع مع عميل: '||NEW.client_name||' — '||NEW.project_name||E'\nبيانات الاجتماع: '||NEW.topic||E'\nالموعد: '||to_char(NEW.meeting_at AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD HH24:MI')||E'\nالمكان: '||NEW.place||E'\n'||NEW.notes||E'\nالرد على الحضور: /messages';
 INSERT INTO public.direct_messages(sender_id,recipient_id,body) SELECT NEW.created_by,p.id,left(b,4000) FROM public.profiles p WHERE lower(p.email)=ANY(NEW.attendees) AND p.id<>NEW.created_by;
 RETURN NEW;
END $$;