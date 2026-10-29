CREATE OR REPLACE FUNCTION public.sales_meeting_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d record; b text;
BEGIN
  SELECT client, project INTO d FROM public.sales_deals WHERE id = NEW.deal_id;
  b := '📅 اجتماع مع عميل: ' || coalesce(d.client,'') || ' — ' || coalesce(d.project,'') ||
       E'\nالموعد: ' || to_char(NEW.meeting_at AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD HH24:MI') ||
       CASE WHEN NEW.place <> '' THEN E'\nالمكان: ' || NEW.place ELSE '' END ||
       CASE WHEN NEW.notes <> '' THEN E'\n' || NEW.notes ELSE '' END;
  INSERT INTO public.direct_messages (sender_id, recipient_id, body)
  SELECT NEW.created_by, p.id, b FROM public.profiles p
  WHERE lower(p.email) = ANY (SELECT lower(a) FROM unnest(NEW.attendees) a) AND p.id <> NEW.created_by;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sales_meeting_notify() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_sales_meeting_notify AFTER INSERT ON public.sales_meetings FOR EACH ROW EXECUTE FUNCTION public.sales_meeting_notify();