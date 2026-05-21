-- Content limits, media URL validation, notification/pin guards, comment rate limits.

-- ---------------------------------------------------------------------------
-- Miis: length limits (match client)
-- ---------------------------------------------------------------------------
ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_name_length;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 10) NOT VALID;

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

-- ---------------------------------------------------------------------------
-- Profiles: only allow profile-media bucket URLs (or null)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_validate_media_urls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.avatar_url IS NOT NULL
    AND NEW.avatar_url !~ '^https://[^/]+/storage/v1/object/public/profile-media/[0-9a-f-]{36}/'
  THEN
    RAISE EXCEPTION 'Invalid avatar URL';
  END IF;

  IF NEW.banner_url IS NOT NULL
    AND NEW.banner_url !~ '^https://[^/]+/storage/v1/object/public/profile-media/[0-9a-f-]{36}/'
  THEN
    RAISE EXCEPTION 'Invalid banner URL';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_media_urls ON public.profiles;
CREATE TRIGGER profiles_validate_media_urls
  BEFORE INSERT OR UPDATE OF avatar_url, banner_url ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_validate_media_urls();

REVOKE ALL ON FUNCTION public.profiles_validate_media_urls() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notifications: recipients may only mark read (not rewrite payload)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Comments: per-account hourly rate limit
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Pinned Miis: prevent race past 6 pins
-- ---------------------------------------------------------------------------
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
