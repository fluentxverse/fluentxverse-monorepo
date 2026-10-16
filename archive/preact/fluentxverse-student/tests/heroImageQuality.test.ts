import { describe, expect, test } from 'bun:test';
import { getHeroRenderSize, getPosterCrop } from '../src/utils/heroImageQuality';

describe('carousel image quality', () => {
  test('UV cropping matches the existing centered cover and zoom without resizing the image', () => {
    for (const [width, height] of [[1732, 908], [1672, 941], [2000, 600], [600, 2000]]) {
      const crop = getPosterCrop(width, height, 1.909);
      expect((width * crop.width) / (height * crop.height)).toBeCloseTo(1.909, 5);
      expect(crop.width).toBeLessThanOrEqual(1);
      expect(crop.height).toBeLessThanOrEqual(1);
      expect(crop.x * 2 + crop.width).toBeCloseTo(1);
      expect(crop.y * 2 + crop.height).toBeCloseTo(1);
    }
  });
  test('regular displays receive supersampling and high-density phones retain 3x detail', () => {
    expect(getHeroRenderSize(1200, 700, 1, 8192)).toEqual({ width: 1800, height: 1050 });
    expect(getHeroRenderSize(390, 800, 3, 8192)).toEqual({ width: 1170, height: 2400 });
    expect(getHeroRenderSize(1920, 1086, 2, 8192)).toEqual({ width: 3840, height: 2172 });
  });
  test('large and extreme-DPR screens stay within the GPU pixel and dimension budgets', () => {
    for (const [width, height, dpr, limit] of [[3840, 2160, 3, 8192], [430, 900, 5, 8192], [8000, 500, 2, 1024]]) {
      const size = getHeroRenderSize(width, height, dpr, limit);
      expect(size.width * size.height).toBeLessThanOrEqual(width <= 768 ? 4_000_000 : 9_000_000);
      expect(size.width).toBeLessThanOrEqual(limit);
      expect(size.height).toBeLessThanOrEqual(limit);
      expect(size.width / size.height).toBeCloseTo(width / height, 1);
    }
  });
});
