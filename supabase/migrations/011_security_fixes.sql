-- Close gaps: direct stat tampering, username squatting, stat-event poisoning, cross-user unyeah.

-- ---------------------------------------------------------------------------
-- Profiles: enforce gamertag rules in the database (not only the client)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_validate_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  trimmed text;
  normalized text;
BEGIN
  trimmed := btrim(NEW.username);

  IF trimmed = '' THEN
    NEW.username := '';
    NEW.username_normalized := NULL;
    RETURN NEW;
  END IF;

  IF char_length(trimmed) < 3 OR char_length(trimmed) > 15 THEN
    RAISE EXCEPTION 'Gamertag must be 3–15 characters';
  END IF;

  IF trimmed !~ '^[A-Za-z]' THEN
    RAISE EXCEPTION 'Gamertag must start with a letter';
  END IF;

  IF trimmed !~ '^[A-Za-z][A-Za-z0-9 ]*[A-Za-z0-9]$'
    AND trimmed !~ '^[A-Za-z]{3,15}$' THEN
    RAISE EXCEPTION 'Invalid gamertag characters';
  END IF;

  normalized := lower(trimmed);

  IF normalized IN (
    'admin', 'moderator', 'mod', 'sharemii', 'support', 'help',
    'system', 'null', 'undefined'
  ) THEN
    RAISE EXCEPTION 'This gamertag is not available';
  END IF;

  NEW.username := trimmed;
  NEW.username_normalized := normalized;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_username ON public.profiles;
CREATE TRIGGER profiles_validate_username
  BEFORE INSERT OR UPDATE OF username, username_normalized ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_validate_username();

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_length;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_length CHECK (char_length(bio) <= 500);

REVOKE ALL ON FUNCTION public.profiles_validate_username() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Miis: only +1 via direct UPDATE; stat RPCs use a session flag for unyeah
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.miis_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  stat_delta int;
  is_owner boolean;
  rpc_mode text;
BEGIN
  rpc_mode := current_setting('sharemii.stat_rpc', true);

  IF rpc_mode IN ('increment', 'decrement') THEN
    RETURN NEW;
  END IF;

  is_owner := auth.uid() IS NOT NULL AND OLD.user_id = auth.uid();

  IF is_owner THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.creator_name IS DISTINCT FROM OLD.creator_name
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Cannot change ownership or creator';
    END IF;

    IF NEW.views IS DISTINCT FROM OLD.views
      OR NEW.downloads IS DISTINCT FROM OLD.downloads
      OR NEW.favorites IS DISTINCT FROM OLD.favorites
    THEN
      RAISE EXCEPTION 'Use stat RPC to update counters';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.name IS DISTINCT FROM OLD.name
    OR NEW.creator_name IS DISTINCT FROM OLD.creator_name
    OR NEW.description IS DISTINCT FROM OLD.description
    OR NEW.platform IS DISTINCT FROM OLD.platform
    OR NEW.mii_data IS DISTINCT FROM OLD.mii_data
    OR NEW.mii_data_download IS DISTINCT FROM OLD.mii_data_download
    OR NEW.gender IS DISTINCT FROM OLD.gender
    OR NEW.user_id IS DISTINCT FROM OLD.user_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Only view/download/yeah counters can be updated';
  END IF;

  IF NEW.views < OLD.views OR NEW.downloads < OLD.downloads OR NEW.favorites < OLD.favorites THEN
    RAISE EXCEPTION 'Stats cannot decrease';
  END IF;

  stat_delta :=
    (NEW.views - OLD.views)
    + (NEW.downloads - OLD.downloads)
    + (NEW.favorites - OLD.favorites);

  IF stat_delta <> 1 THEN
    RAISE EXCEPTION 'Stats may only increment by one at a time';
  END IF;

  RETURN NEW;
END;
$$;

-- Direct REST stat bumps are not allowed; only SECURITY DEFINER RPCs update counters.
DROP POLICY IF EXISTS "miis_update_stats" ON public.miis;

-- ---------------------------------------------------------------------------
-- Stat events: only written by increment_mii_stat (not direct PostgREST INSERT)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "mii_stat_events_insert" ON public.mii_stat_events;

REVOKE INSERT ON public.mii_stat_events FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- remove_mii_stat: only delete the caller's yeah; sync counter to rows removed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_mii_stat(
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
  v_user_id uuid;
  v_deleted int;
BEGIN
  IF v_stat <> 'favorites' THEN
    RAISE EXCEPTION 'only favorites can be removed';
  END IF;

  BEGIN
    PERFORM browser_token::uuid;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE EXCEPTION 'invalid browser_token';
  END;

  IF NOT EXISTS (SELECT 1 FROM public.miis m WHERE m.id = v_mii_id) THEN
    RAISE EXCEPTION 'mii not found: %', v_mii_id;
  END IF;

  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to unyeah';
  END IF;

  DELETE FROM public.mii_stat_events e
  WHERE e.mii_id = v_mii_id
    AND e.stat = v_stat
    AND e.user_id = v_user_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'not_found');
  END IF;

  PERFORM set_config('sharemii.stat_rpc', 'decrement', true);

  UPDATE public.miis
  SET favorites = GREATEST(favorites - v_deleted, 0)
  WHERE id = v_mii_id;

  RETURN jsonb_build_object('recorded', true);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_mii_stat(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_mii_stat(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.remove_mii_stat(uuid, text, text) TO authenticated;

-- increment_mii_stat: mark RPC updates so owner content guard does not block +1
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

  PERFORM set_config('sharemii.stat_rpc', 'increment', true);

  IF v_stat = 'views' THEN
    UPDATE public.miis SET views = views + 1 WHERE id = v_mii_id;
  ELSIF v_stat = 'downloads' THEN
    UPDATE public.miis SET downloads = downloads + 1 WHERE id = v_mii_id;
  ELSE
    UPDATE public.miis SET favorites = favorites + 1 WHERE id = v_mii_id;
    SELECT user_id INTO v_owner_id FROM public.miis WHERE id = v_mii_id;
    BEGIN
      PERFORM public.create_notification(
        v_owner_id, v_user_id, 'yeah', v_mii_id, NULL
      );
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

  RETURN jsonb_build_object('recorded', true);
END;
$$;

REVOKE ALL ON FUNCTION public.increment_mii_stat(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text, text) TO authenticated;
