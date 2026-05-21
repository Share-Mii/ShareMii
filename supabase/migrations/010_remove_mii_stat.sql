-- Allow users to unyeah (remove a favorites stat event and decrement the counter).

CREATE OR REPLACE FUNCTION public.miis_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  stat_delta int;
  is_owner boolean;
BEGIN
  is_owner := auth.uid() IS NOT NULL AND OLD.user_id = auth.uid();

  IF is_owner THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.creator_name IS DISTINCT FROM OLD.creator_name
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Cannot change ownership or creator';
    END IF;

    stat_delta :=
      (NEW.views - OLD.views)
      + (NEW.downloads - OLD.downloads)
      + (NEW.favorites - OLD.favorites);

    IF stat_delta > 1 OR stat_delta < -1 THEN
      RAISE EXCEPTION 'Stats may only change by one at a time';
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

  stat_delta :=
    (NEW.views - OLD.views)
    + (NEW.downloads - OLD.downloads)
    + (NEW.favorites - OLD.favorites);

  IF stat_delta NOT IN (1, -1) THEN
    RAISE EXCEPTION 'Stats may only change by one at a time';
  END IF;

  RETURN NEW;
END;
$$;

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
  v_token uuid;
  v_user_id uuid;
  v_deleted int;
BEGIN
  IF v_stat <> 'favorites' THEN
    RAISE EXCEPTION 'only favorites can be removed';
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

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to unyeah';
  END IF;

  DELETE FROM public.mii_stat_events e
  WHERE e.mii_id = v_mii_id
    AND e.stat = v_stat
    AND (
      e.user_id = v_user_id
      OR e.browser_token = v_token
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN jsonb_build_object('recorded', false, 'reason', 'not_found');
  END IF;

  UPDATE public.miis
  SET favorites = GREATEST(favorites - 1, 0)
  WHERE id = v_mii_id;

  RETURN jsonb_build_object('recorded', true);
END;
$$;

REVOKE ALL ON FUNCTION public.remove_mii_stat(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_mii_stat(uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.remove_mii_stat(uuid, text, text) TO authenticated;
