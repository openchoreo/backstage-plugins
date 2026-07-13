import { Box, Card, CardContent, Chip, Typography } from '@material-ui/core';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import { makeStyles } from '@material-ui/core/styles';
import { DoraClassification } from '../../types';
import { CLASSIFICATION_COLORS } from './utils';

const SPARK_W = 84;
const SPARK_H = 30;

const useStyles = makeStyles(theme => ({
  card: {
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  title: {
    fontWeight: 500,
    color: theme.palette.text.secondary,
  },
  value: {
    fontWeight: 600,
    marginTop: theme.spacing(1),
  },
  chip: {
    fontWeight: 600,
    height: 22,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
    minHeight: 20,
  },
  // Keeps the footer text clear of the absolutely-positioned corner sparkline.
  footerWithSpark: {
    paddingRight: SPARK_W + 16,
  },
  delta: {
    display: 'flex',
    alignItems: 'center',
    fontWeight: 500,
  },
  deltaIcon: {
    fontSize: 14,
  },
  subText: {
    color: theme.palette.text.secondary,
  },
}));

export interface DoraMetricTileProps {
  title: string;
  /** Pre-formatted headline value (e.g. "1.14/day", "5.7h", "7.3%"). */
  value: string;
  classification: DoraClassification;
  /** Change vs the previous window (%); null hides the delta. */
  deltaPct: number | null;
  /** Whether an increase in this metric is an improvement (colors the delta). */
  positiveDeltaIsGood: boolean;
  /** Secondary line, e.g. "302 deployments" or "96% commit coverage". */
  subText?: string;
  /** Per-bucket values rendered as a small sparkline in the tile corner. */
  sparkData?: number[];
}

const Sparkline = ({ data }: { data: number[] }) => {
  if (data.length < 2) {
    return null;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * SPARK_W;
      const y = SPARK_H - 3 - ((v - min) / range) * (SPARK_H - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      aria-hidden
      style={{ position: 'absolute', right: 12, bottom: 10, opacity: 0.85 }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="#1f77b4"
        strokeWidth={1.8}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const DoraMetricTile = ({
  title,
  value,
  classification,
  deltaPct,
  positiveDeltaIsGood,
  subText,
  sparkData,
}: DoraMetricTileProps) => {
  const classes = useStyles();
  const colors = CLASSIFICATION_COLORS[classification];

  const deltaIsImprovement =
    deltaPct !== null && (deltaPct >= 0) === positiveDeltaIsGood;
  const deltaColor = deltaIsImprovement ? '#1e7e34' : '#c62828';

  return (
    <Card className={classes.card} variant="outlined" style={{ position: 'relative' }}>
      {sparkData && <Sparkline data={sparkData} />}
      <CardContent>
        <Box className={classes.header}>
          <Typography variant="body2" className={classes.title}>
            {title}
          </Typography>
          <Chip
            size="small"
            label={classification}
            className={classes.chip}
            style={{ backgroundColor: colors.background, color: colors.text }}
          />
        </Box>
        <Typography variant="h4" className={classes.value}>
          {value}
        </Typography>
        <Box
          className={`${classes.footer} ${
            sparkData ? classes.footerWithSpark : ''
          }`}
        >
          {deltaPct !== null && deltaPct !== 0 && (
            <Typography
              variant="caption"
              className={classes.delta}
              style={{ color: deltaColor }}
            >
              {deltaPct > 0 ? (
                <ArrowUpwardIcon className={classes.deltaIcon} />
              ) : (
                <ArrowDownwardIcon className={classes.deltaIcon} />
              )}
              {Math.abs(deltaPct).toFixed(1)}%
            </Typography>
          )}
          {subText && (
            <Typography variant="caption" className={classes.subText}>
              {subText}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
