import Chip from '@material-ui/core/Chip';
import { useTheme } from '@material-ui/core/styles';
import { getFilledTierColors, getTierColor } from '../tierPalette';
import { useTierLabel } from './useTierLabel';

export interface TierChipProps {
  rank: number;
  /**
   * `filled` for a summary (an entity's tier, a tier count), `outlined` for a
   * tier shown on a row (a check's tier). Defaults to `outlined`.
   */
  emphasis?: 'filled' | 'outlined';
  /** Replaces the tier name, e.g. "Bronze: 3" for a count. */
  label?: string;
}

/**
 * In place of a tier for an entity no check covers, which would otherwise
 * read as Stone.
 */
export function NotScoredChip() {
  return <Chip size="small" variant="outlined" label="Not scored" />;
}

/** A tier chip, coloured per tier for the theme. */
export function TierChip({
  rank,
  emphasis = 'outlined',
  label,
}: TierChipProps) {
  const theme = useTheme();
  const tierLabel = useTierLabel();
  const text = label ?? tierLabel(rank);
  if (emphasis === 'filled') {
    const { background, text: textColor } = getFilledTierColors(rank, theme);
    return (
      <Chip
        size="small"
        label={text}
        style={{
          backgroundColor: background,
          color: textColor,
          fontWeight: 600,
        }}
      />
    );
  }
  const color = getTierColor(rank, theme);
  return (
    <Chip
      size="small"
      variant="outlined"
      label={text}
      style={{ borderColor: color, color }}
    />
  );
}
