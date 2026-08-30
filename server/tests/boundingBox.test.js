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
