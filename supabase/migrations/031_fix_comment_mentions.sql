-- Fix @mention parsing for gamertags (spaces) and profile lookup.

CREATE OR REPLACE FUNCTION public.process_comment_mentions(
  p_comment_id uuid,
  p_mii_id uuid,
  p_body text,
  p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m text;
  v_username text;
  v_user_id uuid;
BEGIN
  FOR m IN
    SELECT DISTINCT (regexp_matches)[1]
    FROM regexp_matches(
      p_body,
      '@([A-Za-z][A-Za-z0-9]{0,12}(?: [A-Za-z0-9]+){0,4})',
      'g'
    ) AS regexp_matches
  LOOP
    v_username := btrim(m);
    IF char_length(v_username) < 3 OR char_length(v_username) > 15 THEN
      CONTINUE;
    END IF;

    SELECT p.id INTO v_user_id
    FROM public.profiles p
    WHERE (
      p.username_normalized = lower(v_username)
      OR lower(p.username) = lower(v_username)
      OR replace(lower(p.username), ' ', '') = lower(replace(v_username, ' ', ''))
    )
      AND NOT COALESCE(p.profile_hidden, false)
    LIMIT 1;

    IF v_user_id IS NOT NULL AND v_user_id IS DISTINCT FROM p_actor_id THEN
      PERFORM public.create_notification(
        v_user_id, p_actor_id, 'mention', p_mii_id, p_comment_id
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_comment(
  p_mii_id uuid,
  p_body text,
  p_parent_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Must be logged in to comment'; END IF;
  PERFORM public.assert_user_can_comment();

  IF NOT public.comment_target_mii_allows_feedback(p_mii_id) THEN
    RAISE EXCEPTION 'Cannot comment on this Mii';
  END IF;

  IF p_parent_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comments
      WHERE id = p_parent_id AND mii_id = p_mii_id
    ) THEN
      RAISE EXCEPTION 'Invalid reply target';
    END IF;
  END IF;

  IF char_length(trim(COALESCE(p_body, ''))) < 1 OR char_length(p_body) > 500 THEN
    RAISE EXCEPTION 'Invalid comment body';
  END IF;

  INSERT INTO public.comments (mii_id, body, parent_id)
  VALUES (p_mii_id, trim(p_body), p_parent_id)
  RETURNING id INTO new_id;

  PERFORM public.process_comment_mentions(new_id, p_mii_id, trim(p_body), v_uid);

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_comment(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_comment(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_comment(uuid, text, uuid) TO authenticated;
