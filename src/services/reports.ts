import { getSupabaseClient } from '@/services/supabase';
import type { ReportReason, ReportTargetType } from '@/types';

function formatError(error: { message?: string }): string {
  return error.message ?? 'Request failed';
}

export async function submitContentReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  details = '',
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('submit_content_report', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details.trim(),
  });

  if (error) throw new Error(formatError(error));
  return data as string;
}

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'copyright', label: 'Copyright violation' },
  { value: 'child_safety', label: 'Child safety concern' },
  { value: 'other', label: 'Other' },
];
