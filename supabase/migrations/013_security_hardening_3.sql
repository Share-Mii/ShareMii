-- Media URL ownership, safe uploads, markup constraints, comment hygiene.

-- ---------------------------------------------------------------------------
-- Profiles: avatar/banner URLs must point at the owner's folder
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Comments: reject obvious HTML / control characters
-- ---------------------------------------------------------------------------
ALTER TABLE public.comments
  DROP CONSTRAINT IF EXISTS comments_body_safe_text;

ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_safe_text CHECK (
    body !~ '[\x00-\x08\x0B\x0C\x0E-\x1F]'
    AND body !~ '[<>]'
  );

-- ---------------------------------------------------------------------------
-- Miis: no angle brackets in display fields (stored XSS defense in depth)
-- ---------------------------------------------------------------------------
ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_name_no_markup;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_name_no_markup CHECK (name !~ '[<>]') NOT VALID;

ALTER TABLE public.miis
  DROP CONSTRAINT IF EXISTS miis_description_no_markup;

ALTER TABLE public.miis
  ADD CONSTRAINT miis_description_no_markup CHECK (description !~ '[<>]') NOT VALID;

-- ---------------------------------------------------------------------------
-- Storage: profile images only (jpeg/png/webp)
-- ---------------------------------------------------------------------------
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
