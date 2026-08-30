/**
 * Bounding box validation and normalization utilities.
 * All bounding boxes are stored as normalized [0, 1] coordinates.
 */

/**
 * Validate a bounding box object.
 */
const isValidBoundingBox = (bbox) => {
  if (!bbox || typeof bbox !== 'object') return false;
  const { x, y, width, height } = bbox;
  if ([x, y, width, height].some((v) => typeof v !== 'number' || isNaN(v))) return false;
  if (x < 0 || y < 0 || width <= 0 || height <= 0) return false;
  if (x + width > 1.01 || y + height > 1.01) return false; // allow slight overrun
  return true;
};

/**
 * Clamp a bounding box to [0, 1] range.
 */
const clampBoundingBox = (bbox) => ({
  x: Math.max(0, Math.min(1, bbox.x)),
  y: Math.max(0, Math.min(1, bbox.y)),
  width: Math.max(0.01, Math.min(1 - Math.max(0, bbox.x), bbox.width)),
  height: Math.max(0.01, Math.min(1 - Math.max(0, bbox.y), bbox.height)),
});

/**
 * Convert pixel-based bbox to normalized given page dimensions.
 */
const pixelToNormalized = (bbox, pageWidth, pageHeight) => ({
  x: bbox.x / pageWidth,
  y: bbox.y / pageHeight,
  width: bbox.width / pageWidth,
  height: bbox.height / pageHeight,
});

/**
 * Convert normalized bbox to CSS percentage style.
 */
const normalizedToPercent = (bbox) => ({
  left: `${bbox.x * 100}%`,
  top: `${bbox.y * 100}%`,
  width: `${bbox.width * 100}%`,
  height: `${bbox.height * 100}%`,
});

/**
 * Merge multiple regions into a bounding box that contains all of them.
 * (For displaying a summary of a multi-region answer on a single page.)
 */
const mergeRegions = (regions) => {
  if (!regions || regions.length === 0) return null;
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const r of regions) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.width);
    maxY = Math.max(maxY, r.y + r.height);
  }
  const round6 = (n) => Math.round(n * 1e6) / 1e6;
  return { x: round6(minX), y: round6(minY), width: round6(maxX - minX), height: round6(maxY - minY) };
};

module.exports = {
  isValidBoundingBox,
  clampBoundingBox,
  pixelToNormalized,
  normalizedToPercent,
  mergeRegions,
};
