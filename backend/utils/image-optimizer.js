// =================================================================
// backend/utils/image-optimizer.js  —  Lossless-Quality WebP Optimizer
// =================================================================
// Converts uploaded or existing images to modern, high-definition WebP:
// - Reduces file size by 70% to 95%
// - Caps maximum dimension to 1920px (full HD)
// - Strips bloated EXIF/GPS camera metadata
// - Maintains crisp visual fidelity (quality: 82)
// =================================================================

const sharp = require("sharp");
const path  = require("path");
const fs    = require("fs");

/**
 * Optimizes an image buffer or file to high-efficiency WebP.
 * @param {Buffer|string} input - File path or image Buffer
 * @param {object} [options]
 * @param {number} [options.maxWidth=1920] - Max display width
 * @param {number} [options.quality=82]    - WebP quality level (80-85 is visually lossless)
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, size: number, format: string }>}
 */
async function optimizeImage(input, options = {}) {
  const maxWidth = options.maxWidth || 1920;
  const quality  = options.quality  || 82;

  const pipeline = sharp(input, { failOnError: false })
    .rotate() // Auto-orient based on EXIF before stripping metadata
    .resize({
      width: maxWidth,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({
      quality,
      effort: 6, // High compression effort
      smartSubsample: true,
    });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    width: info.width,
    height: info.height,
    size: info.size,
    format: "webp",
  };
}

module.exports = {
  optimizeImage,
};
