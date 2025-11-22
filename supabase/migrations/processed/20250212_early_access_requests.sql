-- Phase B5: Early Access Requests table + RLS
BEGIN;

CREATE TABLE IF NOT EXISTS public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  user_id UUID NULL,
  note TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  reason TEXT NULL,
  approved_by UUID NULL,
  approved_at TIMESTAMPTZ NULL,
  denied_by UUID NULL,
  denied_at TIMESTAMPTZ NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Touch trigger for updated_at
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'tg_touch_updated_at' AND pg_function_is_visible(oid)
  ) THEN
    CREATE OR REPLACE FUNCTION public.tg_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql AS $func$
    BEGIN
      NEW.updated_at := NOW();
      RETURN NEW;
    END;
    $func$;
  END IF;
END $do$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'access_requests_touch_updated_at'
  ) THEN
    CREATE TRIGGER access_requests_touch_updated_at
    BEFORE UPDATE ON public.access_requests
    FOR EACH ROW EXECUTE PROCEDURE public.tg_touch_updated_at();
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS ar_status_idx ON public.access_requests (status);
CREATE INDEX IF NOT EXISTS ar_email_idx ON public.access_requests (lower(email));
CREATE INDEX IF NOT EXISTS ar_user_idx ON public.access_requests (user_id);
CREATE INDEX IF NOT EXISTS ar_created_idx ON public.access_requests (created_at);

-- RLS
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "ar_admin_read_all" ON public.access_requests;
DROP POLICY IF EXISTS "ar_public_insert" ON public.access_requests;
DROP POLICY IF EXISTS "ar_requester_read_self" ON public.access_requests;

-- Admin can see all
CREATE POLICY "ar_admin_read_all"
ON public.access_requests FOR SELECT
USING (public.is_admin());

-- Public insert (rate-limited at API level; RLS allows anon)
CREATE POLICY "ar_public_insert"
ON public.access_requests FOR INSERT
WITH CHECK (true);

-- Requester can read own requests (if user_id present and matches)
CREATE POLICY "ar_requester_read_self"
ON public.access_requests FOR SELECT
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

COMMENT ON TABLE public.access_requests IS 'Early Access request submissions';
COMMENT ON COLUMN public.access_requests.email IS 'Requester email (normalized, lowercase)';
COMMENT ON COLUMN public.access_requests.user_id IS 'Linked user ID if requester signed in';
COMMENT ON COLUMN public.access_requests.status IS 'Request status: pending, approved, denied';
COMMENT ON COLUMN public.access_requests.meta IS 'Request metadata: ua, ip, referrer, etc.';

COMMIT;

