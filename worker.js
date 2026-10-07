import { httpServerHandler } from "cloudflare:node";
import app from "./backend/server.js";

app.listen(3000);

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

    if (url.pathname.startsWith("/api/")) {
      return httpServerHandler({ port: 3000 }).fetch(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  }
};
