-- Roadmap: social graph, tags, collections, comment replies, appeals, trusted creators, auto-flag

-- Comment replies
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON public.comments (parent_id);

-- Trusted creator flag
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trusted_creator boolean NOT NULL DEFAULT false;

-- Follow graph
CREATE TABLE IF NOT EXISTS public.user_follows (
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT user_follows_no_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS user_follows_following_idx ON public.user_follows (following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_follows_select" ON public.user_follows;
CREATE POLICY "user_follows_select" ON public.user_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "user_follows_insert" ON public.user_follows;
CREATE POLICY "user_follows_insert" ON public.user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "user_follows_delete" ON public.user_follows;
CREATE POLICY "user_follows_delete" ON public.user_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Tags
CREATE TABLE IF NOT EXISTS public.mii_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mii_tag_links (
  mii_id uuid NOT NULL REFERENCES public.miis(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.mii_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (mii_id, tag_id)
);

CREATE INDEX IF NOT EXISTS mii_tag_links_tag_idx ON public.mii_tag_links (tag_id);

ALTER TABLE public.mii_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mii_tag_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mii_tags_select" ON public.mii_tags;
CREATE POLICY "mii_tags_select" ON public.mii_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "mii_tag_links_select" ON public.mii_tag_links;
CREATE POLICY "mii_tag_links_select" ON public.mii_tag_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "mii_tag_links_insert" ON public.mii_tag_links;
CREATE POLICY "mii_tag_links_insert" ON public.mii_tag_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.miis m
      WHERE m.id = mii_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "mii_tag_links_delete" ON public.mii_tag_links;
CREATE POLICY "mii_tag_links_delete" ON public.mii_tag_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.miis m
      WHERE m.id = mii_id AND m.user_id = auth.uid()
    )
  );

-- Collections
CREATE TABLE IF NOT EXISTS public.mii_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.mii_collection_items (
  collection_id uuid NOT NULL REFERENCES public.mii_collections(id) ON DELETE CASCADE,
  mii_id uuid NOT NULL REFERENCES public.miis(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, mii_id)
);

CREATE INDEX IF NOT EXISTS mii_collections_user_idx ON public.mii_collections (user_id);

ALTER TABLE public.mii_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mii_collection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mii_collections_select" ON public.mii_collections;
CREATE POLICY "mii_collections_select" ON public.mii_collections
  FOR SELECT USING (is_public OR user_id = auth.uid());

DROP POLICY IF EXISTS "mii_collections_insert" ON public.mii_collections;
CREATE POLICY "mii_collections_insert" ON public.mii_collections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mii_collections_update" ON public.mii_collections;
CREATE POLICY "mii_collections_update" ON public.mii_collections
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mii_collections_delete" ON public.mii_collections;
CREATE POLICY "mii_collections_delete" ON public.mii_collections
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mii_collection_items_select" ON public.mii_collection_items;
CREATE POLICY "mii_collection_items_select" ON public.mii_collection_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.mii_collections c
      WHERE c.id = collection_id AND (c.is_public OR c.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "mii_collection_items_mutate" ON public.mii_collection_items;
CREATE POLICY "mii_collection_items_mutate" ON public.mii_collection_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.mii_collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );

-- Content appeals
CREATE TABLE IF NOT EXISTS public.content_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appellant_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('mii', 'comment')),
  target_id uuid NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'denied')),
  staff_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS content_appeals_status_idx ON public.content_appeals (status, created_at DESC);

ALTER TABLE public.content_appeals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_appeals_select_own" ON public.content_appeals;
CREATE POLICY "content_appeals_select_own" ON public.content_appeals
  FOR SELECT USING (auth.uid() = appellant_id);

DROP POLICY IF EXISTS "content_appeals_insert" ON public.content_appeals;
CREATE POLICY "content_appeals_insert" ON public.content_appeals
  FOR INSERT WITH CHECK (auth.uid() = appellant_id);

-- Seed default tags
INSERT INTO public.mii_tags (slug, label) VALUES
  ('cosplay', 'Cosplay'),
  ('celebrity', 'Celebrity'),
  ('game', 'Game character'),
  ('original', 'Original'),
  ('funny', 'Funny'),
  ('cute', 'Cute')
ON CONFLICT (slug) DO NOTHING;

-- Notification type: mention
DO $$ BEGIN
  ALTER TYPE public.notification_type_enum ADD VALUE IF NOT EXISTS 'mention';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Auto-flag duplicate mii_data uploads
CREATE OR REPLACE FUNCTION public.auto_flag_duplicate_mii()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dup_count int;
BEGIN
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

DROP TRIGGER IF EXISTS miis_auto_flag_duplicate ON public.miis;
CREATE TRIGGER miis_auto_flag_duplicate
  AFTER INSERT ON public.miis
  FOR EACH ROW
  WHEN (NEW.visibility = 'public')
  EXECUTE FUNCTION public.auto_flag_duplicate_mii();

-- Staff: set trusted creator
CREATE OR REPLACE FUNCTION public.staff_set_trusted_creator(
  p_user_id uuid,
  p_trusted boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  UPDATE public.profiles SET trusted_creator = p_trusted WHERE id = p_user_id;
END;
$$;

-- Bulk dismiss reports (staff)
CREATE OR REPLACE FUNCTION public.staff_bulk_dismiss_reports(
  p_report_ids uuid[]
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff only';
  END IF;
  UPDATE public.content_reports
  SET status = 'dismissed', resolved_at = now()
  WHERE id = ANY(p_report_ids) AND status IN ('open', 'in_review');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
