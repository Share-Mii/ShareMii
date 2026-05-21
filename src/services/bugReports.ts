import { getSupabaseClient } from '@/services/supabase';

function formatError(error: { message?: string }): string {
  return error.message ?? 'Request failed';
}

export async function submitBugReport(
  title: string,
  description: string,
  pageUrl = '',
  userAgent = '',
): Promise<string> {
  const { data, error } = await getSupabaseClient().rpc('submit_bug_report', {
    p_title: title.trim(),
    p_description: description.trim(),
    p_page_url: pageUrl,
    p_user_agent: userAgent,
  });

  if (error) throw new Error(formatError(error));
  return data as string;
}
