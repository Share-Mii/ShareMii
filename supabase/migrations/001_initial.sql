-- ShareMii initial migration (mirrors supabase/sync.sql)
-- Dev uses sync.sql on every `npm run dev`; this file is for `supabase db push` history.

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
  gender public.gender_enum,
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
CREATE INDEX IF NOT EXISTS miis_gender_idx ON public.miis (gender);
CREATE INDEX IF NOT EXISTS comments_mii_id_idx ON public.comments (mii_id, created_at);

ALTER TABLE public.miis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "miis_select" ON public.miis;
CREATE POLICY "miis_select" ON public.miis FOR SELECT USING (true);

DROP POLICY IF EXISTS "miis_insert" ON public.miis;
CREATE POLICY "miis_insert" ON public.miis FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert" ON public.comments FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.increment_mii_stat(mii_id uuid, stat text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text) TO authenticated;
