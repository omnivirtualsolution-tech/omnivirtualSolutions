import { httpServerHandler } from "cloudflare:node";
import app from "./backend/server.js";

app.listen(3000);
const nodeHandler = httpServerHandler({ port: 3000 });

export default {
  async fetch(request, env, ctx) {
    // Sync Cloudflare environment variables to process.env
    if (env) {
      for (const [key, val] of Object.entries(env)) {
        if (typeof val === "string") {
          process.env[key] = val;
        }
      }
    }

    const url = new URL(request.url);

    if (url.pathname.startsWith("/api") || url.pathname.startsWith("/assets/uploads/")) {
      return nodeHandler.fetch(request, env, ctx);
    }

    const response = await env.ASSETS.fetch(request);

    // High-performance caching for static production bundles & media assets
    if (response.status === 200) {
      const pathname = url.pathname;
      if (pathname.startsWith("/assets/") || /\.(js|css|webp|png|jpg|jpeg|svg|woff2?|ico)$/i.test(pathname)) {
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(response.body, { status: response.status, headers });
      }
    }

    return response;
  }
};
