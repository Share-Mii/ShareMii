-- Address Supabase linter 0028 (anon SECURITY DEFINER executable): Postgres often grants EXECUTE TO PUBLIC,
-- so the anon PostgREST role can invoke SECURITY DEFINER RPCs meant for triggers or staff-only use.
-- Revoke PUBLIC (+ anon where needed) and re-grant only the roles that must call each function via /rpc.

-- ---------------------------------------------------------------------------
-- Anon-safe public RPCs
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.increment_mii_stat(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_mii_stat(uuid, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.remove_mii_stat(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_mii_stat(uuid, text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.fetch_active_announcement() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_active_announcement() TO anon, authenticated;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Authenticated callers only (signed-in SPA)
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.submit_content_report(public.report_target_type, uuid, public.report_reason, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_content_report(public.report_target_type, uuid, public.report_reason, text) TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

REVOKE ALL ON FUNCTION public.comment_target_mii_allows_feedback(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.comment_target_mii_allows_feedback(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.submit_comment(uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_comment(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_comment(uuid, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.client_shadow_recent_comment(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.client_shadow_recent_comment(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.client_shadow_recent_comment(uuid, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.log_profile_content_block(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_profile_content_block(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.log_profile_content_block(text, text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_reports(public.report_status, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_reports(public.report_status, int, int) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_get_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_report(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_assign_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_assign_report(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_resolve_report(uuid, public.report_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_resolve_report(uuid, public.report_status, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_report_priority(uuid, public.report_priority) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_report_priority(uuid, public.report_priority) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_hide_mii(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_hide_mii(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_restore_mii(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_restore_mii(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_delete_comment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_comment(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_hide_profile(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_hide_profile(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_user_role(uuid, public.user_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(uuid, public.user_role) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_apply_restriction(uuid, public.restriction_type, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_apply_restriction(uuid, public.restriction_type, timestamptz, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_lift_restriction(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_lift_restriction(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_search_users(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text, int) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_audit(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_audit(int, int) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

REVOKE ALL ON FUNCTION public.admin_set_announcement(text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_announcement(text, text, timestamptz) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_clear_announcement() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_announcement() TO authenticated;

REVOKE ALL ON FUNCTION public.staff_set_trusted_creator(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_set_trusted_creator(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_set_trusted_creator(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.staff_bulk_dismiss_reports(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_bulk_dismiss_reports(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.staff_bulk_dismiss_reports(uuid[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Not exposed via RPC: triggers / internal SECURITY DEFINER only
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.notify_on_user_favorite() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_on_user_favorite() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.auto_flag_duplicate_mii() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_flag_duplicate_mii() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.comments_enqueue_auto_flag() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.comments_enqueue_auto_flag() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.profile_private_ensure_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_private_ensure_row() FROM anon, authenticated;
