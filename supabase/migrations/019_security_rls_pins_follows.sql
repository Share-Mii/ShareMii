-- Narrow SELECT on pins and follow graph (was world-readable).

DROP POLICY IF EXISTS "profile_pinned_miis_select" ON public.profile_pinned_miis;
CREATE POLICY "profile_pinned_miis_select" ON public.profile_pinned_miis
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles owner_profile
      WHERE owner_profile.id = profile_pinned_miis.user_id
        AND NOT owner_profile.profile_hidden
    )
    OR public.is_staff()
  );

DROP POLICY IF EXISTS "user_follows_select" ON public.user_follows;
CREATE POLICY "user_follows_select" ON public.user_follows
  FOR SELECT USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    OR public.is_staff()
  );
