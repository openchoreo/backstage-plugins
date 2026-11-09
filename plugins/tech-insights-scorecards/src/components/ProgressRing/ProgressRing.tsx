import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';
import { useTheme } from '@material-ui/core/styles';

export interface ProgressRingProps {
  /** Percentage, 0 to 100. Undefined while loading. */
  value?: number;
  size: number;
  /** What the percentage measures, read out by screen readers. */
  label: string;
}

/** A percentage in the middle of a ring that fills to it. */
export function ProgressRing({ value, size, label }: ProgressRingProps) {
  const theme = useTheme();
  const thickness = 4;
  return (
    <Box
      position="relative"
      display="inline-flex"
      flexShrink={0}
      role="img"
      aria-label={value === undefined ? label : `${label}: ${value}%`}
    >
      <CircularProgress
        variant="determinate"
        value={100}
        size={size}
        thickness={thickness}
        style={{ color: theme.palette.divider, position: 'absolute' }}
      />
      <CircularProgress
        variant="determinate"
        value={value ?? 0}
        size={size}
        thickness={thickness}
        style={{
          color: theme.palette.status?.ok ?? theme.palette.primary.main,
        }}
      />
      <Box
        position="absolute"
        top={0}
        left={0}
        bottom={0}
        right={0}
        display="flex"
        alignItems="center"
        justifyContent="center"
        aria-hidden
      >
        <Typography
          component="div"
          style={{ fontSize: size / 4, fontWeight: 600 }}
        >
          {value === undefined ? '—' : `${value}%`}
        </Typography>
      </Box>
    </Box>
  );
}
