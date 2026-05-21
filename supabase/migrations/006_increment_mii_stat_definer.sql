-- increment_mii_stat calls request_client_ip_hash and mii_stat_rate_allowed,
-- which are revoked from anon/authenticated. Run as definer so clients can record stats.

CREATE OR REPLACE FUNCTION public.increment_mii_stat(
  mii_id uuid,
  stat text,
  browser_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_mii_id uuid := mii_id;
  v_stat text := stat;
  v_token uuid;
  v_user_id uuid;
  v_ip_hash text;
  v_duplicate boolean := false;
  v_owner_id uuid;
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
    SELECT user_id INTO v_owner_id FROM public.miis WHERE id = v_mii_id;
    PERFORM public.create_notification(
      v_owner_id, v_user_id, 'yeah', v_mii_id, NULL
    );
  END IF;

  RETURN jsonb_build_object('recorded', true);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_mii_stat(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text, text) TO authenticated;
