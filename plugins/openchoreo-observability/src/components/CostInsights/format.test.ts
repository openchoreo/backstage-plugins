import { formatCost, formatUsd, formatEfficiency, formatDelta } from './format';

describe('formatCost', () => {
  it('renders costs with 5 decimal places so sub-cent values stay visible', () => {
    expect(formatCost(0.00047)).toBe('0.00047');
    expect(formatCost(0.00024)).toBe('0.00024');
    expect(formatCost(22)).toBe('22.00000');
    expect(formatCost(0)).toBe('0.00000');
  });
});

describe('formatUsd', () => {
  it('renders a card headline with a USD prefix and 2 decimals', () => {
    expect(formatUsd(12)).toBe('USD 12.00');
    expect(formatUsd(0.005)).toBe('USD 0.01');
    expect(formatUsd(0)).toBe('USD 0.00');
  });
});

describe('formatEfficiency', () => {
  it('renders a 0..1 ratio as a rounded percentage', () => {
    expect(formatEfficiency(0.3)).toBe('30%');
    expect(formatEfficiency(0.456)).toBe('46%');
    expect(formatEfficiency(1)).toBe('100%');
    expect(formatEfficiency(0)).toBe('0%');
  });
});

describe('formatDelta', () => {
  it('prefixes positive deltas with a sign and rounds', () => {
    expect(formatDelta(10)).toBe('+10%');
    expect(formatDelta(10.4)).toBe('+10%');
  });

  it('renders negative deltas without an extra sign', () => {
    expect(formatDelta(-3)).toBe('-3%');
  });

  it('renders an em dash for null / non-finite deltas', () => {
    expect(formatDelta(null)).toBe('—');
    expect(formatDelta(Infinity)).toBe('—');
    expect(formatDelta(NaN)).toBe('—');
  });
});
