-- ShareMii profiles, storage, and Mii attribution

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

DROP POLICY IF EXISTS "profile_media_select" ON storage.objects;

DROP POLICY IF EXISTS "profile_media_insert" ON storage.objects;
CREATE POLICY "profile_media_insert" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "profile_media_update" ON storage.objects;
CREATE POLICY "profile_media_update" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'profile-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "profile_media_delete" ON storage.objects;
CREATE POLICY "profile_media_delete" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'profile-media'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

INSERT INTO public.profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;
