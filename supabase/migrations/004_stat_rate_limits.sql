-- Rate-limited Mii stats (per IP hash, browser token, and account)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.mii_stat_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mii_id uuid NOT NULL REFERENCES public.miis(id) ON DELETE CASCADE,
  stat text NOT NULL CHECK (stat IN ('views', 'downloads', 'favorites')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  browser_token uuid NOT NULL,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mii_stat_events_ip_stat_created_idx
  ON public.mii_stat_events (ip_hash, stat, created_at DESC)
  WHERE ip_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS mii_stat_events_browser_stat_created_idx
  ON public.mii_stat_events (browser_token, stat, created_at DESC);

CREATE INDEX IF NOT EXISTS mii_stat_events_user_stat_created_idx
  ON public.mii_stat_events (user_id, stat, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mii_stat_events_user_mii_stat_idx
  ON public.mii_stat_events (mii_id, stat, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS mii_stat_events_browser_mii_stat_idx
  ON public.mii_stat_events (mii_id, stat, browser_token)
  WHERE stat IN ('downloads', 'favorites');

ALTER TABLE public.mii_stat_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mii_stat_events_insert" ON public.mii_stat_events;
CREATE POLICY "mii_stat_events_insert" ON public.mii_stat_events
  FOR INSERT
  WITH CHECK (
    (user_id IS NULL OR user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.request_client_ip_hash()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  headers json;
  ip text;
BEGIN
  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;

  ip := coalesce(
    nullif(trim(headers->>'cf-connecting-ip'), ''),
    nullif(trim(headers->>'x-real-ip'), ''),
    nullif(trim(split_part(coalesce(headers->>'x-forwarded-for', ''), ',', 1)), '')
  );

  IF ip IS NULL OR ip = '' THEN
    RETURN NULL;
  END IF;

  RETURN encode(digest(convert_to(ip || ':sharemii-stat-v1', 'UTF8'), 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.mii_stat_rate_allowed(
  p_stat text,
  p_ip_hash text,
  p_browser_token uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  ip_limit int;
  browser_limit int;
  user_limit int;
BEGIN
  CASE p_stat
    WHEN 'favorites' THEN
      ip_limit := 40;
      browser_limit := 25;
      user_limit := 50;
    WHEN 'downloads' THEN
      ip_limit := 50;
      browser_limit := 30;
      user_limit := 50;
    WHEN 'views' THEN
      ip_limit := 120;
      browser_limit := 80;
      user_limit := 120;
    ELSE
      RETURN false;
  END CASE;

  IF p_ip_hash IS NOT NULL AND (
    SELECT count(*)::int
    FROM public.mii_stat_events
    WHERE ip_hash = p_ip_hash
      AND stat = p_stat
      AND created_at > now() - interval '1 hour'
  ) >= ip_limit THEN
    RETURN false;
  END IF;

  IF (
    SELECT count(*)::int
    FROM public.mii_stat_events
    WHERE browser_token = p_browser_token
      AND stat = p_stat
      AND created_at > now() - interval '1 hour'
  ) >= browser_limit THEN
    RETURN false;
  END IF;

  IF p_user_id IS NOT NULL AND (
    SELECT count(*)::int
    FROM public.mii_stat_events
    WHERE user_id = p_user_id
      AND stat = p_stat
      AND created_at > now() - interval '1 hour'
  ) >= user_limit THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.request_client_ip_hash() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mii_stat_rate_allowed(text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.increment_mii_stat(uuid, text);

CREATE OR REPLACE FUNCTION public.increment_mii_stat(
  mii_id uuid,
  stat text,
  browser_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  v_mii_id uuid := mii_id;
  v_stat text := stat;
  v_token uuid;
  v_user_id uuid;
  v_ip_hash text;
  v_duplicate boolean := false;
BEGIN
  IF v_stat NOT IN ('views', 'downloads', 'favorites') THEN
    RAISE EXCEPTION 'invalid stat: %', v_stat;
  END IF;

  BEGIN
    v_token := browser_token::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid browser_token';
  END;

  IF NOT EXISTS (SELECT 1 FROM public.miis m WHERE m.id = v_mii_id) THEN
    RAISE EXCEPTION 'mii not found: %', v_mii_id;
  END IF;

  v_user_id := auth.uid();
  v_ip_hash := public.request_client_ip_hash();

  IF v_stat = 'favorites' AND v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to yeah';
  END IF;

  IF v_stat = 'views' AND EXISTS (
    SELECT 1
    FROM public.mii_stat_events e
    WHERE e.mii_id = v_mii_id
      AND e.stat = 'views'
      AND e.browser_token = v_token
      AND e.created_at > now() - interval '24 hours'
  ) THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'duplicate');
  END IF;

  IF v_stat IN ('downloads', 'favorites') AND EXISTS (
    SELECT 1
    FROM public.mii_stat_events e
    WHERE e.mii_id = v_mii_id
      AND e.stat = v_stat
      AND (
        e.browser_token = v_token
        OR (v_user_id IS NOT NULL AND e.user_id = v_user_id)
      )
  ) THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'duplicate');
  END IF;

  IF NOT public.mii_stat_rate_allowed(v_stat, v_ip_hash, v_token, v_user_id) THEN
    RAISE EXCEPTION 'rate limit exceeded';
  END IF;

  BEGIN
    INSERT INTO public.mii_stat_events (mii_id, stat, user_id, browser_token, ip_hash)
    VALUES (v_mii_id, v_stat, v_user_id, v_token, v_ip_hash);
  EXCEPTION
    WHEN unique_violation THEN
      v_duplicate := true;
  END;

  IF v_duplicate THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'duplicate');
  END IF;

  IF v_stat = 'views' THEN
    UPDATE public.miis SET views = views + 1 WHERE id = v_mii_id;
  ELSIF v_stat = 'downloads' THEN
    UPDATE public.miis SET downloads = downloads + 1 WHERE id = v_mii_id;
  ELSE
    UPDATE public.miis SET favorites = favorites + 1 WHERE id = v_mii_id;
  END IF;

  RETURN jsonb_build_object('recorded', true);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_mii_stat(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text, text) TO authenticated;
