-- Fix export_user_data: profile_private has no created_at/updated_at columns.

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

REVOKE ALL ON FUNCTION public.export_user_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_user_data() TO authenticated;
