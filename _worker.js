export default {
  async fetch(request, env) {
    // === CORS: allow only your GitHub Pages site ===
    const ALLOWED_ORIGIN = 'https://forlgore.github.io';
    const origin = request.headers.get('Origin');
    const allowOrigin =
      origin && origin.toLowerCase() === ALLOWED_ORIGIN.toLowerCase()
        ? ALLOWED_ORIGIN
        : '';

    const cors = {
      'Access-Control-Allow-Origin': allowOrigin || ALLOWED_ORIGIN,
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'content-type,x-webhook-secret',
      'Access-Control-Max-Age': '86400'
    };

    try {
      // --- CORS preflight ---
      if (request.method === 'OPTIONS') {
        if (!allowOrigin) {
          return new Response('CORS origin not allowed', { status: 403, headers: cors });
        }
        return new Response(null, { status: 204, headers: cors });
      }

      // --- Auth guard via shared secret (prevents open abuse) ---
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

      // --- Parse incoming JSON (your recipe payload) ---
      let recipe;
      try {
        recipe = await request.json();
      } catch {
        return new Response('Invalid JSON', { status: 400, headers: cors });
      }

      // --- Build repository_dispatch payload for GitHub ---
      const url = `https://api.github.com/repos/${env.OWNER}/${env.REPO}/dispatches`;
      const payload = {
        event_type: env.EVENT_TYPE,           // e.g., "recipe_submitted"
        client_payload: { recipe }
      };

      // --- Call GitHub API (User-Agent required) ---
      // GitHub requires a User-Agent header on all REST requests. [1](https://graphite.com/guides/github-actions-env-variables)
      const ghRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.GH_PAT}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'Forlgore-recipe-dispatch-worker'
        },
        body: JSON.stringify(payload)
      });

      if (!ghRes.ok) {
        const txt = await ghRes.text();
        return new Response(`GitHub dispatch failed: ${ghRes.status}\n${txt}`, {
          status: 502,
          headers: cors
        });
      }

      // Success
      return new Response('Dispatched', { status: 202, headers: cors });
    } catch (err) {
      const msg = (err && err.message) ? err.message : String(err);
      return new Response(`Worker error: ${msg}`, { status: 500, headers: cors });
    }
  }
}
