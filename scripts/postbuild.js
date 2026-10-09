// =================================================================
// scripts/postbuild.js  —  Copy admin and static assets to frontend/dist
// =================================================================
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "frontend/dist");

if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}

// 1. Copy Admin portal to dist/admin
const adminSrc = path.join(root, "admin");
const adminDest = path.join(dist, "admin");
if (fs.existsSync(adminSrc)) {
  fs.cpSync(adminSrc, adminDest, { recursive: true });
  console.log("  ✅ Admin portal copied to frontend/dist/admin");
}

// 2. Copy In-Place Live Editor pages to dist/admin/site/
const adminSiteDest = path.join(dist, "admin/site");
if (!fs.existsSync(adminSiteDest)) {
  fs.mkdirSync(adminSiteDest, { recursive: true });
}
const siteHtmlFiles = ["index.html", "services.html", "sev.html", "starter-page.html", "dropdown.html"];
for (const file of siteHtmlFiles) {
  const src = path.join(root, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(adminSiteDest, file));
  }
}
console.log("  ✅ Live editor preview pages copied to frontend/dist/admin/site/");

// 3. Copy static assets to dist/assets
const assetsSrc = path.join(root, "assets");
const assetsDest = path.join(dist, "assets");
if (fs.existsSync(assetsSrc)) {
  fs.cpSync(assetsSrc, assetsDest, { recursive: true });
  console.log("  ✅ Assets copied to frontend/dist/assets");
}

const redirectsContent = `# Cloudflare & Netlify Redirects
/admin/site/assets/*   /assets/:splat         200
`;
fs.writeFileSync(path.join(dist, "_redirects"), redirectsContent, "utf8");
console.log("  ✅ Cloudflare _redirects file generated");

console.log("🚀 Postbuild finished successfully.\n");
