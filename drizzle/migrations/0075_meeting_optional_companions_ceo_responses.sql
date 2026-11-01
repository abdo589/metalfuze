ALTER TABLE public.sales_meetings ADD COLUMN companions text[] NOT NULL DEFAULT '{}';
UPDATE public.sales_meetings SET companions=ARRAY(SELECT e FROM unnest(attendees) e WHERE lower(e) NOT IN ('ceo@metalfuze.local','haitham@metalfuze.local','eilaf@metalfuze.local')), attendees=ARRAY(SELECT DISTINCT lower(e) FROM unnest(attendees || ARRAY['ceo@metalfuze.local','haitham@metalfuze.local','eilaf@metalfuze.local']) e);
CREATE OR REPLACE FUNCTION public.sales_meeting_prepare() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.created_by:=auth.uid();
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'sales') OR coalesce(public.verified_email()='eilaf@metalfuze.local',false)) THEN RAISE EXCEPTION 'MEETING_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF NEW.deal_id IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM public.sales_deals d WHERE d.id=NEW.deal_id AND d.owner_id=auth.uid()) THEN RAISE EXCEPTION 'MEETING_FORBIDDEN' USING ERRCODE='42501'; END IF;
   SELECT client,project INTO NEW.client_name,NEW.project_name FROM public.sales_deals WHERE id=NEW.deal_id;
  ELSE
   NEW.client_name:=''; NEW.project_name:='';
   IF length(trim(NEW.topic))=0 THEN RAISE EXCEPTION 'MEETING_CONTENT_REQUIRED'; END IF;
  END IF;
 ELSE
  NEW.created_by:=OLD.created_by; NEW.deal_id:=OLD.deal_id; NEW.client_name:=OLD.client_name; NEW.project_name:=OLD.project_name;
 END IF;
 NEW.companions:=ARRAY(SELECT DISTINCT lower(e) FROM unnest(coalesce(NEW.companions,'{}'::text[])) e);
 NEW.attendees:=ARRAY(SELECT DISTINCT lower(e) FROM unnest(NEW.companions || ARRAY['ceo@metalfuze.local','haitham@metalfuze.local','eilaf@metalfuze.local']) e);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sales_meeting_prepare() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.sales_meeting_respond(p_meeting uuid,p_response text,p_note text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.sales_meetings; email text:=public.verified_email(); actor text; b text;
BEGIN
 IF auth.uid() IS NULL OR email IS NULL OR email NOT IN ('ceo@metalfuze.local','haitham@metalfuze.local') THEN RAISE EXCEPTION 'MEETING_FORBIDDEN' USING ERRCODE='42501'; END IF;
 PERFORM public.assert_writable();
 IF p_response IS NULL OR p_response NOT IN ('accepted','declined') THEN RAISE EXCEPTION 'MEETING_RESPONSE'; END IF;
 SELECT * INTO m FROM public.sales_meetings WHERE id=p_meeting FOR UPDATE;
 IF m.id IS NULL OR NOT (email=ANY(m.attendees)) THEN RAISE EXCEPTION 'MEETING_FORBIDDEN' USING ERRCODE='42501'; END IF;
 INSERT INTO public.sales_meeting_responses(meeting_id,user_id,attendee_email,response,note) VALUES(p_meeting,auth.uid(),email,p_response,left(coalesce(p_note,''),2000)) ON CONFLICT(meeting_id,user_id) DO UPDATE SET response=EXCLUDED.response,note=EXCLUDED.note,responded_at=now();
 SELECT display_name INTO actor FROM public.profiles WHERE id=auth.uid();
 b:=coalesce(actor,email)||CASE WHEN p_response='accepted' THEN ' وافق على حضور الاجتماع' ELSE ' رفض حضور الاجتماع' END||' — '||m.topic||E'\nالموعد: '||to_char(m.meeting_at AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD HH24:MI')||E'\n'||coalesce(p_note,'')||E'\n/meetings';
 INSERT INTO public.direct_messages(sender_id,recipient_id,body) SELECT auth.uid(),p.id,left(b,4000) FROM public.profiles p WHERE (p.id=m.created_by OR lower(p.email)='eilaf@metalfuze.local') AND p.id<>auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.sales_meeting_respond(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sales_meeting_respond(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.sales_meeting_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m public.sales_meetings; b text;
BEGIN
 IF TG_OP='UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN m:=OLD; ELSE m:=NEW; END IF;
 b:=CASE TG_OP WHEN 'UPDATE' THEN 'تحديث اجتماع: ' WHEN 'DELETE' THEN 'حذف اجتماع: ' ELSE '📅 اجتماع: ' END||m.topic||E'\nالموعد: '||to_char(m.meeting_at AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD HH24:MI')||E'\nالمكان: '||m.place||E'\n'||m.notes||E'\nالرد على الحضور: /meetings';
 INSERT INTO public.direct_messages(sender_id,recipient_id,body) SELECT coalesce(auth.uid(),m.created_by),p.id,left(b,4000) FROM public.profiles p WHERE (lower(p.email)=ANY(m.attendees) OR lower(p.email)='eilaf@metalfuze.local') AND (p.id<>coalesce(auth.uid(),m.created_by) OR lower(p.email)='eilaf@metalfuze.local');
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
REVOKE ALL ON FUNCTION public.sales_meeting_notify() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_sales_meeting_changes_notify AFTER UPDATE OR DELETE ON public.sales_meetings FOR EACH ROW EXECUTE FUNCTION public.sales_meeting_notify();