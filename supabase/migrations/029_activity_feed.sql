-- Activity feed: remix lineage, activity_events, emit triggers, fetch_activity_feed RPC

-- ---------------------------------------------------------------------------
-- Remix lineage
-- ---------------------------------------------------------------------------
ALTER TABLE public.miis
  ADD COLUMN IF NOT EXISTS remix_of_mii_id uuid
  REFERENCES public.miis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS miis_remix_of_idx ON public.miis (remix_of_mii_id)
  WHERE remix_of_mii_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Activity events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN ('yeah', 'submit', 'remix', 'comment', 'collection_add')
  ),
  target_mii_id uuid REFERENCES public.miis(id) ON DELETE CASCADE,
  related_mii_id uuid REFERENCES public.miis(id) ON DELETE SET NULL,
  target_collection_id uuid REFERENCES public.mii_collections(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_events_actor_created_idx
  ON public.activity_events (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS activity_events_created_id_idx
  ON public.activity_events (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS activity_events_target_mii_created_idx
  ON public.activity_events (target_mii_id, created_at DESC)
  WHERE target_mii_id IS NOT NULL;

ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Reads only via fetch_activity_feed (SECURITY DEFINER)

-- ---------------------------------------------------------------------------
-- record_activity_event helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_activity_event(
  p_actor_id uuid,
  p_event_type text,
  p_target_mii_id uuid DEFAULT NULL,
  p_related_mii_id uuid DEFAULT NULL,
  p_target_collection_id uuid DEFAULT NULL,
  p_comment_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mii_visibility public.content_visibility;
  v_mii_owner uuid;
  v_collection_public boolean;
BEGIN
  IF p_actor_id IS NULL THEN
    RETURN;
  END IF;

  IF p_event_type NOT IN ('yeah', 'submit', 'remix', 'comment', 'collection_add') THEN
    RETURN;
  END IF;

  IF p_target_mii_id IS NOT NULL THEN
    SELECT visibility, user_id
    INTO v_mii_visibility, v_mii_owner
    FROM public.miis
    WHERE id = p_target_mii_id;

    IF NOT FOUND THEN
      RETURN;
    END IF;

    IF v_mii_visibility IS DISTINCT FROM 'public'::public.content_visibility THEN
      RETURN;
    END IF;

    IF p_event_type = 'yeah' AND v_mii_owner = p_actor_id THEN
      RETURN;
    END IF;

    IF p_event_type = 'remix' AND v_mii_owner = p_actor_id THEN
      RETURN;
    END IF;
  END IF;

  IF p_related_mii_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.miis
      WHERE id = p_related_mii_id
        AND visibility = 'public'::public.content_visibility
    ) THEN
      RETURN;
    END IF;
  END IF;

  IF p_target_collection_id IS NOT NULL THEN
    SELECT is_public INTO v_collection_public
    FROM public.mii_collections
    WHERE id = p_target_collection_id;

    IF NOT FOUND OR v_collection_public IS NOT TRUE THEN
      RETURN;
    END IF;
  END IF;

  IF p_event_type = 'comment' AND p_comment_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comments
      WHERE id = p_comment_id
        AND visibility = 'public'::public.content_visibility
    ) THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.activity_events (
    actor_id,
    event_type,
    target_mii_id,
    related_mii_id,
    target_collection_id,
    comment_id
  ) VALUES (
    p_actor_id,
    p_event_type,
    p_target_mii_id,
    p_related_mii_id,
    p_target_collection_id,
    p_comment_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_activity_event(
  uuid, text, uuid, uuid, uuid, uuid
) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Emit triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activity_on_stat_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stat = 'favorites' AND NEW.user_id IS NOT NULL THEN
    PERFORM public.record_activity_event(
      NEW.user_id, 'yeah', NEW.mii_id, NULL, NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_on_stat_event ON public.mii_stat_events;
CREATE TRIGGER activity_on_stat_event
  AFTER INSERT ON public.mii_stat_events
  FOR EACH ROW EXECUTE FUNCTION public.activity_on_stat_event();

CREATE OR REPLACE FUNCTION public.activity_on_mii_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.visibility IS DISTINCT FROM 'public'::public.content_visibility THEN
    RETURN NEW;
  END IF;

  IF NEW.remix_of_mii_id IS NOT NULL THEN
    PERFORM public.record_activity_event(
      NEW.user_id,
      'remix',
      NEW.remix_of_mii_id,
      NEW.id,
      NULL,
      NULL
    );
  ELSE
    PERFORM public.record_activity_event(
      NEW.user_id, 'submit', NEW.id, NULL, NULL, NULL
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_on_mii_insert ON public.miis;
CREATE TRIGGER activity_on_mii_insert
  AFTER INSERT ON public.miis
  FOR EACH ROW EXECUTE FUNCTION public.activity_on_mii_insert();

CREATE OR REPLACE FUNCTION public.activity_on_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.visibility IS DISTINCT FROM 'public'::public.content_visibility THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.record_activity_event(
    NEW.user_id, 'comment', NEW.mii_id, NULL, NULL, NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_on_comment ON public.comments;
CREATE TRIGGER activity_on_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.activity_on_comment();

CREATE OR REPLACE FUNCTION public.activity_on_collection_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_is_public boolean;
BEGIN
  SELECT c.user_id, c.is_public
  INTO v_owner_id, v_is_public
  FROM public.mii_collections c
  WHERE c.id = NEW.collection_id;

  IF NOT FOUND OR v_is_public IS NOT TRUE OR v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.record_activity_event(
    v_owner_id,
    'collection_add',
    NEW.mii_id,
    NULL,
    NEW.collection_id,
    NULL
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activity_on_collection_item ON public.mii_collection_items;
CREATE TRIGGER activity_on_collection_item
  AFTER INSERT ON public.mii_collection_items
  FOR EACH ROW EXECUTE FUNCTION public.activity_on_collection_item();

-- ---------------------------------------------------------------------------
-- fetch_activity_feed RPC
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fetch_activity_feed(
  p_limit int DEFAULT 30,
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
  v_uid uuid := auth.uid();
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 50);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

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
    AND (
      (
        ae.event_type IN ('yeah', 'submit', 'collection_add')
        AND ae.actor_id IN (
          SELECT uf.following_id
          FROM public.user_follows uf
          WHERE uf.follower_id = v_uid
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
    AND (
      ae.target_mii_id IS NULL
      OR tm.visibility = 'public'::public.content_visibility
      OR tm.user_id = v_uid
    )
    AND (
      ae.related_mii_id IS NULL
      OR rm.visibility = 'public'::public.content_visibility
      OR rm.user_id = v_uid
    )
    AND (
      ae.target_collection_id IS NULL
      OR col.is_public
      OR col.user_id = v_uid
    )
    AND (
      p_cursor_created_at IS NULL
      OR p_cursor_id IS NULL
      OR (ae.created_at, ae.id) < (p_cursor_created_at, p_cursor_id)
    )
  ORDER BY ae.created_at DESC, ae.id DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.fetch_activity_feed(int, timestamptz, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_activity_feed(int, timestamptz, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.activity_on_stat_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activity_on_mii_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activity_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.activity_on_collection_item() FROM PUBLIC, anon, authenticated;
