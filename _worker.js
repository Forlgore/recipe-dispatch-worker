export default {
  async fetch(request, env) {
    // --- CORS: allow only your GitHub Pages site
    const ALLOWED_ORIGIN = 'https://forlgore.github.io';
    const origin = request.headers.get('Origin');
    const allowOrigin =
      origin && origin.toLowerCase() === ALLOWED_ORIGIN.toLowerCase()
        ? ALLOWED_ORIGIN
        : ''; // empty means "do not allow"

    const cors = {
      'Access-Control-Allow-Origin': allowOrigin || 'https://forlgore.github.io',
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type,x-webhook-secret',
      'Access-Control-Max-Age': '86400'
    };

    // --- Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      // If the Origin isn't allowed, return 403 to make the failure explicit
      if (!allowOrigin) {
        return new Response('CORS origin not allowed', { status: 403, headers: cors });
      }
      return new Response(null, { status: 204, headers: cors });
    }

    // --- Auth guard via shared secret (to prevent abuse)
    const secret = request.headers.get('X-Webhook-Secret') || '';
    if (secret !== env.WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: { ...cors, 'Allow': 'POST,OPTIONS' }
      });
    }

    // --- Parse body
    let recipe;
    try {
      recipe = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: cors });
    }

    // --- repository_dispatch to GitHub (Repo B)
    const url = `https://api.github.com/repos/${env.OWNER}/${env.REPO}/dispatches`;
    const payload = {
      event_type: env.EVENT_TYPE,              // e.g. "recipe_submitted"
      client_payload: { recipe }
    };

    const gh = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GH_PAT}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!gh.ok) {
      const txt = await gh.text();
      return new Response(`GitHub dispatch failed: ${gh.status}\n${txt}`, {
        status: 502,
        headers: cors
      });
    }

    return new Response('Dispatched', { status: 202, headers: cors });
  }
}
