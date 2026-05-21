import { getSupabaseClient } from '@/services/supabase';
import type {
  AdminDashboardStats,
  AdminUserSummary,
  BugReport,
  ContentReport,
  ModerationAction,
  ModerationAutoFlag,
  ReportPriority,
  ReportStatus,
  RestrictionType,
  UserRole,
} from '@/types';

function formatError(error: { message?: string }): string {
  return error.message ?? 'Request failed';
}

export async function listModerationAutoFlags(limit = 100): Promise<ModerationAutoFlag[]> {
  const { data, error } = await getSupabaseClient()
    .from('moderation_auto_flags')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200));
  if (error) throw new Error(formatError(error));
  return (data ?? []) as ModerationAutoFlag[];
}

export async function fetchDashboardStats(): Promise<AdminDashboardStats> {
  const { data, error } = await getSupabaseClient().rpc('admin_dashboard_stats');
  if (error) throw new Error(formatError(error));
  return data as AdminDashboardStats;
}

export async function listReports(
  status?: ReportStatus | null,
  limit = 50,
  offset = 0,
): Promise<ContentReport[]> {
  const { data, error } = await getSupabaseClient().rpc('admin_list_reports', {
    p_status: status ?? null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(formatError(error));
  return (data ?? []) as ContentReport[];
}

export async function getReportDetail(reportId: string): Promise<{
  report: ContentReport;
  reporter_username: string | null;
  related_reports: ContentReport[];
}> {
  const { data, error } = await getSupabaseClient().rpc('admin_get_report', {
    p_report_id: reportId,
  });
  if (error) throw new Error(formatError(error));
  return data as {
    report: ContentReport;
    reporter_username: string | null;
    related_reports: ContentReport[];
  };
}

export async function assignReport(reportId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_assign_report', {
    p_report_id: reportId,
  });
  if (error) throw new Error(formatError(error));
}

export async function resolveReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
  note = '',
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_resolve_report', {
    p_report_id: reportId,
    p_status: status,
    p_note: note,
  });
  if (error) throw new Error(formatError(error));
}

export async function setReportPriority(
  reportId: string,
  priority: ReportPriority,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_set_report_priority', {
    p_report_id: reportId,
    p_priority: priority,
  });
  if (error) throw new Error(formatError(error));
}

export async function hideMii(miiId: string, reason = ''): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_hide_mii', {
    p_mii_id: miiId,
    p_reason: reason,
  });
  if (error) throw new Error(formatError(error));
}

export async function deleteComment(commentId: string, reason = ''): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_delete_comment', {
    p_comment_id: commentId,
    p_reason: reason,
  });
  if (error) throw new Error(formatError(error));
}

export async function hideProfile(userId: string, reason = ''): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_hide_profile', {
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) throw new Error(formatError(error));
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_set_user_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw new Error(formatError(error));
}

export async function applyRestriction(
  userId: string,
  type: RestrictionType,
  expiresAt: string | null,
  reason = '',
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('admin_apply_restriction', {
    p_user_id: userId,
    p_type: type,
    p_expires_at: expiresAt,
    p_reason: reason,
  });
  if (error) throw new Error(formatError(error));
  return data as string;
}

export async function liftRestriction(restrictionId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_lift_restriction', {
    p_restriction_id: restrictionId,
  });
  if (error) throw new Error(formatError(error));
}

export async function searchUsers(query: string, limit = 20): Promise<AdminUserSummary[]> {
  const { data, error } = await getSupabaseClient().rpc('admin_search_users', {
    p_query: query,
    p_limit: limit,
  });
  if (error) throw new Error(formatError(error));
  return (data ?? []) as AdminUserSummary[];
}

export async function listAuditLog(limit = 50, offset = 0): Promise<ModerationAction[]> {
  const { data, error } = await getSupabaseClient().rpc('admin_list_audit', {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(formatError(error));
  return (data ?? []) as ModerationAction[];
}

export async function setAnnouncement(
  message: string,
  severity: 'info' | 'warning' = 'info',
  activeUntil: string | null = null,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_set_announcement', {
    p_message: message,
    p_severity: severity,
    p_active_until: activeUntil,
  });
  if (error) throw new Error(formatError(error));
}

export async function clearAnnouncement(): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_clear_announcement');
  if (error) throw new Error(formatError(error));
}

export async function fetchActiveAnnouncement(): Promise<{
  id: string;
  message: string;
  severity: 'info' | 'warning';
} | null> {
  const { data, error } = await getSupabaseClient().rpc('fetch_active_announcement');
  if (error) return null;
  if (!data) return null;
  return data as { id: string; message: string; severity: 'info' | 'warning' };
}

export async function checkIsStaff(): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('is_staff');
  if (error) return false;
  return Boolean(data);
}

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('is_admin');
  if (error) return false;
  return Boolean(data);
}

export async function listBugReports(
  status?: ReportStatus | null,
  limit = 50,
  offset = 0,
): Promise<BugReport[]> {
  const { data, error } = await getSupabaseClient().rpc('admin_list_bug_reports', {
    p_status: status ?? null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw new Error(formatError(error));
  return (data ?? []) as BugReport[];
}

export async function getBugReportDetail(reportId: string): Promise<{
  report: BugReport;
}> {
  const { data, error } = await getSupabaseClient().rpc('admin_get_bug_report', {
    p_report_id: reportId,
  });
  if (error) throw new Error(formatError(error));
  return data as { report: BugReport };
}

export async function assignBugReport(reportId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_assign_bug_report', {
    p_report_id: reportId,
  });
  if (error) throw new Error(formatError(error));
}

export async function resolveBugReport(
  reportId: string,
  status: 'resolved' | 'dismissed',
  note = '',
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_resolve_bug_report', {
    p_report_id: reportId,
    p_status: status,
    p_note: note,
  });
  if (error) throw new Error(formatError(error));
}

export async function setBugReportPriority(
  reportId: string,
  priority: ReportPriority,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('admin_set_bug_report_priority', {
    p_report_id: reportId,
    p_priority: priority,
  });
  if (error) throw new Error(formatError(error));
}

export async function bulkDismissReports(reportIds: string[]): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc(
    'staff_bulk_dismiss_reports',
    { p_report_ids: reportIds },
  );
  if (error) throw new Error(formatError(error));
  return Number(data ?? 0);
}

export async function setTrustedCreatorFlag(
  userId: string,
  trusted: boolean,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('staff_set_trusted_creator', {
    p_user_id: userId,
    p_trusted: trusted,
  });
  if (error) throw new Error(formatError(error));
}
