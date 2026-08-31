const {
  isValidBoundingBox,
  clampBoundingBox,
  pixelToNormalized,
  mergeRegions,
} = require('../src/utils/boundingBox');

describe('isValidBoundingBox', () => {
  test('valid box', () => {
    expect(isValidBoundingBox({ x: 0.1, y: 0.1, width: 0.5, height: 0.3 })).toBe(true);
  });

  test('zero width is invalid', () => {
    expect(isValidBoundingBox({ x: 0.1, y: 0.1, width: 0, height: 0.3 })).toBe(false);
  });

  test('negative x is invalid', () => {
    expect(isValidBoundingBox({ x: -0.1, y: 0.1, width: 0.5, height: 0.3 })).toBe(false);
  });

  test('exceeding bounds is invalid', () => {
    expect(isValidBoundingBox({ x: 0.8, y: 0.1, width: 0.5, height: 0.3 })).toBe(false);
  });

  test('null is invalid', () => {
    expect(isValidBoundingBox(null)).toBe(false);
  });

  test('missing fields', () => {
    expect(isValidBoundingBox({ x: 0.1, y: 0.1 })).toBe(false);
  });
});

describe('clampBoundingBox', () => {
  test('clamps x to 0', () => {
    const result = clampBoundingBox({ x: -0.1, y: 0.1, width: 0.5, height: 0.3 });
    expect(result.x).toBe(0);
  });

  test('clamps x+width to 1', () => {
    const result = clampBoundingBox({ x: 0.8, y: 0.1, width: 0.5, height: 0.3 });
    expect(result.x + result.width).toBeLessThanOrEqual(1);
  });
});

describe('pixelToNormalized', () => {
  test('converts correctly', () => {
    const result = pixelToNormalized({ x: 120, y: 160, width: 960, height: 320 }, 1200, 1600);
    expect(result.x).toBeCloseTo(0.1);
    expect(result.y).toBeCloseTo(0.1);
    expect(result.width).toBeCloseTo(0.8);
    expect(result.height).toBeCloseTo(0.2);
  });
});

describe('mergeRegions', () => {
  test('merges two regions correctly', () => {
    const regions = [
      { x: 0.1, y: 0.1, width: 0.5, height: 0.2 },
      { x: 0.2, y: 0.4, width: 0.6, height: 0.3 },
    ];
    const merged = mergeRegions(regions);
    expect(merged.x).toBe(0.1);
    expect(merged.y).toBe(0.1);
    expect(merged.width).toBeCloseTo(0.7);
    expect(merged.height).toBeCloseTo(0.6);
  });

  test('single region returns same', () => {
    const regions = [{ x: 0.1, y: 0.1, width: 0.5, height: 0.2 }];
    const merged = mergeRegions(regions);
    expect(merged).toEqual({ x: 0.1, y: 0.1, width: 0.5, height: 0.2 });
  });

  test('empty array returns null', () => {
    expect(mergeRegions([])).toBeNull();
  });
});

const { normalizeRegion } = require('../src/services/ai/geminiService');

describe('normalizeRegion', () => {
  const expected = { x: 0.24, y: 0.135, width: 0.65, height: 0.23 };
  const close = (region) => ({
    x: +region.x.toFixed(3),
    y: +region.y.toFixed(3),
    width: +region.width.toFixed(3),
    height: +region.height.toFixed(3),
  });

  test('accepts the requested x/y/width/height form', () => {
    expect(close(normalizeRegion(expected))).toEqual(expected);
  });

  test('accepts box_2d [ymin, xmin, ymax, xmax] on the 0-1000 scale', () => {
    expect(close(normalizeRegion({ box_2d: [135, 240, 365, 890] }))).toEqual(expected);
  });

  test('accepts a bare corner array', () => {
    expect(close(normalizeRegion([135, 240, 365, 890]))).toEqual(expected);
  });

  test('accepts named corners', () => {
    expect(close(normalizeRegion({ ymin: 135, xmin: 240, ymax: 365, xmax: 890 }))).toEqual(expected);
  });

  test('accepts a 0-100 percentage scale', () => {
    expect(close(normalizeRegion({ x: 24, y: 13.5, width: 65, height: 23 }))).toEqual(expected);
  });

  test('grows a degenerate box to stay visible', () => {
    const region = normalizeRegion({ x: 0.05, y: 0.98, width: 0.9, height: 0.001 });
    expect(region.height).toBeGreaterThanOrEqual(0.03);
  });

  test('returns null for unusable input', () => {
    expect(normalizeRegion({ foo: 1 })).toBeNull();
    expect(normalizeRegion(null)).toBeNull();
  });
});
