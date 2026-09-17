import {
  isNegligibleCost,
  formatCost,
  formatCostUsd,
  formatUsd,
  formatEfficiency,
  formatDelta,
} from './format';

describe('isNegligibleCost', () => {
  it('flags non-zero costs that round away at 2 decimals', () => {
    expect(isNegligibleCost(0.00047)).toBe(true);
    expect(isNegligibleCost(0.0049)).toBe(true);
  });

  it('leaves zero and costs that survive rounding alone', () => {
    expect(isNegligibleCost(0)).toBe(false);
    expect(isNegligibleCost(0.005)).toBe(false);
    expect(isNegligibleCost(1.23)).toBe(false);
  });
});

describe('formatCost', () => {
  it('renders costs rounded to 2 decimal places', () => {
    expect(formatCost(1.235)).toBe('1.24');
    expect(formatCost(22)).toBe('22.00');
    expect(formatCost(0)).toBe('0.00');
  });

  it('distinguishes a negligible cost from a zero one', () => {
    expect(formatCost(0.00047)).toBe('<0.01');
    expect(formatCost(0.005)).toBe('0.01');
  });
});

describe('formatCostUsd', () => {
  it('renders a dollar-prefixed cost with 2 decimals', () => {
    expect(formatCostUsd(3.04)).toBe('$3.04');
    expect(formatCostUsd(0)).toBe('$0.00');
  });

  it('distinguishes a negligible cost from a zero one', () => {
    expect(formatCostUsd(0.00086)).toBe('<$0.01');
  });
});

describe('formatUsd', () => {
  it('renders a card headline with a USD prefix and 2 decimals', () => {
    expect(formatUsd(12)).toBe('USD 12.00');
    expect(formatUsd(0.005)).toBe('USD 0.01');
    expect(formatUsd(0)).toBe('USD 0.00');
  });

  it('distinguishes a negligible cost from a zero one', () => {
    expect(formatUsd(0.0004)).toBe('<USD 0.01');
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
