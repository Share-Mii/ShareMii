import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SITE_BASE = 'https://sharemii.net';

type NotifyEvent = 'content_report' | 'auto_flag' | 'moderation_action';

interface NotifyBody {
  event: NotifyEvent;
  payload: Record<string, unknown>;
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function priorityColor(priority: string | undefined): number {
  switch (priority) {
    case 'urgent':
      return 0xe74c3c;
    case 'high':
      return 0xe67e22;
    default:
      return 0x5865f2;
  }
}

function buildEmbed(event: NotifyEvent, payload: Record<string, unknown>) {
  const now = new Date().toISOString();

  if (event === 'content_report') {
    const id = String(payload.id ?? '');
    const reason = String(payload.reason ?? 'unknown');
    const priority = String(payload.priority ?? 'normal');
    const targetType = String(payload.target_type ?? '');
    const targetId = String(payload.target_id ?? '');
    const details = truncate(String(payload.details ?? ''), 900);
    const reporter = String(payload.reporter_username ?? payload.reporter_id ?? 'unknown');

    return {
      title: '🚩 New content report',
      url: `${SITE_BASE}#/admin/reports/${id}`,
      color: priorityColor(priority),
      fields: [
        { name: 'Reason', value: reason, inline: true },
        { name: 'Priority', value: priority, inline: true },
        { name: 'Target', value: `${targetType}\n\`${targetId}\``, inline: true },
        { name: 'Reporter', value: reporter, inline: true },
        { name: 'Details', value: details || '_(none)_' },
      ],
      footer: { text: `Report ${id}` },
      timestamp: now,
    };
  }

  if (event === 'auto_flag') {
    const kind = String(payload.kind ?? 'flag');
    const excerpt = truncate(String(payload.body_excerpt ?? ''), 900);
    const detail = truncate(String(payload.detail ?? ''), 500);
    const userId = String(payload.user_id ?? '—');
    const commentId = payload.comment_id ? String(payload.comment_id) : '—';

    return {
      title: '🤖 Auto-moderation flag',
      url: `${SITE_BASE}#/admin/auto-flags`,
      color: 0xf1c40f,
      fields: [
        { name: 'Kind', value: kind, inline: true },
        { name: 'User', value: `\`${userId}\``, inline: true },
        { name: 'Comment', value: `\`${commentId}\``, inline: true },
        { name: 'Excerpt', value: excerpt || '_(empty)_' },
        ...(detail ? [{ name: 'Detail', value: detail }] : []),
      ],
      footer: { text: String(payload.id ?? '') },
      timestamp: now,
    };
  }

  const action = String(payload.action ?? 'action');
  const actor = String(payload.actor_username ?? payload.actor_id ?? 'staff');
  const targetType = String(payload.target_type ?? '');
  const targetId = payload.target_id ? String(payload.target_id) : '—';
  const meta = payload.metadata ? truncate(JSON.stringify(payload.metadata), 900) : '';

  return {
    title: '📋 Moderation action',
    url: `${SITE_BASE}#/admin/audit`,
    color: 0x2ecc71,
    fields: [
      { name: 'Action', value: action, inline: true },
      { name: 'Actor', value: actor, inline: true },
      { name: 'Target', value: `${targetType}\n\`${targetId}\``, inline: true },
      ...(meta ? [{ name: 'Metadata', value: `\`\`\`json\n${meta}\n\`\`\`` }] : []),
    ],
    footer: { text: String(payload.id ?? '') },
    timestamp: now,
  };
}

async function postToDiscord(embed: Record<string, unknown>): Promise<Response> {
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL')?.trim();
  if (!webhookUrl) {
    return new Response(JSON.stringify({ error: 'DISCORD_WEBHOOK_URL not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Discord webhook failed', res.status, text);
    return new Response(JSON.stringify({ error: 'Discord webhook failed', status: res.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const expectedSecret = Deno.env.get('DISCORD_NOTIFY_SECRET')?.trim();
  const providedSecret = req.headers.get('x-discord-notify-secret')?.trim();
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return unauthorized();
  }

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body?.event || !body?.payload || typeof body.payload !== 'object') {
    return new Response(JSON.stringify({ error: 'Missing event or payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const embed = buildEmbed(body.event, body.payload);
  return postToDiscord(embed);
});
