// =================================================================
// functions/api/[[catchall]].js  —  Cloudflare Pages Function for API
// =================================================================
const serverless = require("serverless-http");
const app = require("../../backend/server");

export const onRequest = serverless(app);
