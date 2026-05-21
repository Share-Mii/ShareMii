-- Reports, moderation, visibility, restrictions, and staff RPCs

DO $$ BEGIN
  CREATE TYPE public.content_visibility AS ENUM ('public', 'hidden', 'removed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.report_target_type AS ENUM ('mii', 'comment', 'profile');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.report_reason AS ENUM (
    'spam', 'harassment', 'impersonation', 'inappropriate',
    'copyright', 'child_safety', 'other'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('open', 'in_review', 'resolved', 'dismissed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.report_priority AS ENUM ('low', 'normal', 'high', 'urgent');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.restriction_type AS ENUM (
    'upload_ban', 'comment_ban', 'shadow', 'full_suspend'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.miis
  ADD COLUMN IF NOT EXISTS visibility public.content_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS hidden_reason text,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS visibility public.content_visibility NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS hidden_reason text,
  ADD COLUMN IF NOT EXISTS hidden_at timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type public.report_target_type NOT NULL,
  target_id uuid NOT NULL,
  reason public.report_reason NOT NULL,
  details text NOT NULL DEFAULT '',
  status public.report_status NOT NULL DEFAULT 'open',
  priority public.report_priority NOT NULL DEFAULT 'normal',
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT content_reports_details_length CHECK (char_length(details) <= 500),
  CONSTRAINT content_reports_resolution_note_length CHECK (char_length(resolution_note) <= 500)
);

CREATE INDEX IF NOT EXISTS content_reports_status_created_idx
  ON public.content_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS content_reports_target_idx
  ON public.content_reports (target_type, target_id);

CREATE UNIQUE INDEX IF NOT EXISTS content_reports_open_dedupe_idx
  ON public.content_reports (reporter_id, target_type, target_id)
  WHERE status IN ('open', 'in_review');

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS moderation_actions_created_idx
  ON public.moderation_actions (created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_actions_actor_idx
  ON public.moderation_actions (actor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  restriction_type public.restriction_type NOT NULL,
  expires_at timestamptz,
  reason text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  lifted_at timestamptz,
  lifted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_restrictions_active_idx
  ON public.user_restrictions (user_id)
  WHERE lifted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.site_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning')),
  active_from timestamptz NOT NULL DEFAULT now(),
  active_until timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "content_reports_insert_own" ON public.content_reports;
CREATE POLICY "content_reports_insert_own" ON public.content_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "content_reports_select_own" ON public.content_reports;
CREATE POLICY "content_reports_select_own" ON public.content_reports
  FOR SELECT USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "content_reports_select_staff" ON public.content_reports;
CREATE POLICY "content_reports_select_staff" ON public.content_reports
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "moderation_actions_select_staff" ON public.moderation_actions;
CREATE POLICY "moderation_actions_select_staff" ON public.moderation_actions
  FOR SELECT USING (
    public.is_admin()
    OR (public.is_staff() AND actor_id = auth.uid())
  );

DROP POLICY IF EXISTS "user_restrictions_select_staff" ON public.user_restrictions;
CREATE POLICY "user_restrictions_select_staff" ON public.user_restrictions
  FOR SELECT USING (public.is_staff());

DROP POLICY IF EXISTS "site_announcements_select" ON public.site_announcements;
CREATE POLICY "site_announcements_select" ON public.site_announcements
  FOR SELECT USING (true);

-- Public content visibility
DROP POLICY IF EXISTS "miis_select" ON public.miis;
CREATE POLICY "miis_select" ON public.miis
  FOR SELECT USING (
    visibility = 'public'
    OR public.is_staff()
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select" ON public.comments
  FOR SELECT USING (
    visibility = 'public'
    OR public.is_staff()
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    NOT profile_hidden
    OR public.is_staff()
    OR auth.uid() = id
  );

-- ---------------------------------------------------------------------------
-- Restriction checks
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_has_active_restriction(
  p_user_id uuid,
  p_type public.restriction_type
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_restrictions r
    WHERE r.user_id = p_user_id
      AND r.restriction_type = p_type
      AND r.lifted_at IS NULL
      AND (r.expires_at IS NULL OR r.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.assert_user_can_upload()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to upload a Mii';
  END IF;

  IF public.user_has_active_restriction(auth.uid(), 'upload_ban')
    OR public.user_has_active_restriction(auth.uid(), 'full_suspend') THEN
    RAISE EXCEPTION 'Your account cannot upload Miis right now';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_user_can_comment()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to comment';
  END IF;

  IF public.user_has_active_restriction(auth.uid(), 'comment_ban')
    OR public.user_has_active_restriction(auth.uid(), 'full_suspend') THEN
    RAISE EXCEPTION 'Your account cannot comment right now';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.miis_set_uploader()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_username text;
BEGIN
  PERFORM public.assert_user_can_upload();

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

CREATE OR REPLACE FUNCTION public.comments_set_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  profile_username text;
BEGIN
  PERFORM public.assert_user_can_comment();

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

-- Allow staff visibility updates via admin RPC
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
  IF current_setting('sharemii.admin_rpc', true) = 'true' THEN
    RETURN NEW;
  END IF;

  rpc_mode := current_setting('sharemii.stat_rpc', true);

  IF rpc_mode IN ('increment', 'decrement') THEN
    RETURN NEW;
  END IF;

  is_owner := auth.uid() IS NOT NULL AND OLD.user_id = auth.uid();

  IF is_owner THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.creator_name IS DISTINCT FROM OLD.creator_name
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.visibility IS DISTINCT FROM OLD.visibility
      OR NEW.hidden_reason IS DISTINCT FROM OLD.hidden_reason
      OR NEW.hidden_at IS DISTINCT FROM OLD.hidden_at
      OR NEW.hidden_by IS DISTINCT FROM OLD.hidden_by
    THEN
      RAISE EXCEPTION 'Cannot change ownership, creator, or moderation fields';
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
    OR NEW.visibility IS DISTINCT FROM OLD.visibility
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

-- ---------------------------------------------------------------------------
-- Moderation audit helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_moderation_action(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  action_id uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  INSERT INTO public.moderation_actions (actor_id, action, target_type, target_id, metadata)
  VALUES (auth.uid(), p_action, p_target_type, p_target_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO action_id;

  RETURN action_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- User reports
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_content_report(
  p_target_type public.report_target_type,
  p_target_id uuid,
  p_reason public.report_reason,
  p_details text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_id uuid;
  recent_count int;
  priority public.report_priority;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be logged in to report';
  END IF;

  IF char_length(COALESCE(p_details, '')) > 500 THEN
    RAISE EXCEPTION 'Details must be 500 characters or fewer';
  END IF;

  SELECT count(*)::int INTO recent_count
  FROM public.content_reports
  WHERE reporter_id = auth.uid()
    AND created_at > now() - interval '1 day';

  IF recent_count >= 10 THEN
    RAISE EXCEPTION 'Report limit exceeded. Try again tomorrow.';
  END IF;

  IF p_target_type = 'mii' AND NOT EXISTS (
    SELECT 1 FROM public.miis WHERE id = p_target_id
  ) THEN
    RAISE EXCEPTION 'Mii not found';
  ELSIF p_target_type = 'comment' AND NOT EXISTS (
    SELECT 1 FROM public.comments WHERE id = p_target_id
  ) THEN
    RAISE EXCEPTION 'Comment not found';
  ELSIF p_target_type = 'profile' AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_target_id
  ) THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  priority := CASE
    WHEN p_reason = 'child_safety' THEN 'urgent'::public.report_priority
    WHEN p_reason IN ('harassment', 'impersonation') THEN 'high'::public.report_priority
    ELSE 'normal'::public.report_priority
  END;

  INSERT INTO public.content_reports (
    reporter_id, target_type, target_id, reason, details, priority
  )
  VALUES (
    auth.uid(), p_target_type, p_target_id, p_reason,
    COALESCE(p_details, ''), priority
  )
  RETURNING id INTO report_id;

  RETURN report_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You already have an open report for this content';
END;
$$;

-- ---------------------------------------------------------------------------
-- Staff report management
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_reports(
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
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at ASC)
    FROM (
      SELECT
        r.*,
        p.username AS reporter_username,
        (SELECT count(*)::int FROM public.content_reports cr
         WHERE cr.target_type = r.target_type
           AND cr.target_id = r.target_id
           AND cr.status IN ('open', 'in_review')) AS related_open_count
      FROM public.content_reports r
      LEFT JOIN public.profiles p ON p.id = r.reporter_id
      WHERE (p_status IS NULL OR r.status = p_status)
      ORDER BY
        CASE r.priority
          WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3
        END,
        r.created_at ASC
      LIMIT LEAST(GREATEST(p_limit, 1), 100)
      OFFSET GREATEST(p_offset, 0)
    ) t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_report(p_report_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  SELECT jsonb_build_object(
    'report', row_to_json(r)::jsonb,
    'reporter_username', rp.username,
    'related_reports', COALESCE((
      SELECT jsonb_agg(row_to_json(cr)::jsonb ORDER BY cr.created_at DESC)
      FROM public.content_reports cr
      WHERE cr.target_type = r.target_type
        AND cr.target_id = r.target_id
        AND cr.id <> r.id
      LIMIT 20
    ), '[]'::jsonb)
  ) INTO result
  FROM public.content_reports r
  LEFT JOIN public.profiles rp ON rp.id = r.reporter_id
  WHERE r.id = p_report_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_report(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  UPDATE public.content_reports
  SET
    assigned_to = auth.uid(),
    status = CASE WHEN status = 'open' THEN 'in_review' ELSE status END
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  PERFORM public.log_moderation_action(
    'assign_report', 'report', p_report_id,
    jsonb_build_object('assigned_to', auth.uid())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_report(
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
    RAISE EXCEPTION 'Invalid resolution status';
  END IF;

  UPDATE public.content_reports
  SET
    status = p_status,
    resolved_at = now(),
    resolved_by = auth.uid(),
    resolution_note = COALESCE(p_note, '')
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  PERFORM public.log_moderation_action(
    'resolve_report', 'report', p_report_id,
    jsonb_build_object('status', p_status, 'note', p_note)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_report_priority(
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

  UPDATE public.content_reports SET priority = p_priority WHERE id = p_report_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;

  PERFORM public.log_moderation_action(
    'set_report_priority', 'report', p_report_id,
    jsonb_build_object('priority', p_priority)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Content moderation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_hide_mii(
  p_mii_id uuid,
  p_reason text DEFAULT ''
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

  PERFORM set_config('sharemii.admin_rpc', 'true', true);

  UPDATE public.miis
  SET
    visibility = 'hidden',
    hidden_reason = COALESCE(p_reason, ''),
    hidden_at = now(),
    hidden_by = auth.uid()
  WHERE id = p_mii_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Mii not found'; END IF;

  PERFORM public.log_moderation_action(
    'hide_mii', 'mii', p_mii_id, jsonb_build_object('reason', p_reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_mii(p_mii_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  PERFORM set_config('sharemii.admin_rpc', 'true', true);

  UPDATE public.miis
  SET
    visibility = 'public',
    hidden_reason = NULL,
    hidden_at = NULL,
    hidden_by = NULL
  WHERE id = p_mii_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Mii not found'; END IF;

  PERFORM public.log_moderation_action('restore_mii', 'mii', p_mii_id, '{}'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_comment(
  p_comment_id uuid,
  p_reason text DEFAULT ''
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

  PERFORM set_config('sharemii.admin_rpc', 'true', true);

  UPDATE public.comments
  SET
    visibility = 'removed',
    hidden_reason = COALESCE(p_reason, ''),
    hidden_at = now(),
    hidden_by = auth.uid()
  WHERE id = p_comment_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Comment not found'; END IF;

  PERFORM public.log_moderation_action(
    'delete_comment', 'comment', p_comment_id, jsonb_build_object('reason', p_reason)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hide_profile(
  p_user_id uuid,
  p_reason text DEFAULT ''
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

  PERFORM set_config('sharemii.admin_rpc', 'true', true);

  UPDATE public.profiles
  SET profile_hidden = true
  WHERE id = p_user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  UPDATE public.miis
  SET
    visibility = 'hidden',
    hidden_reason = COALESCE(p_reason, 'Profile hidden'),
    hidden_at = now(),
    hidden_by = auth.uid()
  WHERE user_id = p_user_id AND visibility = 'public';

  PERFORM public.log_moderation_action(
    'hide_profile', 'profile', p_user_id, jsonb_build_object('reason', p_reason)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- User management
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id uuid,
  p_role public.user_role
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_user_id = auth.uid() AND p_role <> 'admin' THEN
    RAISE EXCEPTION 'Cannot demote yourself';
  END IF;

  PERFORM set_config('sharemii.admin_rpc', 'true', true);

  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  PERFORM public.log_moderation_action(
    'set_user_role', 'profile', p_user_id, jsonb_build_object('role', p_role)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_apply_restriction(
  p_user_id uuid,
  p_type public.restriction_type,
  p_expires_at timestamptz DEFAULT NULL,
  p_reason text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  restriction_id uuid;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  IF p_type = 'full_suspend' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required for full suspension';
  END IF;

  INSERT INTO public.user_restrictions (
    user_id, restriction_type, expires_at, reason, created_by
  )
  VALUES (p_user_id, p_type, p_expires_at, COALESCE(p_reason, ''), auth.uid())
  RETURNING id INTO restriction_id;

  PERFORM public.log_moderation_action(
    'apply_restriction', 'profile', p_user_id,
    jsonb_build_object('restriction_id', restriction_id, 'type', p_type)
  );

  RETURN restriction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_lift_restriction(p_restriction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.user_restrictions;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  SELECT * INTO r FROM public.user_restrictions WHERE id = p_restriction_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restriction not found'; END IF;

  IF r.restriction_type = 'full_suspend' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required to lift full suspension';
  END IF;

  UPDATE public.user_restrictions
  SET lifted_at = now(), lifted_by = auth.uid()
  WHERE id = p_restriction_id AND lifted_at IS NULL;

  PERFORM public.log_moderation_action(
    'lift_restriction', 'profile', r.user_id,
    jsonb_build_object('restriction_id', p_restriction_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  normalized := lower(trim(p_query));
  IF normalized = '' THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(t)::jsonb)
    FROM (
      SELECT
        p.id,
        p.username,
        p.role,
        p.profile_hidden,
        p.created_at,
        (SELECT count(*)::int FROM public.miis m WHERE m.user_id = p.id) AS mii_count,
        (SELECT count(*)::int FROM public.content_reports cr
         WHERE (cr.target_type = 'profile' AND cr.target_id = p.id)
            OR (cr.target_type = 'mii' AND cr.target_id IN (
              SELECT m.id FROM public.miis m WHERE m.user_id = p.id
            ))
        ) AS report_count,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', ur.id,
            'restriction_type', ur.restriction_type,
            'expires_at', ur.expires_at,
            'reason', ur.reason,
            'created_at', ur.created_at
          ))
          FROM public.user_restrictions ur
          WHERE ur.user_id = p.id AND ur.lifted_at IS NULL
            AND (ur.expires_at IS NULL OR ur.expires_at > now())
        ), '[]'::jsonb) AS active_restrictions
      FROM public.profiles p
      WHERE p.username_normalized LIKE normalized || '%'
         OR p.username ILIKE '%' || trim(p_query) || '%'
      ORDER BY p.username
      LIMIT LEAST(GREATEST(p_limit, 1), 50)
    ) t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_audit(
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
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC)
    FROM (
      SELECT
        a.*,
        p.username AS actor_username
      FROM public.moderation_actions a
      JOIN public.profiles p ON p.id = a.actor_id
      WHERE public.is_admin() OR a.actor_id = auth.uid()
      ORDER BY a.created_at DESC
      LIMIT LEAST(GREATEST(p_limit, 1), 100)
      OFFSET GREATEST(p_offset, 0)
    ) t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  SELECT jsonb_build_object(
    'open_reports', (
      SELECT count(*)::int FROM public.content_reports
      WHERE status IN ('open', 'in_review')
    ),
    'reports_over_24h', (
      SELECT count(*)::int FROM public.content_reports
      WHERE status IN ('open', 'in_review')
        AND created_at < now() - interval '24 hours'
    ),
    'reports_over_72h', (
      SELECT count(*)::int FROM public.content_reports
      WHERE status IN ('open', 'in_review')
        AND created_at < now() - interval '72 hours'
    ),
    'urgent_reports', (
      SELECT count(*)::int FROM public.content_reports
      WHERE status IN ('open', 'in_review') AND priority = 'urgent'
    ),
    'miis_today', (
      SELECT count(*)::int FROM public.miis
      WHERE created_at >= date_trunc('day', now())
    ),
    'comments_today', (
      SELECT count(*)::int FROM public.comments
      WHERE created_at >= date_trunc('day', now())
    ),
    'signups_today', (
      SELECT count(*)::int FROM public.profiles
      WHERE created_at >= date_trunc('day', now())
    ),
    'staff_actions_7d', (
      SELECT count(*)::int FROM public.moderation_actions
      WHERE created_at >= now() - interval '7 days'
        AND (public.is_admin() OR actor_id = auth.uid())
    ),
    'oldest_open_report_id', (
      SELECT id FROM public.content_reports
      WHERE status IN ('open', 'in_review')
      ORDER BY created_at ASC LIMIT 1
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- Announcements
CREATE OR REPLACE FUNCTION public.fetch_active_announcement()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT row_to_json(a)::jsonb
  FROM public.site_announcements a
  WHERE a.active_from <= now()
    AND (a.active_until IS NULL OR a.active_until > now())
  ORDER BY a.active_from DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_announcement(
  p_message text,
  p_severity text DEFAULT 'info',
  p_active_until timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  announcement_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_severity NOT IN ('info', 'warning') THEN
    RAISE EXCEPTION 'Invalid severity';
  END IF;

  UPDATE public.site_announcements
  SET active_until = now()
  WHERE active_until IS NULL OR active_until > now();

  INSERT INTO public.site_announcements (message, severity, active_until, created_by)
  VALUES (trim(p_message), p_severity, p_active_until, auth.uid())
  RETURNING id INTO announcement_id;

  PERFORM public.log_moderation_action(
    'set_announcement', 'site', announcement_id,
    jsonb_build_object('message', p_message, 'severity', p_severity)
  );

  RETURN announcement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_announcement()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  UPDATE public.site_announcements
  SET active_until = now()
  WHERE active_until IS NULL OR active_until > now();

  PERFORM public.log_moderation_action('clear_announcement', 'site', NULL, '{}'::jsonb);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION public.submit_content_report(public.report_target_type, uuid, public.report_reason, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_active_announcement() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_list_reports(public.report_status, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, public.report_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_report_priority(uuid, public.report_priority) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hide_mii(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_mii(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_comment(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_hide_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.user_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_restriction(uuid, public.restriction_type, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_lift_restriction(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_announcement(text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_announcement() TO authenticated;

REVOKE ALL ON FUNCTION public.log_moderation_action(text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_user_can_upload() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_user_can_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_has_active_restriction(uuid, public.restriction_type) FROM PUBLIC, anon, authenticated;
