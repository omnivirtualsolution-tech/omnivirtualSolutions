// =================================================================
// netlify/functions/api.js  —  Serverless Express Handler for Netlify
// =================================================================
const serverless = require("serverless-http");
const app = require("../../backend/server");

// Export wrapped Express app for Netlify Functions (rebuilt with safe serverless fs handling)
module.exports.handler = serverless(app);

