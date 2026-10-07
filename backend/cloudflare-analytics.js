// =================================================================
// backend/cloudflare-analytics.js
// Live integration with Cloudflare GraphQL Analytics API for Workers
// =================================================================

const { db } = require("./db");

const DEFAULT_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "433955e29459040a9fe5c7c01f88e4a7";
const DEFAULT_SCRIPT_NAME = process.env.CLOUDFLARE_SCRIPT_NAME || "omnivirtualsolutions";

/**
 * Retrieve Cloudflare credentials from environment or database settings
 */
async function getCloudflareConfig() {
  let apiToken = process.env.CLOUDFLARE_API_TOKEN || null;
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_ACCOUNT_ID;
  let scriptName = process.env.CLOUDFLARE_SCRIPT_NAME || DEFAULT_SCRIPT_NAME;

  try {
    const res = await db.execute(
      "SELECT setting_key, setting_value FROM email_settings WHERE setting_key IN ('cloudflare_api_token', 'cloudflare_account_id', 'cloudflare_script_name')"
    );
    res.rows.forEach(r => {
      if (r.setting_key === 'cloudflare_api_token' && r.setting_value) apiToken = r.setting_value;
      if (r.setting_key === 'cloudflare_account_id' && r.setting_value) accountId = r.setting_value;
      if (r.setting_key === 'cloudflare_script_name' && r.setting_value) scriptName = r.setting_value;
    });
  } catch (_) {}

  return { apiToken, accountId, scriptName };
}

let metricsCache = null;
let metricsCacheExpiry = 0;

/**
 * Fetch authentic Workers traffic metrics from Cloudflare GraphQL API
 */
async function fetchCloudflareMetrics(days = 14, force = false) {
  const nowMs = Date.now();
  if (!force && metricsCache && nowMs < metricsCacheExpiry && metricsCache._days === days) {
    return metricsCache;
  }

  const config = await getCloudflareConfig();
  if (!config.apiToken) {
    return {
      connected: false,
      error: "NO_TOKEN",
      message: "Cloudflare API token not configured. Set CLOUDFLARE_API_TOKEN in settings."
    };
  }

  const now = new Date();
  const datetimeEnd = now.toISOString();
  const datetimeStart = new Date(now.getTime() - days * 86400000).toISOString();
  const todayStr = datetimeEnd.slice(0, 10);

  const query = `
    query GetWorkersTraffic($accountTag: String!, $datetimeStart: String!, $datetimeEnd: String!, $scriptName: String!) {
      viewer {
        accounts(filter: { accountTag: $accountTag }) {
          workersInvocationsAdaptive(
            limit: 10000
            filter: {
              scriptName: $scriptName
              datetime_geq: $datetimeStart
              datetime_leq: $datetimeEnd
            }
          ) {
            sum {
              requests
              subrequests
              errors
            }
            dimensions {
              datetimeHour
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query,
        variables: {
          accountTag: config.accountId,
          scriptName: config.scriptName,
          datetimeStart,
          datetimeEnd
        }
      })
    });

    if (!res.ok) {
      return { connected: false, error: "HTTP_" + res.status, status: res.status };
    }

    const json = await res.json();
    if (json.errors && json.errors.length > 0) {
      return { connected: false, error: "GRAPHQL_ERROR", details: json.errors };
    }

    const items = json.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
    let totalRequests = 0;
    let requestsToday = 0;
    const dailyMap = {};

    items.forEach(item => {
      const reqs = Number(item.sum?.requests || 0);
      totalRequests += reqs;
      const day = String(item.dimensions?.datetimeHour || "").slice(0, 10);
      if (day) {
        dailyMap[day] = (dailyMap[day] || 0) + reqs;
        if (day === todayStr) {
          requestsToday += reqs;
        }
      }
    });

    const result = {
      connected: true,
      totalRequests,
      requestsToday,
      dailyMap,
      source: "Cloudflare Workers GraphQL API",
      accountId: config.accountId,
      scriptName: config.scriptName,
      _days: days
    };

    metricsCache = result;
    metricsCacheExpiry = nowMs + (15 * 60 * 1000); // 15-minute cache to conserve Cloudflare quota
    return result;
  } catch (err) {
    console.error("[cloudflare-analytics] Fetch error:", err.message);
    return { connected: false, error: err.message };
  }
}

/**
 * Save Cloudflare API configuration to database
 */
async function saveCloudflareConfig({ apiToken, accountId, scriptName }) {
  metricsCache = null;
  metricsCacheExpiry = 0;
  const configs = [
    { key: "cloudflare_api_token", val: apiToken ? String(apiToken).trim() : "" },
    { key: "cloudflare_account_id", val: accountId ? String(accountId).trim() : DEFAULT_ACCOUNT_ID },
    { key: "cloudflare_script_name", val: scriptName ? String(scriptName).trim() : DEFAULT_SCRIPT_NAME }
  ];

  for (const c of configs) {
    await db.execute({
      sql: `INSERT INTO email_settings (setting_key, setting_value, setting_label, updated_at, updated_by)
            VALUES (?, ?, ?, datetime('now'), 'admin')
            ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = datetime('now')`,
      args: [c.key, c.val, `Cloudflare Setting: ${c.key}`]
    });
  }

  return true;
}

module.exports = {
  getCloudflareConfig,
  fetchCloudflareMetrics,
  saveCloudflareConfig
};
