-- Admin user search: empty query lists all users, paginated, newest first.

DROP FUNCTION IF EXISTS public.admin_search_users(text, int);

CREATE OR REPLACE FUNCTION public.admin_search_users(
  p_query text,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
  v_limit int;
  v_offset int;
  v_total int;
BEGIN
  IF NOT public.is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  normalized := lower(trim(p_query));
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  IF normalized = '' THEN
    SELECT count(*)::int INTO v_total
    FROM public.profiles p
    INNER JOIN public.profile_private pp ON pp.user_id = p.id;
  ELSE
    SELECT count(*)::int INTO v_total
    FROM public.profiles p
    INNER JOIN public.profile_private pp ON pp.user_id = p.id
    WHERE p.username_normalized LIKE normalized || '%'
       OR p.username ILIKE '%' || trim(p_query) || '%';
  END IF;

  RETURN jsonb_build_object(
    'total', v_total,
    'items', COALESCE((
      SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC)
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
        WHERE normalized = ''
           OR p.username_normalized LIKE normalized || '%'
           OR p.username ILIKE '%' || trim(p_query) || '%'
        ORDER BY p.created_at DESC
        LIMIT v_limit
        OFFSET v_offset
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_users(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text, int, int) TO authenticated;
