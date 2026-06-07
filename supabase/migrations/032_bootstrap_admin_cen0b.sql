-- Ensure cen0b retains admin after role moved to profile_private (020).

SELECT set_config('sharemii.admin_rpc', 'true', true);

UPDATE public.profile_private pp
SET role = 'admin'
FROM public.profiles p
WHERE pp.user_id = p.id
  AND p.username_normalized = 'cen0b';
