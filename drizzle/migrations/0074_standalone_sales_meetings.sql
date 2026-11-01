ALTER TABLE public.sales_meetings ALTER COLUMN deal_id DROP NOT NULL;
COMMENT ON COLUMN public.sales_meetings.deal_id IS 'Optional sales deal: NULL denotes a standalone meeting, independent of pricing.';
CREATE OR REPLACE FUNCTION public.sales_meeting_prepare() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.created_by:=auth.uid();
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'sales') OR public.verified_email()='eilaf@metalfuze.local') THEN RAISE EXCEPTION 'MEETING_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF NEW.deal_id IS NOT NULL THEN
   IF NOT EXISTS (SELECT 1 FROM public.sales_deals d WHERE d.id=NEW.deal_id AND d.owner_id=auth.uid()) THEN RAISE EXCEPTION 'MEETING_FORBIDDEN' USING ERRCODE='42501'; END IF;
   SELECT client,project INTO NEW.client_name,NEW.project_name FROM public.sales_deals WHERE id=NEW.deal_id;
  ELSE
   NEW.client_name:=''; NEW.project_name:='';
   IF length(trim(NEW.topic))=0 THEN RAISE EXCEPTION 'MEETING_CONTENT_REQUIRED'; END IF;
  END IF;
  NEW.attendees:=ARRAY(SELECT DISTINCT lower(e) FROM unnest(NEW.attendees || ARRAY['hisham@metalfuze.local','haitham@metalfuze.local']) e);
 ELSE
  NEW.created_by:=OLD.created_by; NEW.deal_id:=OLD.deal_id; NEW.client_name:=OLD.client_name; NEW.project_name:=OLD.project_name;
  NEW.attendees:=OLD.attendees;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sales_meeting_prepare() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.sales_meeting_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b text;
BEGIN
 b:=CASE WHEN NEW.deal_id IS NULL THEN '📅 اجتماع: '||NEW.topic ELSE '📅 اجتماع مع عميل: '||NEW.client_name||' — '||NEW.project_name||E'\nبيانات الاجتماع: '||NEW.topic END||E'\nالموعد: '||to_char(NEW.meeting_at AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD HH24:MI')||E'\nالمكان: '||NEW.place||E'\n'||NEW.notes||E'\nالرد على الحضور: /meetings';
 INSERT INTO public.direct_messages(sender_id,recipient_id,body) SELECT NEW.created_by,p.id,left(b,4000) FROM public.profiles p WHERE lower(p.email)=ANY(NEW.attendees) AND p.id<>NEW.created_by;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sales_meeting_notify() FROM PUBLIC,anon,authenticated;