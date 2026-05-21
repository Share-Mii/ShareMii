-- Auto-moderation: hide link/spam-style comments without notifying recipients,
-- log flags for staff, and allow ML-assisted client shadowing via RPC (returns comment id reliably).

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS suppress_author_view boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Staff queue for automated / client-triggered moderation events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_auto_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  mii_id uuid REFERENCES public.miis(id) ON DELETE SET NULL,
  body_excerpt text NOT NULL,
  detail text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS moderation_auto_flags_created_idx
  ON public.moderation_auto_flags (created_at DESC);

ALTER TABLE public.moderation_auto_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "moderation_auto_flags_select_staff" ON public.moderation_auto_flags;
CREATE POLICY "moderation_auto_flags_select_staff" ON public.moderation_auto_flags
  FOR SELECT USING (public.is_staff());

-- ---------------------------------------------------------------------------
-- Row flags: only staff may see comments that are hidden from their author
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (
    visibility = 'public'
    OR public.is_staff()
    OR (
      auth.uid() IS NOT NULL
      AND user_id = auth.uid()
      AND NOT suppress_author_view
    )
  );

-- ---------------------------------------------------------------------------
-- Do not notify Mii owners for non-public comments
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF NEW.visibility IS DISTINCT FROM 'public'::public.content_visibility THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO v_owner_id FROM public.miis WHERE id = NEW.mii_id;
  PERFORM public.create_notification(v_owner_id, NEW.user_id, 'comment', NEW.mii_id, NEW.id);
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Internal helper (no EXECUTE grants)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._insert_moderation_auto_flag(
  p_kind text,
  p_comment_id uuid,
  p_user_id uuid,
  p_mii_id uuid,
  p_excerpt text,
  p_detail text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.moderation_auto_flags (
    kind, comment_id, user_id, mii_id, body_excerpt, detail
  )
  VALUES (
    p_kind,
    p_comment_id,
    p_user_id,
    p_mii_id,
    left(COALESCE(p_excerpt, ''), 500),
    COALESCE(p_detail, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public._insert_moderation_auto_flag(text, uuid, uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- BEFORE INSERT: reset moderation fields server-side and hide obvious links/spam URLs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comments_set_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  profile_username text;
  lower_body text;
BEGIN
  PERFORM public.assert_user_can_comment();

  SELECT username INTO profile_username
  FROM public.profiles
  WHERE id = auth.uid();

  IF profile_username IS NULL OR trim(profile_username) = '' THEN
    RAISE EXCEPTION 'Set your gamertag in Profile before commenting';
  END IF;

  NEW.author_name := profile_username;
  NEW.user_id := auth.uid();

  -- Ignore any client-supplied moderation fields
  NEW.visibility := 'public';
  NEW.suppress_author_view := false;
  NEW.hidden_reason := NULL;
  NEW.hidden_at := NULL;
  NEW.hidden_by := NULL;

  lower_body := lower(NEW.body);
  IF lower_body ~ '(https?://|www\.)'
    OR lower_body ~ '[[:alnum:]-]{1,63}[.](com|net|org|io|co|gg|tv|me|ru|app|dev|xyz|info|biz|club|games)([^[:alnum:].]|$)' THEN
    NEW.visibility := 'hidden';
    NEW.suppress_author_view := true;
    NEW.hidden_reason := 'auto_link_or_spam';
    NEW.hidden_at := now();
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- AFTER INSERT: enqueue staff-facing flag when the row was auto-hidden
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.comments_enqueue_auto_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.visibility = 'hidden'::public.content_visibility
    AND NEW.suppress_author_view = true
    AND NEW.hidden_reason = 'auto_link_or_spam' THEN
    PERFORM public._insert_moderation_auto_flag(
      'auto_link_or_spam',
      NEW.id,
      NEW.user_id,
      NEW.mii_id,
      NEW.body,
      ''
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.comments_enqueue_auto_flag() FROM PUBLIC;

DROP TRIGGER IF EXISTS comments_enqueue_auto_flag ON public.comments;
CREATE TRIGGER comments_enqueue_auto_flag
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_enqueue_auto_flag();

-- ---------------------------------------------------------------------------
-- Comment posting through RPC (reliable RETURNING id + shared insert rules)
-- ---------------------------------------------------------------------------
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
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to comment';
  END IF;

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

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_comment(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_comment(uuid, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- Client-assisted shadow (toxicity / advertising text) on a row the user just created
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.client_shadow_recent_comment(
  p_comment_id uuid,
  p_kind text,
  p_detail text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.comments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT * INTO STRICT row FROM public.comments WHERE id = p_comment_id;

  IF row.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF row.created_at < now() - interval '3 minutes' THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF row.visibility IS DISTINCT FROM 'public'::public.content_visibility THEN
    RETURN;
  END IF;

  UPDATE public.comments
  SET
    visibility = 'hidden',
    suppress_author_view = true,
    hidden_reason = 'auto_client_policy',
    hidden_at = now()
  WHERE id = p_comment_id;

  PERFORM public._insert_moderation_auto_flag(
    COALESCE(NULLIF(trim(p_kind), ''), 'client_text_policy'),
    p_comment_id,
    row.user_id,
    row.mii_id,
    row.body,
    COALESCE(p_detail, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.client_shadow_recent_comment(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_shadow_recent_comment(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Log blocked profile/Mii-field attempts (spam / toxicity) for staff review
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_profile_content_block(
  p_field text,
  p_value text,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent int;
  kind text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT count(*)::int INTO recent
  FROM public.moderation_auto_flags
  WHERE user_id = auth.uid()
    AND kind LIKE 'profile_%'
    AND created_at > now() - interval '1 hour';

  IF recent >= 30 THEN
    RETURN;
  END IF;

  kind := 'profile_' || left(regexp_replace(COALESCE(p_field, 'field'), '[^a-z0-9_]+', '_', 'gi'), 40);

  PERFORM public._insert_moderation_auto_flag(
    kind,
    NULL,
    auth.uid(),
    NULL,
    COALESCE(p_value, ''),
    COALESCE(p_reason, '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_profile_content_block(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_profile_content_block(text, text, text) TO authenticated;

-- Block direct table INSERTs — use submit_comment rpc (SECURITY DEFINER bypasses this policy).
DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT
  WITH CHECK (false);
