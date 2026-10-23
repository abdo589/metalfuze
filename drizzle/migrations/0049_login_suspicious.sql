ALTER TABLE public.login_events ADD COLUMN IF NOT EXISTS suspicious boolean NOT NULL DEFAULT false;
ALTER TABLE public.login_events ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT '';