const ROUNDS_TO_ZERO_BELOW = 0.005;

export function isNegligibleCost(value: number): boolean {
  return value > 0 && value < ROUNDS_TO_ZERO_BELOW;
}

/** Format a cost number for a table cell, e.g. `3.04` / `<0.01`. */
export function formatCost(value: number): string {
  return isNegligibleCost(value) ? '<0.01' : value.toFixed(2);
}

/** Format a cost with a `$` prefix, e.g. `$3.04` / `<$0.01`. */
export function formatCostUsd(value: number): string {
  return isNegligibleCost(value) ? '<$0.01' : `$${value.toFixed(2)}`;
}

/** Format a cost as a card headline, e.g. `USD 12.00` / `<USD 0.01`. */
export function formatUsd(value: number): string {
  return isNegligibleCost(value) ? '<USD 0.01' : `USD ${value.toFixed(2)}`;
}

/** Format an efficiency ratio (0..1) as a percentage, e.g. `45%`. */
export function formatEfficiency(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Format a signed delta percentage, e.g. `+10%` / `-3%` / `—`. */
export function formatDelta(deltaPct: number | null): string {
  if (deltaPct === null || !Number.isFinite(deltaPct)) return '—';
  const rounded = Math.round(deltaPct);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}
