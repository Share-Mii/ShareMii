-- User data export, account purge, bug reports, and Discord notifications for bugs.

-- ---------------------------------------------------------------------------
-- Bug reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  page_url text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  status public.report_status NOT NULL DEFAULT 'open',
  priority public.report_priority NOT NULL DEFAULT 'normal',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bug_reports_status_created_idx
  ON public.bug_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS bug_reports_reporter_idx
  ON public.bug_reports (reporter_id, created_at DESC);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bug_reports_select_staff" ON public.bug_reports;
CREATE POLICY "bug_reports_select_staff" ON public.bug_reports
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "bug_reports_insert_own" ON public.bug_reports;
CREATE POLICY "bug_reports_insert_own" ON public.bug_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- Export user data (GDPR-style portable copy)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_user_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'user_id', uid,
    'profile', (
      SELECT to_jsonb(p.*) FROM public.profiles p WHERE p.id = uid
    ),
    'profile_private', (
      SELECT to_jsonb(pp.*) FROM public.profile_private pp WHERE pp.user_id = uid
    ),
    'miis', COALESCE((
      SELECT jsonb_agg(to_jsonb(m.*) ORDER BY m.created_at DESC)
      FROM public.miis m WHERE m.user_id = uid
    ), '[]'::jsonb),
    'comments', COALESCE((
      SELECT jsonb_agg(to_jsonb(c.*) ORDER BY c.created_at DESC)
      FROM public.comments c WHERE c.user_id = uid
    ), '[]'::jsonb),
    'favorites', COALESCE((
      SELECT jsonb_agg(to_jsonb(f.*) ORDER BY f.created_at DESC)
      FROM public.user_favorites f WHERE f.user_id = uid
    ), '[]'::jsonb),
    'collections', COALESCE((
      SELECT jsonb_agg(to_jsonb(col.*) ORDER BY col.created_at DESC)
      FROM public.mii_collections col WHERE col.user_id = uid
    ), '[]'::jsonb),
    'collection_items', COALESCE((
      SELECT jsonb_agg(to_jsonb(ci.*))
      FROM public.mii_collection_items ci
      JOIN public.mii_collections col ON col.id = ci.collection_id
      WHERE col.user_id = uid
    ), '[]'::jsonb),
    'follows_following', COALESCE((
      SELECT jsonb_agg(to_jsonb(uf.*) ORDER BY uf.created_at DESC)
      FROM public.user_follows uf WHERE uf.follower_id = uid
    ), '[]'::jsonb),
    'follows_followers', COALESCE((
      SELECT jsonb_agg(to_jsonb(uf.*) ORDER BY uf.created_at DESC)
      FROM public.user_follows uf WHERE uf.following_id = uid
    ), '[]'::jsonb),
    'notifications_received', COALESCE((
      SELECT jsonb_agg(to_jsonb(n.*) ORDER BY n.created_at DESC)
      FROM public.notifications n WHERE n.recipient_id = uid
    ), '[]'::jsonb),
    'content_reports_filed', COALESCE((
      SELECT jsonb_agg(to_jsonb(r.*) ORDER BY r.created_at DESC)
      FROM public.content_reports r WHERE r.reporter_id = uid
    ), '[]'::jsonb),
    'bug_reports_filed', COALESCE((
      SELECT jsonb_agg(to_jsonb(b.*) ORDER BY b.created_at DESC)
      FROM public.bug_reports b WHERE b.reporter_id = uid
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- Purge account content before auth user deletion (called from Edge Function)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_account_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required';
  END IF;

  -- Only the account owner (via Edge Function JWT) or service role should call this.
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.mii_collection_items
  WHERE collection_id IN (
    SELECT id FROM public.mii_collections WHERE user_id = p_user_id
  );

  DELETE FROM public.mii_collections WHERE user_id = p_user_id;
  DELETE FROM public.profile_pinned_miis WHERE user_id = p_user_id;
  DELETE FROM public.user_favorites WHERE user_id = p_user_id;
  DELETE FROM public.user_follows
  WHERE follower_id = p_user_id OR following_id = p_user_id;
  DELETE FROM public.notifications
  WHERE recipient_id = p_user_id OR actor_id = p_user_id;
  DELETE FROM public.comments WHERE user_id = p_user_id;
  DELETE FROM public.miis WHERE user_id = p_user_id;
  DELETE FROM public.content_reports WHERE reporter_id = p_user_id;
  DELETE FROM public.bug_reports WHERE reporter_id = p_user_id;
  DELETE FROM public.content_appeals WHERE appellant_id = p_user_id;
  DELETE FROM public.moderation_auto_flags WHERE user_id = p_user_id;
  DELETE FROM public.user_restrictions WHERE user_id = p_user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Submit bug report
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_bug_report(
  p_title text,
  p_description text,
  p_page_url text DEFAULT '',
  p_user_agent text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_id uuid;
  recent_count int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to submit a bug report';
  END IF;

  IF char_length(trim(COALESCE(p_title, ''))) < 3 THEN
    RAISE EXCEPTION 'Title must be at least 3 characters';
  END IF;

  IF char_length(trim(COALESCE(p_title, ''))) > 120 THEN
    RAISE EXCEPTION 'Title must be 120 characters or fewer';
  END IF;

  IF char_length(trim(COALESCE(p_description, ''))) < 10 THEN
    RAISE EXCEPTION 'Description must be at least 10 characters';
  END IF;

  IF char_length(COALESCE(p_description, '')) > 2000 THEN
    RAISE EXCEPTION 'Description must be 2000 characters or fewer';
  END IF;

  SELECT count(*)::int INTO recent_count
  FROM public.bug_reports
  WHERE reporter_id = auth.uid()
    AND created_at > now() - interval '1 day';

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Bug report limit exceeded. Try again tomorrow.';
  END IF;

  INSERT INTO public.bug_reports (
    reporter_id, title, description, page_url, user_agent
  )
  VALUES (
    auth.uid(),
    trim(p_title),
    trim(p_description),
    left(COALESCE(p_page_url, ''), 500),
    left(COALESCE(p_user_agent, ''), 500)
  )
  RETURNING id INTO report_id;

  RETURN report_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Staff bug report management
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_bug_reports(
  p_status public.report_status DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t.*)::jsonb ORDER BY t.created_at DESC)
    FROM (
      SELECT
        b.id,
        b.reporter_id,
        b.title,
        b.description,
        b.page_url,
        b.user_agent,
        b.status,
        b.priority,
        b.assigned_to,
        b.resolved_at,
        b.resolved_by,
        b.resolution_note,
        b.created_at,
        p.username AS reporter_username
      FROM public.bug_reports b
      LEFT JOIN public.profiles p ON p.id = b.reporter_id
      WHERE (p_status IS NULL OR b.status = p_status)
      ORDER BY b.created_at DESC
      LIMIT LEAST(GREATEST(p_limit, 1), 100)
      OFFSET GREATEST(p_offset, 0)
    ) t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_bug_report(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row_data jsonb;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  SELECT jsonb_build_object(
    'report', jsonb_build_object(
      'id', b.id,
      'reporter_id', b.reporter_id,
      'title', b.title,
      'description', b.description,
      'page_url', b.page_url,
      'user_agent', b.user_agent,
      'status', b.status,
      'priority', b.priority,
      'assigned_to', b.assigned_to,
      'resolved_at', b.resolved_at,
      'resolved_by', b.resolved_by,
      'resolution_note', b.resolution_note,
      'created_at', b.created_at,
      'reporter_username', p.username
    )
  ) INTO row_data
  FROM public.bug_reports b
  LEFT JOIN public.profiles p ON p.id = b.reporter_id
  WHERE b.id = p_report_id;

  IF row_data IS NULL THEN
    RAISE EXCEPTION 'Bug report not found';
  END IF;

  RETURN row_data;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_bug_report(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  UPDATE public.bug_reports
  SET
    status = CASE WHEN status = 'open' THEN 'in_review'::public.report_status ELSE status END,
    assigned_to = auth.uid()
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bug report not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_bug_report(
  p_report_id uuid,
  p_status public.report_status,
  p_note text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  IF p_status NOT IN ('resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Status must be resolved or dismissed';
  END IF;

  UPDATE public.bug_reports
  SET
    status = p_status,
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution_note = left(COALESCE(p_note, ''), 1000)
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bug report not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_bug_report_priority(
  p_report_id uuid,
  p_priority public.report_priority
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  UPDATE public.bug_reports SET priority = p_priority WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bug report not found';
  END IF;
END;
$$;

-- Bug report Discord notifications: see migration 027_discord_bug_notifications.sql

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.export_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_user_data() TO authenticated;

REVOKE ALL ON FUNCTION public.purge_account_data(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_account_data(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_bug_report(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_bug_report(text, text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_bug_reports(public.report_status, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_bug_reports(public.report_status, int, int) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_get_bug_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_bug_report(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_assign_bug_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_bug_report(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_resolve_bug_report(uuid, public.report_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_bug_report(uuid, public.report_status, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_bug_report_priority(uuid, public.report_priority) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_bug_report_priority(uuid, public.report_priority) TO authenticated;
