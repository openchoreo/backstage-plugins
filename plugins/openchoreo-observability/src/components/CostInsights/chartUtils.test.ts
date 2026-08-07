import {
  PALETTE_DARK,
  PALETTE_LIGHT,
  buildColorMap,
  formatAxisCost,
  formatBucket,
  savingColor,
} from './chartUtils';

describe('savingColor', () => {
  it('picks a theme-aware green', () => {
    expect(savingColor(true)).not.toBe(savingColor(false));
  });
});

describe('buildColorMap', () => {
  it('assigns a palette colour per key and wraps past the palette length', () => {
    const keys = Array.from(
      { length: PALETTE_LIGHT.length + 1 },
      (_, i) => `k${i}`,
    );
    const map = buildColorMap(keys, PALETTE_LIGHT);
    expect(map.get('k0')).toBe(PALETTE_LIGHT[0]);
    // Wraps: the (n+1)th key reuses the first colour.
    expect(map.get(`k${PALETTE_LIGHT.length}`)).toBe(PALETTE_LIGHT[0]);
  });

  it('works with the dark palette', () => {
    expect(buildColorMap(['a'], PALETTE_DARK).get('a')).toBe(PALETTE_DARK[0]);
  });
});

describe('formatAxisCost', () => {
  it('scales decimal precision to the magnitude', () => {
    expect(formatAxisCost(0)).toBe('$0');
    expect(formatAxisCost(0.005)).toBe('$0.0050');
    expect(formatAxisCost(0.05)).toBe('$0.050');
    expect(formatAxisCost(0.5)).toBe('$0.50');
    expect(formatAxisCost(5)).toBe('$5.0');
    expect(formatAxisCost(50)).toBe('$50');
  });

  it('scales negative values by magnitude', () => {
    expect(formatAxisCost(-0.005)).toBe('$-0.0050');
  });
});

describe('formatBucket', () => {
  it('formats a valid ISO timestamp', () => {
    expect(formatBucket('2026-07-01T00:00:00.000Z')).toMatch(/\d/);
  });

  it('returns the input unchanged when it is not a date', () => {
    expect(formatBucket('not-a-date')).toBe('not-a-date');
  });
});
