import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const SITE_BASE = 'https://sharemii.net';

interface BugNotifyBody {
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

function buildBugEmbed(payload: Record<string, unknown>) {
  const now = new Date().toISOString();
  const id = String(payload.id ?? '');
  const title = truncate(String(payload.title ?? 'Bug report'), 200);
  const description = truncate(String(payload.description ?? ''), 900);
  const pageUrl = truncate(String(payload.page_url ?? ''), 200);
  const reporter = String(payload.reporter_username ?? payload.reporter_id ?? 'unknown');
  const priority = String(payload.priority ?? 'normal');

  return {
    title: '🐛 New bug report',
    url: `${SITE_BASE}#/admin/bugs/${id}`,
    color: priorityColor(priority),
    fields: [
      { name: 'Title', value: title },
      { name: 'Priority', value: priority, inline: true },
      { name: 'Reporter', value: reporter, inline: true },
      { name: 'Page', value: pageUrl || '_(none)_' },
      { name: 'Description', value: description || '_(none)_' },
    ],
    footer: { text: `Bug ${id}` },
    timestamp: now,
  };
}

async function postToDiscord(embed: Record<string, unknown>): Promise<Response> {
  const webhookUrl = Deno.env.get('DISCORD_BUG_WEBHOOK_URL')?.trim();
  if (!webhookUrl) {
    return new Response(
      JSON.stringify({ error: 'DISCORD_BUG_WEBHOOK_URL not configured' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('Discord bug webhook failed', res.status, text);
    return new Response(
      JSON.stringify({ error: 'Discord webhook failed', status: res.status }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
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

  const expectedSecret = Deno.env.get('DISCORD_BUG_NOTIFY_SECRET')?.trim();
  const providedSecret = req.headers.get('x-discord-bug-notify-secret')?.trim();
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) {
    return unauthorized();
  }

  let body: BugNotifyBody;
  try {
    body = (await req.json()) as BugNotifyBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!body?.payload || typeof body.payload !== 'object') {
    return new Response(JSON.stringify({ error: 'Missing payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const embed = buildBugEmbed(body.payload);
  return postToDiscord(embed);
});
