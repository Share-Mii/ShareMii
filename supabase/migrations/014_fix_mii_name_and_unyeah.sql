-- Allow longer display names; simplify unyeah RPC; let users read their own stat events.

ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_name_length;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_name_length CHECK (
    char_length(btrim(name)) BETWEEN 1 AND 32
  ) NOT VALID;

DROP POLICY IF EXISTS "mii_stat_events_select_own" ON public.mii_stat_events;

CREATE POLICY "mii_stat_events_select_own" ON public.mii_stat_events
  FOR SELECT USING (user_id = auth.uid());

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

  IF browser_token IS NOT NULL AND btrim(browser_token) <> '' THEN
    BEGIN
      PERFORM browser_token::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;

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
