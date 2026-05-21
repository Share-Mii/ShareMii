import { getSupabaseClient } from '@/services/supabase';

function formatError(error: { message?: string }): string {
  return error.message ?? 'Request failed';
}

export async function exportUserData(): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabaseClient().rpc('export_user_data');
  if (error) throw new Error(formatError(error));
  return data as Record<string, unknown>;
}

export function downloadUserDataExport(data: Record<string, unknown>): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sharemii-data-export-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function deleteAccount(confirmUsername: string): Promise<void> {
  const { data: sessionData } = await getSupabaseClient().auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('You must be signed in');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ confirm_username: confirmUsername }),
  });

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(body.error ?? `Account deletion failed (${res.status})`);
  }
}
