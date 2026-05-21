import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function deleteProfileMedia(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<void> {
  const bucket = 'profile-media';
  const prefix = `${userId}/`;

  const { data: files, error: listError } = await admin.storage
    .from(bucket)
    .list(userId, { limit: 100 });

  if (listError) {
    console.warn('Storage list failed', listError.message);
    return;
  }

  if (!files?.length) return;

  const paths = files.map((f) => `${prefix}${f.name}`);
  const { error: removeError } = await admin.storage.from(bucket).remove(paths);
  if (removeError) {
    console.warn('Storage remove failed', removeError.message);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim();

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse({ error: 'Server not configured' }, 503);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let body: { confirm_username?: string } = {};
  try {
    body = (await req.json()) as { confirm_username?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: profile } = await admin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();

  const username = (profile?.username ?? '').trim();
  if (username) {
    const confirm = (body.confirm_username ?? '').trim();
    if (confirm !== username) {
      return jsonResponse(
        { error: 'Gamertag confirmation does not match your account' },
        400,
      );
    }
  }

  const { error: purgeError } = await admin.rpc('purge_account_data', {
    p_user_id: user.id,
  });

  if (purgeError) {
    console.error('purge_account_data failed', purgeError);
    return jsonResponse({ error: purgeError.message }, 500);
  }

  await deleteProfileMedia(admin, user.id);

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

  if (deleteError) {
    console.error('deleteUser failed', deleteError);
    return jsonResponse({ error: deleteError.message }, 500);
  }

  return jsonResponse({ ok: true }, 200);
});
