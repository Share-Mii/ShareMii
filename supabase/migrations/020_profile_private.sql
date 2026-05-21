-- Isolate role + notification prefs in profile_private (one row per profile).
-- Public profiles no longer expose these columns via PostgREST on public.profiles.

CREATE TABLE IF NOT EXISTS public.profile_private (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'user'::public.user_role,
  notify_comments boolean NOT NULL DEFAULT true,
  notify_yeahs boolean NOT NULL DEFAULT true,
  notify_favorites boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS profile_private_user_idx ON public.profile_private (user_id);

INSERT INTO public.profile_private (user_id, role, notify_comments, notify_yeahs, notify_favorites)
SELECT
  p.id,
  COALESCE(p.role, 'user'::public.user_role),
  p.notify_comments,
  p.notify_yeahs,
  p.notify_favorites
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.profile_private (user_id)
SELECT p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.profile_private pp WHERE pp.user_id = p.id
);

ALTER TABLE public.profile_private ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_private_select" ON public.profile_private;
CREATE POLICY "profile_private_select" ON public.profile_private
  FOR SELECT USING (auth.uid() = user_id OR public.is_staff());

DROP POLICY IF EXISTS "profile_private_insert" ON public.profile_private;
CREATE POLICY "profile_private_insert" ON public.profile_private
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "profile_private_update" ON public.profile_private;
CREATE POLICY "profile_private_update" ON public.profile_private
  FOR UPDATE
  USING (auth.uid() = user_id OR public.is_staff())
  WITH CHECK (auth.uid() = user_id OR public.is_staff());

-- Ensure a private row exists for every profile (signup + backfill)
CREATE OR REPLACE FUNCTION public.profile_private_ensure_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_private (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profile_private_ensure_row() FROM PUBLIC;

DROP TRIGGER IF EXISTS profiles_ensure_private_row ON public.profiles;
CREATE TRIGGER profiles_ensure_private_row
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profile_private_ensure_row();

DROP TRIGGER IF EXISTS profiles_guard_role ON public.profiles;
DROP FUNCTION IF EXISTS public.profiles_guard_role();

CREATE OR REPLACE FUNCTION public.profiles_guard_profile_hidden()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.profile_hidden IS DISTINCT FROM OLD.profile_hidden THEN
    IF current_setting('sharemii.admin_rpc', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Cannot change profile visibility';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_profile_hidden ON public.profiles;
CREATE TRIGGER profiles_guard_profile_hidden
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_guard_profile_hidden();

CREATE OR REPLACE FUNCTION public.profile_private_guard_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('sharemii.admin_rpc', true) IS DISTINCT FROM 'true' THEN
      RAISE EXCEPTION 'Cannot change role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profile_private_guard_role ON public.profile_private;
CREATE TRIGGER profile_private_guard_role
  BEFORE UPDATE ON public.profile_private
  FOR EACH ROW EXECUTE FUNCTION public.profile_private_guard_role();

REVOKE ALL ON FUNCTION public.profiles_guard_profile_hidden() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profile_private_guard_role() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pp.role FROM public.profile_private pp WHERE pp.user_id = auth.uid()),
    'user'::public.user_role
  );
$$;

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
    ELSE NULL
  END INTO v_notify
  FROM public.profile_private
  WHERE user_id = p_recipient_id;

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

  UPDATE public.profile_private SET role = p_role WHERE user_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  PERFORM public.log_moderation_action(
    'set_user_role', 'profile', p_user_id, jsonb_build_object('role', p_role)
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
        pp.role,
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
      INNER JOIN public.profile_private pp ON pp.user_id = p.id
      WHERE p.username_normalized LIKE normalized || '%'
         OR p.username ILIKE '%' || trim(p_query) || '%'
      ORDER BY p.username
      LIMIT LEAST(GREATEST(p_limit, 1), 50)
    ) t
  ), '[]'::jsonb);
END;
$$;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS notify_comments;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notify_yeahs;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notify_favorites;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;
