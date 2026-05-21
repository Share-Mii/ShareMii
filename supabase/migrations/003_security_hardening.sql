-- Tighten RLS and RPC exposure (Supabase security advisor)

-- Miis: require authenticated uploader (replaces any legacy WITH CHECK (true) policy)
DROP POLICY IF EXISTS "miis_insert" ON public.miis;
CREATE POLICY "miis_insert" ON public.miis
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Comments: authenticated users only; validate shape at the database layer
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
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comments_set_author ON public.comments;
CREATE TRIGGER comments_set_author
  BEFORE INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.comments_set_author();

-- Miis: only allow +1 stat bumps; block edits to content/ownership via direct UPDATE
CREATE OR REPLACE FUNCTION public.miis_guard_stats_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  stat_delta int;
BEGIN
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
CREATE TRIGGER miis_guard_stats_update
  BEFORE UPDATE ON public.miis
  FOR EACH ROW EXECUTE FUNCTION public.miis_guard_stats_update();

DROP POLICY IF EXISTS "miis_update_stats" ON public.miis;
CREATE POLICY "miis_update_stats" ON public.miis
  FOR UPDATE
  USING (
    views IS NOT NULL
    AND downloads IS NOT NULL
    AND favorites IS NOT NULL
  )
  WITH CHECK (
    views IS NOT NULL
    AND downloads IS NOT NULL
    AND favorites IS NOT NULL
  );

-- Trigger helpers are not RPC endpoints; block direct execution via PostgREST
REVOKE ALL ON FUNCTION public.comments_set_author() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.miis_set_uploader() FROM PUBLIC, anon, authenticated;

-- Stat RPC: run as caller so RLS + trigger apply (not SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.increment_mii_stat(mii_id uuid, stat text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF stat = 'views' THEN
    UPDATE public.miis SET views = views + 1 WHERE id = mii_id;
  ELSIF stat = 'downloads' THEN
    UPDATE public.miis SET downloads = downloads + 1 WHERE id = mii_id;
  ELSIF stat = 'favorites' THEN
    UPDATE public.miis SET favorites = favorites + 1 WHERE id = mii_id;
  ELSE
    RAISE EXCEPTION 'invalid stat: %', stat;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'mii not found: %', mii_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_mii_stat(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text) TO authenticated;

-- Public bucket object URLs do not require a bucket-wide SELECT policy
DROP POLICY IF EXISTS "profile_media_select" ON storage.objects;
