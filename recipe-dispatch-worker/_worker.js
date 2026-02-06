
export default {
  async fetch(request, env) {
    const secret = request.headers.get('X-Webhook-Secret') || '';
    if (secret !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: { 'Allow': 'POST' } });
    }
    let recipe;
    try {
      recipe = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400 });
    }
    const url = `https://api.github.com/repos/${env.OWNER}/${env.REPO}/dispatches`;
    const payload = { event_type: env.EVENT_TYPE, client_payload: { recipe } };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GH_PAT}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text();
      return new Response(`GitHub dispatch failed: ${res.status}
${txt}`, { status: 502 });
    }
    return new Response('Dispatched', { status: 202 });
  }
}
