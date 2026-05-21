-- ShareMii schema sync (idempotent — safe to run on every `npm run dev`)
-- Keeps remote DB in sync with this file without duplicate migration history errors.

DO $$ BEGIN
  CREATE TYPE public.platform_enum AS ENUM ('wii', '3ds', 'wiiu', 'switch');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.gender_enum AS ENUM ('male', 'female', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.miis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  creator_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  platform public.platform_enum NOT NULL,
  mii_data text NOT NULL,
  mii_data_download text,
  favorites int NOT NULL DEFAULT 0,
  downloads int NOT NULL DEFAULT 0,
  views int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mii_id uuid NOT NULL REFERENCES public.miis(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS miis_created_at_idx ON public.miis (created_at DESC);
CREATE INDEX IF NOT EXISTS miis_platform_idx ON public.miis (platform);
CREATE INDEX IF NOT EXISTS comments_mii_id_idx ON public.comments (mii_id, created_at);

ALTER TABLE public.miis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "miis_select" ON public.miis;
CREATE POLICY "miis_select" ON public.miis FOR SELECT USING (true);

DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (true);

-- Add column on existing projects (idempotent)
ALTER TABLE public.miis ADD COLUMN IF NOT EXISTS mii_data_download text;
ALTER TABLE public.miis ADD COLUMN IF NOT EXISTS gender public.gender_enum;

CREATE INDEX IF NOT EXISTS miis_gender_idx ON public.miis (gender);

-- Profiles, Mii attribution, and profile media storage
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL DEFAULT '',
  username_normalized text,
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  banner_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_normalized_idx
  ON public.profiles (username_normalized)
  WHERE username_normalized IS NOT NULL AND username_normalized <> '';

ALTER TABLE public.miis ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS miis_user_id_idx ON public.miis (user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

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

DROP POLICY IF EXISTS "miis_insert" ON public.miis;
CREATE POLICY "miis_insert" ON public.miis
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.miis_set_uploader()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_username text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to upload a Mii';
  END IF;

  NEW.user_id := auth.uid();

  SELECT username INTO profile_username
  FROM public.profiles
  WHERE id = auth.uid();

  IF profile_username IS NULL OR trim(profile_username) = '' THEN
    RAISE EXCEPTION 'Set your gamertag in Profile before uploading';
  END IF;

  NEW.creator_name := profile_username;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS miis_set_uploader ON public.miis;
CREATE TRIGGER miis_set_uploader
  BEFORE INSERT ON public.miis
  FOR EACH ROW EXECUTE FUNCTION public.miis_set_uploader();

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-media', 'profile-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public bucket URLs work without a broad SELECT policy (avoids listing all avatars/banners)

DROP POLICY IF EXISTS "profile_media_select" ON storage.objects;

DROP POLICY IF EXISTS "profile_media_insert" ON storage.objects;
CREATE POLICY "profile_media_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

DROP POLICY IF EXISTS "profile_media_update" ON storage.objects;
CREATE POLICY "profile_media_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'profile-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND lower(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'webp')
  );

DROP POLICY IF EXISTS "profile_media_delete" ON storage.objects;
CREATE POLICY "profile_media_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Security hardening (see migrations/003_security_hardening.sql)
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_body_length;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_length CHECK (char_length(body) BETWEEN 1 AND 500);

ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_author_name_length;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_author_name_length CHECK (char_length(author_name) BETWEEN 1 AND 64);

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.miis m WHERE m.id = mii_id)
    AND char_length(trim(body)) >= 1
    AND char_length(body) <= 500
    AND char_length(trim(author_name)) >= 1
    AND char_length(author_name) <= 64
  );

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

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

DROP TRIGGER IF EXISTS comments_set_author ON public.comments;
CREATE TRIGGER comments_set_author
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_set_author();

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

DROP TRIGGER IF EXISTS miis_guard_stats_update ON public.miis;
DROP TRIGGER IF EXISTS miis_guard_update ON public.miis;
CREATE TRIGGER miis_guard_update
  BEFORE UPDATE ON public.miis
  FOR EACH ROW EXECUTE FUNCTION public.miis_guard_update();

DROP POLICY IF EXISTS "miis_update_stats" ON public.miis;

DROP POLICY IF EXISTS "miis_update_owner" ON public.miis;
CREATE POLICY "miis_update_owner" ON public.miis
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "miis_delete_owner" ON public.miis;
CREATE POLICY "miis_delete_owner" ON public.miis
  FOR DELETE USING (auth.uid() = user_id);

REVOKE ALL ON FUNCTION public.comments_set_author() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.miis_set_uploader() FROM PUBLIC, anon, authenticated;

-- Stat rate limits (see migrations/004_stat_rate_limits.sql)
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

DROP INDEX IF EXISTS public.mii_stat_events_browser_mii_stat_idx;
CREATE UNIQUE INDEX mii_stat_events_browser_mii_stat_idx
  ON public.mii_stat_events (mii_id, stat, browser_token)
  WHERE stat IN ('downloads', 'favorites');

ALTER TABLE public.mii_stat_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mii_stat_events_insert" ON public.mii_stat_events;

REVOKE INSERT ON public.mii_stat_events FROM anon, authenticated;

DROP POLICY IF EXISTS "mii_stat_events_select_own" ON public.mii_stat_events;

CREATE POLICY "mii_stat_events_select_own" ON public.mii_stat_events
  FOR SELECT USING (user_id = auth.uid());

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

-- Social features (see migrations/005_social_features.sql)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_comments boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_yeahs boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_favorites boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_hidden boolean NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE public.notification_type_enum AS ENUM ('comment', 'yeah', 'favorite');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

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
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles owner_profile
      WHERE owner_profile.id = profile_pinned_miis.user_id
        AND NOT owner_profile.profile_hidden
    )
    OR public.is_staff()
  );

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
  PERFORM 1 FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;

  SELECT count(*)::int INTO pin_count
  FROM public.profile_pinned_miis
  WHERE user_id = NEW.user_id;

  IF pin_count >= 6 THEN
    RAISE EXCEPTION 'Maximum 6 pinned Miis allowed';
  END IF;

  IF NEW.position < 1 OR NEW.position > 6 THEN
    RAISE EXCEPTION 'Invalid pin position';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_pinned_miis_enforce_max ON public.profile_pinned_miis;
CREATE TRIGGER profile_pinned_miis_enforce_max
  BEFORE INSERT ON public.profile_pinned_miis
  FOR EACH ROW EXECUTE FUNCTION public.profile_pinned_miis_enforce_max();

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

-- Re-apply increment_mii_stat now that create_notification exists
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

-- Additional hardening (see migrations/012_security_hardening_2.sql)
ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_name_length;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 32) NOT VALID;

ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_description_length;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_description_length CHECK (char_length(description) <= 500);

ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_data_length;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_data_length CHECK (char_length(mii_data) <= 524288);

ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_data_download_length;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_data_download_length CHECK (
    mii_data_download IS NULL OR char_length(mii_data_download) <= 1048576
  );

CREATE OR REPLACE FUNCTION public.profiles_validate_media_urls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  folder_id uuid;
  path_re constant text :=
    '^https://[^/]+/storage/v1/object/public/profile-media/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/';
BEGIN
  IF NEW.avatar_url IS NOT NULL THEN
    IF NEW.avatar_url !~ path_re THEN
      RAISE EXCEPTION 'Invalid avatar URL';
    END IF;

    folder_id := (regexp_match(NEW.avatar_url, path_re))[1]::uuid;
    IF folder_id IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'Avatar URL must belong to your profile';
    END IF;
  END IF;

  IF NEW.banner_url IS NOT NULL THEN
    IF NEW.banner_url !~ path_re THEN
      RAISE EXCEPTION 'Invalid banner URL';
    END IF;

    folder_id := (regexp_match(NEW.banner_url, path_re))[1]::uuid;
    IF folder_id IS DISTINCT FROM NEW.id THEN
      RAISE EXCEPTION 'Banner URL must belong to your profile';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_media_urls ON public.profiles;
CREATE TRIGGER profiles_validate_media_urls
  BEFORE INSERT OR UPDATE OF avatar_url, banner_url ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_validate_media_urls();

REVOKE ALL ON FUNCTION public.profiles_validate_media_urls() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notifications_guard_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
    OR NEW.actor_id IS DISTINCT FROM OLD.actor_id
    OR NEW.type IS DISTINCT FROM OLD.type
    OR NEW.mii_id IS DISTINCT FROM OLD.mii_id
    OR NEW.comment_id IS DISTINCT FROM OLD.comment_id
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Notifications cannot be modified';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_guard_update ON public.notifications;
CREATE TRIGGER notifications_guard_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.notifications_guard_update();

REVOKE ALL ON FUNCTION public.notifications_guard_update() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.comments_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*)::int INTO recent_count
  FROM public.comments
  WHERE user_id = auth.uid()
    AND created_at > now() - interval '1 hour';

  IF recent_count >= 30 THEN
    RAISE EXCEPTION 'Comment rate limit exceeded';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_rate_limit ON public.comments;
CREATE TRIGGER comments_rate_limit
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_rate_limit();

REVOKE ALL ON FUNCTION public.comments_rate_limit() FROM PUBLIC, anon, authenticated;

-- Markup / upload hardening (see migrations/013_security_hardening_3.sql)
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_body_safe_text;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_safe_text CHECK (
    body !~ '[\x00-\x08\x0B\x0C\x0E-\x1F]'
    AND body !~ '[<>]'
  );

ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_name_no_markup;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_name_no_markup CHECK (name !~ '[<>]') NOT VALID;

ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_description_no_markup;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_description_no_markup CHECK (description !~ '[<>]') NOT VALID;

-- Backfill profiles for existing auth users
INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Admin & moderation: applied via migrations/015 and 016 (see scripts/sync-db.mjs)
