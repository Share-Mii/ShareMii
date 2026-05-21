-- Pinned Miis, user favorites, notifications, owner Mii edits

-- Notification preferences on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_comments boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_yeahs boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_favorites boolean NOT NULL DEFAULT true;

-- Comment author user id for notifications
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.comments_set_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  profile_username text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to comment';
  END IF;

  SELECT username INTO profile_username
  FROM public.profiles
  WHERE id = auth.uid();

  IF profile_username IS NULL OR trim(profile_username) = '' THEN
    RAISE EXCEPTION 'Set your gamertag in Profile before commenting';
  END IF;

  NEW.author_name := profile_username;
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

-- Pinned Miis (max 6 per user)
CREATE TABLE IF NOT EXISTS public.profile_pinned_miis (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mii_id uuid NOT NULL REFERENCES public.miis(id) ON DELETE CASCADE,
  position int NOT NULL CHECK (position BETWEEN 1 AND 6),
  pinned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mii_id)
);

CREATE INDEX IF NOT EXISTS profile_pinned_miis_user_position_idx
  ON public.profile_pinned_miis (user_id, position);

ALTER TABLE public.profile_pinned_miis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_pinned_miis_select" ON public.profile_pinned_miis;
CREATE POLICY "profile_pinned_miis_select" ON public.profile_pinned_miis
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profile_pinned_miis_insert" ON public.profile_pinned_miis;
CREATE POLICY "profile_pinned_miis_insert" ON public.profile_pinned_miis
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.miis m
      WHERE m.id = mii_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "profile_pinned_miis_delete" ON public.profile_pinned_miis;
CREATE POLICY "profile_pinned_miis_delete" ON public.profile_pinned_miis
  FOR DELETE USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.profile_pinned_miis_enforce_max()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  pin_count int;
BEGIN
  SELECT count(*)::int INTO pin_count
  FROM public.profile_pinned_miis
  WHERE user_id = NEW.user_id;

  IF pin_count >= 6 THEN
    RAISE EXCEPTION 'Maximum 6 pinned Miis allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_pinned_miis_enforce_max ON public.profile_pinned_miis;
CREATE TRIGGER profile_pinned_miis_enforce_max
  BEFORE INSERT ON public.profile_pinned_miis
  FOR EACH ROW EXECUTE FUNCTION public.profile_pinned_miis_enforce_max();

-- User favorites (bookmarks, separate from yeah)
CREATE TABLE IF NOT EXISTS public.user_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mii_id uuid NOT NULL REFERENCES public.miis(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mii_id)
);

CREATE INDEX IF NOT EXISTS user_favorites_user_created_idx
  ON public.user_favorites (user_id, created_at DESC);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_favorites_select" ON public.user_favorites;
CREATE POLICY "user_favorites_select" ON public.user_favorites
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "user_favorites_insert" ON public.user_favorites;
CREATE POLICY "user_favorites_insert" ON public.user_favorites
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_favorites_delete" ON public.user_favorites;
CREATE POLICY "user_favorites_delete" ON public.user_favorites
  FOR DELETE USING (user_id = auth.uid());

-- Notifications
DO $$ BEGIN
  CREATE TYPE public.notification_type_enum AS ENUM ('comment', 'yeah', 'favorite');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type public.notification_type_enum NOT NULL,
  mii_id uuid NOT NULL REFERENCES public.miis(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_unread_idx
  ON public.notifications (recipient_id)
  WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

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
  IF p_recipient_id IS NULL THEN
    RETURN;
  END IF;

  IF p_actor_id IS NOT NULL AND p_actor_id = p_recipient_id THEN
    RETURN;
  END IF;

  SELECT CASE p_type
    WHEN 'comment' THEN notify_comments
    WHEN 'yeah' THEN notify_yeahs
    WHEN 'favorite' THEN notify_favorites
  END INTO v_notify
  FROM public.profiles
  WHERE id = p_recipient_id;

  IF v_notify IS NOT TRUE THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, actor_id, type, mii_id, comment_id
  ) VALUES (
    p_recipient_id, p_actor_id, p_type, p_mii_id, p_comment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_notification(uuid, uuid, public.notification_type_enum, uuid, uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.miis WHERE id = NEW.mii_id;
  PERFORM public.create_notification(
    v_owner_id, NEW.user_id, 'comment', NEW.mii_id, NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_comment ON public.comments;
CREATE TRIGGER notify_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

CREATE OR REPLACE FUNCTION public.notify_on_user_favorite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT user_id INTO v_owner_id FROM public.miis WHERE id = NEW.mii_id;
  PERFORM public.create_notification(
    v_owner_id, NEW.user_id, 'favorite', NEW.mii_id, NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_on_user_favorite ON public.user_favorites;
CREATE TRIGGER notify_on_user_favorite
  AFTER INSERT ON public.user_favorites
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_user_favorite();

-- Owner content updates on miis
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

  -- Owner may edit content (name, appearance, platform, etc.)
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

  -- Stats-only path for RPC
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

DROP TRIGGER IF EXISTS miis_guard_stats_update ON public.miis;
DROP TRIGGER IF EXISTS miis_guard_update ON public.miis;
CREATE TRIGGER miis_guard_update
  BEFORE UPDATE ON public.miis
  FOR EACH ROW EXECUTE FUNCTION public.miis_guard_update();

DROP POLICY IF EXISTS "miis_update_owner" ON public.miis;
CREATE POLICY "miis_update_owner" ON public.miis
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "miis_delete_owner" ON public.miis;
CREATE POLICY "miis_delete_owner" ON public.miis
  FOR DELETE USING (auth.uid() = user_id);

-- Extend increment_mii_stat to notify on yeah
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
