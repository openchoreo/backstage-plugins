/** Format a cost number for a table cell, e.g. `0.00047`. */
export function formatCost(value: number): string {
  return value.toFixed(5);
}

/** Format a cost as a card headline, e.g. `USD 12.00`. */
export function formatUsd(value: number): string {
  return `USD ${value.toFixed(2)}`;
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
