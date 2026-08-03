import { CircularProgress } from '@material-ui/core';

/**
 * Named spinner sizes (px). Replaces the ad-hoc `size={12|14|16|18|20|24|40}`
 * spread across the app so every spinner reads at one of a few deliberate
 * scales:
 * - `chip`   — inside a status chip / dense badge
 * - `button` — a button start-icon while an action is in flight
 * - `inline` — next to text, in an input adornment, or a small widget
 * - `page`   — a large centred spinner for a section/page-level load
 */
const SIZE_MAP = {
  chip: 14,
  button: 16,
  inline: 20,
  page: 40,
} as const;

export interface SpinnerProps {
  /**
   * Named size or an explicit pixel value.
   * @default 'inline'
   */
  size?: keyof typeof SIZE_MAP | number;
  /**
   * Theme colour. Prefer the theme over hardcoded hex so spinners stay
   * on-brand in both light and dark modes.
   * @default 'primary'
   */
  color?: 'primary' | 'secondary' | 'inherit';
  className?: string;
  /** Accessible label; falls back to the platform default when omitted. */
  'aria-label'?: string;
}

/**
 * The single, theme-driven spinner for indeterminate action/loading feedback.
 *
 * Prefer this over raw MUI `CircularProgress` so size and colour stay
 * consistent. For first-load *placeholders* use `Skeleton` instead; for a
 * loading/error/empty/content state machine use `ContentLoader`
 * (from `@openchoreo/backstage-plugin-react`).
 *
 * @example
 * ```tsx
 * <Spinner size="button" />           // in a button start-icon
 * <Spinner size="page" />             // centred section loader
 * <Spinner size="chip" color="inherit" />
 * ```
 */
export const Spinner = ({
  size = 'inline',
  color = 'primary',
  className,
  'aria-label': ariaLabel,
}: SpinnerProps) => {
  const px = typeof size === 'number' ? size : SIZE_MAP[size];
  return (
    <CircularProgress
      size={px}
      color={color}
      className={className}
      aria-label={ariaLabel}
    />
  );
};
