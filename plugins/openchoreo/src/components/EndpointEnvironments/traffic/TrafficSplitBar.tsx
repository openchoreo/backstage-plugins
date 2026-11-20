import { Box, Tooltip, Typography } from '@material-ui/core';
import { makeStyles, useTheme } from '@material-ui/core/styles';
import {
  describeMatch,
  isMirror,
  splitPercents,
  type EndpointTrafficBackend,
} from '@openchoreo/backstage-plugin-common';

/**
 * Six hues led by the portal's indigo, softened to sit with it: teal,
 * violet, clay, sky and berry. They stay apart for every kind of colour
 * vision on the light and the dark surface. Status colours (green, amber,
 * red) are left out, so a backend never reads as a warning. A backend's name
 * always sits next to its colour, so a seventh reuses the first hue without
 * being lost.
 */
const LIGHT = [
  '#5568c4',
  '#14a39a',
  '#a35bc9',
  '#d9825b',
  '#3f8fd2',
  '#c25f8f',
];
const DARK = ['#7183d8', '#17a89e', '#a86bd0', '#c47a55', '#4c96da', '#c96a98'];

/**
 * Each backend's colour, by its position in the Endpoint, so a backend
 * keeps its colour on every card, bar and diagram.
 */
export function backendColors(
  names: string[],
  dark = false,
): Map<string, string> {
  const hues = dark ? DARK : LIGHT;
  return new Map(names.map((n, i) => [n, hues[i % hues.length]]));
}

/**
 * Colours for an Endpoint's backends in the current theme: its own backends
 * first, in order, then any a release still has that the Endpoint dropped.
 */
export function useBackendColors(...lists: { name: string }[][]) {
  const theme = useTheme();
  const names = [...new Set(lists.flat().map(b => b.name))];
  return backendColors(names, theme.palette.type === 'dark');
}

const useStyles = makeStyles(theme => ({
  bar: {
    display: 'flex',
    width: '100%',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    backgroundColor: theme.palette.action.hover,
  },
  segment: {
    height: '100%',
    '& + &': {
      borderLeft: `2px solid ${theme.palette.background.paper}`,
    },
  },
  legend: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5, 2),
    marginTop: theme.spacing(1),
  },
  key: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    fontVariantNumeric: 'tabular-nums',
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    flexShrink: 0,
  },
  line: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
    marginTop: theme.spacing(0.5),
  },
  tag: {
    width: 36,
    flexShrink: 0,
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 0.6,
    color: theme.palette.text.secondary,
  },
}));

export interface TrafficSplitBarProps {
  /** The backends with the values to show: the default or an environment's. */
  backends: EndpointTrafficBackend[];
  /** Colours by backend name; by position when absent. */
  colors?: Map<string, string>;
  /** Show the legend, conditions and copies under the bar. */
  showLegend?: boolean;
  /** Show a line for each condition and copy under the legend. */
  showDetails?: boolean;
  /** Show the bar; off when one backend takes every request. */
  showBar?: boolean;
}

/**
 * A traffic split as a bar of the shares, with each backend's percentage,
 * then a line for each condition and each copy, which aren't part of the
 * shares.
 */
export const TrafficSplitBar = ({
  backends,
  colors,
  showLegend = true,
  showDetails = true,
  showBar = true,
}: TrafficSplitBarProps) => {
  const classes = useStyles();
  const fallback = useBackendColors(backends);
  const palette = colors ?? fallback;
  const shared = backends.filter(b => !isMirror(b));
  const pct = splitPercents(shared.map(b => b.weight));
  const described = shared.map((b, i) => `${b.name} ${pct[i]}%`).join(', ');

  return (
    <Box>
      {showBar && (
        <Box
          className={classes.bar}
          role="img"
          aria-label={`Traffic split: ${described}`}
        >
          {shared.map((b, i) =>
            pct[i] > 0 ? (
              <Tooltip key={b.name} title={`${b.name}: ${pct[i]}%`}>
                <Box
                  className={classes.segment}
                  style={{
                    flexBasis: `${pct[i]}%`,
                    backgroundColor: palette.get(b.name),
                  }}
                  data-testid="split-segment"
                />
              </Tooltip>
            ) : null,
          )}
        </Box>
      )}
      {showLegend && (
        <>
          <Box className={classes.legend}>
            {shared.map((b, i) => (
              <Typography
                key={b.name}
                variant="caption"
                color="textSecondary"
                className={classes.key}
              >
                <span
                  className={classes.swatch}
                  style={{ backgroundColor: palette.get(b.name) }}
                />
                {b.name} <strong>{pct[i]}%</strong>
              </Typography>
            ))}
          </Box>
          {showDetails &&
            backends
              .filter(b => b.match)
              .map(b => (
                <Typography
                  key={`if-${b.name}`}
                  variant="caption"
                  component="div"
                  className={classes.line}
                >
                  <span className={classes.tag}>IF</span>
                  <span>
                    {describeMatch(b.match!)} → {b.name}
                  </span>
                </Typography>
              ))}
          {showDetails &&
            backends.filter(isMirror).map(b => (
              <Typography
                key={`copy-${b.name}`}
                variant="caption"
                component="div"
                className={classes.line}
              >
                <span className={classes.tag}>COPY</span>
                <span>
                  {b.mirror!.percent}% of requests → {b.name}
                </span>
              </Typography>
            ))}
        </>
      )}
    </Box>
  );
};
