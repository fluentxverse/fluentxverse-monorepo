import { getAssetFromKV } from "@cloudflare/kv-asset-handler";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  try {
    // Serve static assets from KV
    return await getAssetFromKV(event, {
      mapRequestToAsset: (req) => {
        const url = new URL(req.url);
        // Handle SPA routing - serve index.html for all routes
        if (!url.pathname.includes('.') && !url.pathname.startsWith('/assets/')) {
          url.pathname = '/index.html';
        }
        return new Request(url.toString(), req);
      },
    });
  } catch (e) {
    // If asset not found, return index.html for SPA routing
    try {
      return await getAssetFromKV(event, {
        mapRequestToAsset: (req) => new Request(`${new URL(req.url).origin}/index.html`, req),
      });
    } catch (err) {
      return new Response("Not Found", { status: 404 });
    }
  }
}
