
# Recipe Dispatch Worker (targets Forlgore/recipe-frontend)

This Worker accepts a POST with your recipe JSON and triggers a `repository_dispatch` event to **Forlgore/recipe-frontend** with `event_type: recipe_submitted`.

## Configure & Deploy

```bash
npm i -D wrangler
npx wrangler login
npx wrangler secret put GH_PAT          # fine-grained PAT with write access to Forlgore/recipe-frontend
npx wrangler secret put WEBHOOK_SECRET  # header your page will send as X-Webhook-Secret
npx wrangler deploy
```

Your page can call:

```js
await fetch('https://<your-worker>.<subdomain>.workers.dev/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Secret': '<same-secret>'
  },
  body: JSON.stringify(payload)
});
```
