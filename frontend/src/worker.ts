// Cloudflare Worker entry point for StoneCaster frontend
// This serves the static React app built by Vite

import { earlyAccessMiddleware } from './worker/middleware/earlyAccess.js';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Apply early access middleware (Phase 0: tagging only, no redirects)
    const taggedRequest = earlyAccessMiddleware(request, env);
    
    // Try to get the asset from the ASSETS binding
    const asset = await env.ASSETS.fetch(taggedRequest);
    
    // If the asset exists, return it
    if (asset.status !== 404) {
      return asset;
    }
    
    // For SPA routing, serve index.html for all non-asset requests
    const indexAsset = await env.ASSETS.fetch(new Request(new URL('/', taggedRequest.url)));
    return indexAsset;
  },
};
