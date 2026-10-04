// =================================================================
// scripts/optimize-all-images.js
// =================================================================
// Converts all heavy JPG and PNG images in assets/ to modern WebP:
// - Keeps original files as safety backup
// - Saves 70% to 95% bandwidth and storage
// - Updates content_blocks and media_assets in the database
// =================================================================

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const fs = require("fs");
const { db } = require("../backend/db");
const { optimizeImage } = require("../backend/utils/image-optimizer");

const root = path.resolve(__dirname, "..");
const dirs = [
  path.join(root, "assets/img"),
  path.join(root, "assets/img/books"),
];

async function run() {
  console.log("\n========================================================");
  console.log("  🖼️  Omni Virtual Solutions — Image Optimizer");
  console.log("========================================================");

  let totalOriginal = 0;
  let totalOptimized = 0;
  let convertedCount = 0;
  const updates = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (![".png", ".jpg", ".jpeg"].includes(ext)) continue;

      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) continue;

      const baseName = path.basename(file, ext);
      const webpName = `${baseName}.webp`;
      const webpPath = path.join(dir, webpName);

      // Read file and optimize
      const buffer = fs.readFileSync(fullPath);
      const originalBytes = buffer.length;

      try {
        const result = await optimizeImage(buffer);
        fs.writeFileSync(webpPath, result.buffer);

        const savedBytes = originalBytes - result.size;
        const pct = ((savedBytes / originalBytes) * 100).toFixed(1);

        totalOriginal += originalBytes;
        totalOptimized += result.size;
        convertedCount++;

        console.log(
          `  ✅ ${file.padEnd(20)}: ${(originalBytes / 1024).toFixed(0)} KB ➔ ${(result.size / 1024).toFixed(0)} KB (${pct}% saved)`
        );

        const relOld = path.relative(root, fullPath).replace(/\\/g, "/");
        const relNew = path.relative(root, webpPath).replace(/\\/g, "/");
        updates.push({ oldPath: relOld, newPath: relNew });
      } catch (err) {
        console.warn(`  ⚠️ Failed to optimize ${file}:`, err.message);
      }
    }
  }

  // Update Database records to point to new WebP files
  console.log("\nUpdating database image references to WebP...");
  for (const { oldPath, newPath } of updates) {
    try {
      await db.execute({
        sql: "UPDATE content_blocks SET value = ? WHERE value = ?",
        args: [newPath, oldPath],
      });
      await db.execute({
        sql: "UPDATE media_assets SET file_path = ? WHERE file_path = ?",
        args: [newPath, oldPath],
      });
    } catch (dbErr) {
      console.warn(`  Database update note for ${oldPath}:`, dbErr.message);
    }
  }

  const grandSaved = totalOriginal - totalOptimized;
  const grandPct = totalOriginal > 0 ? ((grandSaved / totalOriginal) * 100).toFixed(1) : 0;

  console.log("\n========================================================");
  console.log(`  🎉 Optimization Summary:`);
  console.log(`  • Images Converted: ${convertedCount}`);
  console.log(`  • Original Total:   ${(totalOriginal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  • Optimized Total:  ${(totalOptimized / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  • Storage Saved:    ${(grandSaved / 1024 / 1024).toFixed(2)} MB (${grandPct}% smaller!)`);
  console.log("========================================================\n");
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Optimizer error:", err);
    process.exit(1);
  });
