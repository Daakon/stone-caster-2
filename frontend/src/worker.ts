// Cloudflare Worker entry point for StoneCaster frontend
// This serves the static React app built by Vite

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // Try to get the asset from the ASSETS binding
    const asset = await env.ASSETS.fetch(request);
    
    // If the asset exists, return it
    if (asset.status !== 404) {
      return asset;
    }
    
    // For SPA routing, serve index.html for all non-asset requests
    const indexAsset = await env.ASSETS.fetch(new Request(new URL('/', request.url)));
    return indexAsset;
  },
};
