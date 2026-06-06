-- Roadmap: appeals, mentions, blocks/mutes, shadow, discovery RPCs, feed filters, creator stats

-- ---------------------------------------------------------------------------
-- Block / mute
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.user_mutes (
  muter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CHECK (muter_id <> muted_id)
);

CREATE INDEX IF NOT EXISTS user_blocks_blocker_idx ON public.user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS user_mutes_muter_idx ON public.user_mutes (muter_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_blocks_own" ON public.user_blocks;
CREATE POLICY "user_blocks_own" ON public.user_blocks
  FOR ALL USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_mutes_own" ON public.user_mutes;
CREATE POLICY "user_mutes_own" ON public.user_mutes
  FOR ALL USING (auth.uid() = muter_id) WITH CHECK (auth.uid() = muter_id);

CREATE OR REPLACE FUNCTION public.is_blocked_with(
  p_viewer uuid,
  p_other uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_viewer IS NOT NULL AND p_other IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.user_blocks b
      WHERE (b.blocker_id = p_viewer AND b.blocked_id = p_other)
         OR (b.blocker_id = p_other AND b.blocked_id = p_viewer)
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_user_shadowed(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_user_id IS NOT NULL
    AND public.user_has_active_restriction(p_user_id, 'shadow');
$$;

CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be logged in'; END IF;
  IF p_blocked_id = auth.uid() THEN RAISE EXCEPTION 'Cannot block yourself'; END IF;
  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT DO NOTHING;
  DELETE FROM public.user_follows
  WHERE (follower_id = auth.uid() AND following_id = p_blocked_id)
     OR (follower_id = p_blocked_id AND following_id = auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be logged in'; END IF;
  DELETE FROM public.user_blocks
  WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mute_user(p_muted_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be logged in'; END IF;
  IF p_muted_id = auth.uid() THEN RAISE EXCEPTION 'Cannot mute yourself'; END IF;
  INSERT INTO public.user_mutes (muter_id, muted_id)
  VALUES (auth.uid(), p_muted_id)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unmute_user(p_muted_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be logged in'; END IF;
  DELETE FROM public.user_mutes
  WHERE muter_id = auth.uid() AND muted_id = p_muted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_blocked_users()
RETURNS TABLE (user_id uuid, username text, blocked_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be logged in'; END IF;
  RETURN QUERY
  SELECT b.blocked_id, p.username, b.created_at
  FROM public.user_blocks b
  JOIN public.profiles p ON p.id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- Profile privacy (self-serve)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_profile_hidden(p_hidden boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Must be logged in'; END IF;
  UPDATE public.profiles SET profile_hidden = p_hidden WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Content appeals
-- ---------------------------------------------------------------------------
ALTER TABLE public.content_appeals
  DROP CONSTRAINT IF EXISTS content_appeals_target_type_check;

ALTER TABLE public.content_appeals
  ADD CONSTRAINT content_appeals_target_type_check
  CHECK (target_type IN ('mii', 'comment', 'profile'));

CREATE OR REPLACE FUNCTION public.submit_content_appeal(
  p_target_type text,
  p_target_id uuid,
  p_reason text DEFAULT ''
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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Must be logged in'; END IF;
  IF p_target_type NOT IN ('mii', 'comment', 'profile') THEN
    RAISE EXCEPTION 'Invalid appeal target';
  END IF;

  IF p_target_type = 'mii' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.miis m
      WHERE m.id = p_target_id AND m.user_id = v_uid
        AND m.visibility IN ('hidden', 'removed')
    ) THEN
      RAISE EXCEPTION 'Cannot appeal this Mii';
    END IF;
  ELSIF p_target_type = 'comment' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comments c
      WHERE c.id = p_target_id AND c.user_id = v_uid
        AND c.visibility IN ('hidden', 'removed')
    ) THEN
      RAISE EXCEPTION 'Cannot appeal this comment';
    END IF;
  ELSIF p_target_type = 'profile' THEN
    IF p_target_id <> v_uid THEN
      RAISE EXCEPTION 'Can only appeal your own profile';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.profile_hidden
    ) THEN
      RAISE EXCEPTION 'Profile is not hidden';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.content_appeals a
    WHERE a.appellant_id = v_uid AND a.target_type = p_target_type
      AND a.target_id = p_target_id AND a.status = 'open'
  ) THEN
    RAISE EXCEPTION 'An open appeal already exists';
  END IF;

  INSERT INTO public.content_appeals (appellant_id, target_type, target_id, reason)
  VALUES (v_uid, p_target_type, p_target_id, left(trim(COALESCE(p_reason, '')), 2000))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_appeals(
  p_status text DEFAULT 'open',
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS SETOF public.content_appeals
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff access required'; END IF;
  PERFORM set_config('sharemii.admin_rpc', 'true', true);
  RETURN QUERY
  SELECT * FROM public.content_appeals a
  WHERE (p_status IS NULL OR a.status = p_status)
  ORDER BY a.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_appeal(
  p_appeal_id uuid,
  p_status text,
  p_staff_note text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN RAISE EXCEPTION 'Staff access required'; END IF;
  IF p_status NOT IN ('approved', 'denied') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  PERFORM set_config('sharemii.admin_rpc', 'true', true);
  UPDATE public.content_appeals
  SET status = p_status,
      staff_note = left(trim(COALESCE(p_staff_note, '')), 2000),
      resolved_at = now()
  WHERE id = p_appeal_id AND status = 'open';
  IF NOT FOUND THEN RAISE EXCEPTION 'Appeal not found or already resolved'; END IF;
END;
$$;

DROP POLICY IF EXISTS "content_appeals_select_staff" ON public.content_appeals;
CREATE POLICY "content_appeals_select_staff" ON public.content_appeals
  FOR SELECT USING (public.is_staff());

-- ---------------------------------------------------------------------------
-- Trusted creator: skip duplicate auto-flag
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_flag_duplicate_mii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dup_count int;
  v_trusted boolean;
BEGIN
  SELECT COALESCE(p.trusted_creator, false) INTO v_trusted
  FROM public.profiles p WHERE p.id = NEW.user_id;

  IF v_trusted THEN
    RETURN NEW;
  END IF;

  SELECT count(*)::int INTO dup_count
  FROM public.miis
  WHERE mii_data = NEW.mii_data AND id <> NEW.id AND visibility = 'public';

  IF dup_count > 0 THEN
    INSERT INTO public.content_reports (
      reporter_id, target_type, target_id, reason, details, priority, status
    ) VALUES (
      NEW.user_id,
      'mii',
      NEW.id,
      'spam',
      'Auto-flag: duplicate mii_data detected',
      'normal',
      'open'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Notifications: mentions + muted actors
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_notification(
  p_recipient_id uuid,
  p_actor_id uuid,
  p_type public.notification_type_enum,
  p_mii_id uuid,
  p_comment_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notify boolean;
BEGIN
  IF p_recipient_id IS NULL THEN RETURN; END IF;
  IF p_actor_id IS NOT NULL AND p_actor_id = p_recipient_id THEN RETURN; END IF;

  IF p_actor_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_mutes m
    WHERE m.muter_id = p_recipient_id AND m.muted_id = p_actor_id
  ) THEN
    RETURN;
  END IF;

  SELECT CASE p_type
    WHEN 'comment' THEN notify_comments
    WHEN 'yeah' THEN notify_yeahs
    WHEN 'favorite' THEN notify_favorites
    WHEN 'mention' THEN notify_comments
    ELSE NULL
  END INTO v_notify
  FROM public.profile_private
  WHERE user_id = p_recipient_id;

  IF v_notify IS NOT TRUE THEN RETURN; END IF;

  INSERT INTO public.notifications (
    recipient_id, actor_id, type, mii_id, comment_id
  ) VALUES (
    p_recipient_id, p_actor_id, p_type, p_mii_id, p_comment_id
  );
END;
$$;

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

REVOKE ALL ON FUNCTION public.process_comment_mentions(uuid, uuid, text, uuid) FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Comments: mentions + shadow visibility via RPC fetch
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

CREATE OR REPLACE FUNCTION public.fetch_mii_comments(p_mii_id uuid)
RETURNS SETOF public.comments
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_staff boolean := public.is_staff();
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM public.comments c
  WHERE c.mii_id = p_mii_id
    AND (
      (c.visibility = 'public' AND NOT public.is_user_shadowed(c.user_id))
      OR (v_staff)
      OR (v_uid IS NOT NULL AND c.user_id = v_uid)
    )
  ORDER BY c.created_at ASC;
END;
$$;

-- Shadow: hide shadow-restricted users' public miis from browse (non-staff)
CREATE OR REPLACE FUNCTION public.mii_visible_in_browse(p_mii public.miis)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_mii.visibility = 'public'::public.content_visibility
    AND NOT public.is_user_shadowed(p_mii.user_id)
    AND (
      auth.uid() IS NULL
      OR public.is_staff()
      OR NOT public.is_blocked_with(auth.uid(), p_mii.user_id)
    );
$$;

-- ---------------------------------------------------------------------------
-- Activity feed: filter + blocks
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fetch_activity_feed(int, timestamptz, uuid);

CREATE OR REPLACE FUNCTION public.fetch_activity_feed(
  p_limit int DEFAULT 30,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_event_filter text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  event_type text,
  actor_id uuid,
  actor_username text,
  target_mii_id uuid,
  related_mii_id uuid,
  target_collection_id uuid,
  comment_id uuid,
  created_at timestamptz,
  target_mii_name text,
  related_mii_name text,
  collection_name text,
  target_mii_data text,
  related_mii_data text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 50);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Must be logged in'; END IF;

  RETURN QUERY
  SELECT
    ae.id,
    ae.event_type,
    ae.actor_id,
    pa.username AS actor_username,
    ae.target_mii_id,
    ae.related_mii_id,
    ae.target_collection_id,
    ae.comment_id,
    ae.created_at,
    tm.name AS target_mii_name,
    rm.name AS related_mii_name,
    col.name AS collection_name,
    tm.mii_data AS target_mii_data,
    rm.mii_data AS related_mii_data
  FROM public.activity_events ae
  JOIN public.profiles pa ON pa.id = ae.actor_id
  LEFT JOIN public.miis tm ON tm.id = ae.target_mii_id
  LEFT JOIN public.miis rm ON rm.id = ae.related_mii_id
  LEFT JOIN public.mii_collections col ON col.id = ae.target_collection_id
  WHERE
    ae.actor_id IS DISTINCT FROM v_uid
    AND NOT public.is_blocked_with(v_uid, ae.actor_id)
    AND (p_event_filter IS NULL OR p_event_filter = '' OR ae.event_type = p_event_filter)
    AND (
      (
        ae.event_type IN ('yeah', 'submit', 'collection_add')
        AND ae.actor_id IN (
          SELECT uf.following_id FROM public.user_follows uf WHERE uf.follower_id = v_uid
        )
      )
      OR (
        ae.event_type = 'comment'
        AND ae.target_mii_id IN (
          SELECT m.id FROM public.miis m WHERE m.user_id = v_uid
          UNION
          SELECT uf.mii_id FROM public.user_favorites uf WHERE uf.user_id = v_uid
        )
      )
      OR (
        ae.event_type = 'remix'
        AND ae.target_mii_id IN (
          SELECT m.id FROM public.miis m WHERE m.user_id = v_uid
        )
      )
    )
    AND (ae.target_mii_id IS NULL OR tm.visibility = 'public' OR tm.user_id = v_uid)
    AND (ae.related_mii_id IS NULL OR rm.visibility = 'public' OR rm.user_id = v_uid)
    AND (ae.target_collection_id IS NULL OR col.is_public OR col.user_id = v_uid)
    AND (
      p_cursor_created_at IS NULL OR p_cursor_id IS NULL
      OR (ae.created_at, ae.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY ae.created_at DESC, ae.id DESC
  LIMIT v_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- Discovery RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_trending_miis(p_limit int DEFAULT 24)
RETURNS SETOF public.miis
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);
BEGIN
  RETURN QUERY
  SELECT m.*
  FROM public.miis m
  WHERE public.mii_visible_in_browse(m)
    AND m.created_at > now() - interval '14 days'
  ORDER BY (
    m.favorites * 3 + m.views * 0.1 + m.downloads * 0.5
  ) / (1 + extract(epoch FROM (now() - m.created_at)) / 86400) DESC,
  m.created_at DESC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_random_mii()
RETURNS public.miis
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.miis;
BEGIN
  SELECT m.* INTO result
  FROM public.miis m
  WHERE public.mii_visible_in_browse(m)
  ORDER BY random()
  LIMIT 1;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_profiles(
  p_query text,
  p_limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  username text,
  bio text,
  avatar_url text,
  trusted_creator boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term text := lower(trim(COALESCE(p_query, '')));
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_uid uuid := auth.uid();
BEGIN
  IF length(v_term) < 2 THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.username, p.bio, p.avatar_url, p.trusted_creator
  FROM public.profiles p
  WHERE NOT p.profile_hidden
    AND (
      lower(p.username) LIKE '%' || v_term || '%'
      OR lower(p.bio) LIKE '%' || v_term || '%'
    )
    AND (v_uid IS NULL OR NOT public.is_blocked_with(v_uid, p.id))
  ORDER BY
    CASE WHEN lower(p.username) = v_term THEN 0
         WHEN lower(p.username) LIKE v_term || '%' THEN 1
         ELSE 2 END,
    p.username
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_remix_source(p_mii_id uuid)
RETURNS public.miis
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT src.*
  FROM public.miis m
  JOIN public.miis src ON src.id = m.remix_of_mii_id
  WHERE m.id = p_mii_id
    AND (src.visibility = 'public' OR src.user_id = auth.uid() OR public.is_staff());
$$;

CREATE OR REPLACE FUNCTION public.fetch_remix_children(
  p_mii_id uuid,
  p_limit int DEFAULT 12
)
RETURNS SETOF public.miis
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT m.*
  FROM public.miis m
  WHERE m.remix_of_mii_id = p_mii_id
    AND (m.visibility = 'public' OR m.user_id = auth.uid() OR public.is_staff())
  ORDER BY m.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 12), 1), 24);
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_follow_suggestions(p_limit int DEFAULT 8)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20);
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  (
    SELECT DISTINCT p.id, p.username, p.avatar_url, 'Popular creator'::text
    FROM public.miis m
    JOIN public.profiles p ON p.id = m.user_id
    WHERE public.mii_visible_in_browse(m)
      AND m.user_id IS NOT NULL
      AND m.user_id <> v_uid
      AND NOT EXISTS (
        SELECT 1 FROM public.user_follows uf
        WHERE uf.follower_id = v_uid AND uf.following_id = m.user_id
      )
      AND NOT public.is_blocked_with(v_uid, m.user_id)
      AND NOT p.profile_hidden
    GROUP BY p.id, p.username, p.avatar_url
    ORDER BY sum(m.favorites) DESC
    LIMIT v_limit
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_user_public_activity(
  p_user_id uuid,
  p_limit int DEFAULT 20,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  event_type text,
  actor_id uuid,
  actor_username text,
  target_mii_id uuid,
  related_mii_id uuid,
  target_collection_id uuid,
  comment_id uuid,
  created_at timestamptz,
  target_mii_name text,
  related_mii_name text,
  collection_name text,
  target_mii_data text,
  related_mii_data text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
BEGIN
  RETURN QUERY
  SELECT
    ae.id, ae.event_type, ae.actor_id, pa.username,
    ae.target_mii_id, ae.related_mii_id, ae.target_collection_id, ae.comment_id,
    ae.created_at, tm.name, rm.name, col.name, tm.mii_data, rm.mii_data
  FROM public.activity_events ae
  JOIN public.profiles pa ON pa.id = ae.actor_id
  LEFT JOIN public.miis tm ON tm.id = ae.target_mii_id
  LEFT JOIN public.miis rm ON rm.id = ae.related_mii_id
  LEFT JOIN public.mii_collections col ON col.id = ae.target_collection_id
  WHERE ae.actor_id = p_user_id
    AND ae.event_type IN ('yeah', 'submit', 'collection_add', 'remix')
    AND (auth.uid() IS NULL OR NOT public.is_blocked_with(auth.uid(), p_user_id))
    AND (p_cursor_created_at IS NULL OR p_cursor_id IS NULL
      OR (ae.created_at, ae.id) < (p_cursor_created_at, p_cursor_id))
  ORDER BY ae.created_at DESC, ae.id DESC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_creator_stats(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := COALESCE(p_user_id, auth.uid());
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Must be logged in'; END IF;
  IF p_user_id IS NOT NULL AND p_user_id <> auth.uid() AND NOT public.is_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT jsonb_build_object(
    'upload_count', (SELECT count(*)::int FROM public.miis m WHERE m.user_id = v_uid),
    'public_upload_count', (
      SELECT count(*)::int FROM public.miis m
      WHERE m.user_id = v_uid AND m.visibility = 'public'
    ),
    'total_yeahs', COALESCE((
      SELECT sum(m.favorites)::bigint FROM public.miis m WHERE m.user_id = v_uid
    ), 0),
    'total_views', COALESCE((
      SELECT sum(m.views)::bigint FROM public.miis m WHERE m.user_id = v_uid
    ), 0),
    'total_downloads', COALESCE((
      SELECT sum(m.downloads)::bigint FROM public.miis m WHERE m.user_id = v_uid
    ), 0),
    'remix_received_count', (
      SELECT count(*)::int FROM public.miis m
      JOIN public.miis child ON child.remix_of_mii_id = m.id
      WHERE m.user_id = v_uid AND child.visibility = 'public'
    ),
    'follower_count', (
      SELECT count(*)::int FROM public.user_follows uf WHERE uf.following_id = v_uid
    ),
    'following_count', (
      SELECT count(*)::int FROM public.user_follows uf WHERE uf.follower_id = v_uid
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.fetch_public_collections(
  p_limit int DEFAULT 24,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  user_id uuid,
  owner_username text,
  item_count bigint,
  preview_mii_ids uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 24), 1), 48);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.user_id,
    p.username,
    (SELECT count(*) FROM public.mii_collection_items i WHERE i.collection_id = c.id),
    COALESCE((
      SELECT array_agg(sub.mii_id ORDER BY sub.position)
      FROM (
        SELECT i.mii_id, i.position
        FROM public.mii_collection_items i
        WHERE i.collection_id = c.id
        ORDER BY i.position
        LIMIT 4
      ) sub
    ), ARRAY[]::uuid[])
  FROM public.mii_collections c
  JOIN public.profiles p ON p.id = c.user_id
  WHERE c.is_public AND NOT p.profile_hidden
    AND (auth.uid() IS NULL OR NOT public.is_blocked_with(auth.uid(), c.user_id))
  ORDER BY c.updated_at DESC
  LIMIT v_limit OFFSET v_offset;
END;
$$;

-- Rate limit transparency
CREATE OR REPLACE FUNCTION public.get_rate_limit_status(p_action text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
  v_window interval := interval '1 hour';
  v_max int;
  v_retry_seconds int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'retry_after_seconds', 0);
  END IF;

  IF p_action = 'comment' THEN
    v_max := 30;
    SELECT count(*)::int INTO v_count
    FROM public.comments c
    WHERE c.user_id = v_uid AND c.created_at > now() - v_window;
  ELSIF p_action = 'yeah' THEN
    v_max := 120;
    SELECT count(*)::int INTO v_count
    FROM public.mii_stat_events e
    WHERE e.user_id = v_uid AND e.stat = 'favorites'
      AND e.created_at > now() - v_window;
  ELSIF p_action = 'report' THEN
    v_max := 10;
    SELECT count(*)::int INTO v_count
    FROM public.content_reports r
    WHERE r.reporter_id = v_uid AND r.created_at > now() - interval '1 day';
    v_window := interval '1 day';
  ELSE
    RETURN jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
  END IF;

  IF v_count >= v_max THEN
    IF p_action = 'report' THEN
      SELECT GREATEST(0, extract(epoch FROM (
        (SELECT min(r.created_at) + interval '1 day' FROM public.content_reports r
         WHERE r.reporter_id = v_uid AND r.created_at > now() - interval '1 day')
        - now()
      ))::int) INTO v_retry_seconds;
    ELSE
      SELECT GREATEST(0, extract(epoch FROM (
        (SELECT min(x.created_at) + v_window FROM (
          SELECT c.created_at FROM public.comments c
          WHERE p_action = 'comment' AND c.user_id = v_uid AND c.created_at > now() - v_window
          UNION ALL
          SELECT e.created_at FROM public.mii_stat_events e
          WHERE p_action = 'yeah' AND e.user_id = v_uid AND e.stat = 'favorites'
            AND e.created_at > now() - v_window
        ) x) - now()
      ))::int) INTO v_retry_seconds;
    END IF;
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', COALESCE(v_retry_seconds, 3600),
      'limit', v_max,
      'used', v_count
    );
  END IF;

  RETURN jsonb_build_object('allowed', true, 'retry_after_seconds', 0, 'limit', v_max, 'used', v_count);
END;
$$;

-- Grants
REVOKE ALL ON FUNCTION public.is_blocked_with(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_user_shadowed(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.mute_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mute_user(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.unmute_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unmute_user(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.list_blocked_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_blocked_users() TO authenticated;
REVOKE ALL ON FUNCTION public.set_profile_hidden(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_profile_hidden(boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.submit_content_appeal(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_content_appeal(text, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_appeals(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_appeals(text, int, int) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_resolve_appeal(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_appeal(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.fetch_mii_comments(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_mii_comments(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.fetch_activity_feed(int, timestamptz, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_activity_feed(int, timestamptz, uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.fetch_trending_miis(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_trending_miis(int) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.fetch_random_mii() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_random_mii() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.search_profiles(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_profiles(text, int) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.fetch_remix_source(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_remix_source(uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.fetch_remix_children(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_remix_children(uuid, int) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.fetch_follow_suggestions(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_follow_suggestions(int) TO authenticated;
REVOKE ALL ON FUNCTION public.fetch_user_public_activity(uuid, int, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_user_public_activity(uuid, int, timestamptz, uuid) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.fetch_creator_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_creator_stats(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.fetch_public_collections(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_public_collections(int, int) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_rate_limit_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_rate_limit_status(text) TO authenticated;

-- Shadow: hide shadow-restricted users' public content from general browse
DROP POLICY IF EXISTS "miis_select" ON public.miis;
CREATE POLICY "miis_select" ON public.miis
  FOR SELECT USING (
    (
      visibility = 'public'
      AND NOT public.is_user_shadowed(user_id)
    )
    OR public.is_staff()
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (
    (
      visibility = 'public'
      AND NOT public.is_user_shadowed(user_id)
    )
    OR public.is_staff()
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );
