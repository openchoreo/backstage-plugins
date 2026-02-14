import { makeStyles, useTheme } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import {
  ENTITY_KIND_COLORS,
  DEFAULT_NODE_COLOR,
  getNodeTintFill,
} from '../../utils/graphUtils';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    backgroundColor:
      theme.palette.type === 'dark'
        ? 'rgba(30, 30, 30, 0.75)'
        : 'rgba(255, 255, 255, 0.75)',
    backdropFilter: 'blur(8px)',
    border: `1px solid ${theme.palette.divider}`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    borderRadius: theme.shape.borderRadius,
  },
  chip: {
    height: 24,
    fontSize: '0.75rem',
    color: theme.palette.text.primary,
    '& .MuiChip-label': {
      display: 'flex',
      alignItems: 'center',
    },
    '& .MuiChip-label::before': {
      content: '""',
      display: 'inline-block',
      width: 8,
      height: 8,
      minWidth: 8,
      borderRadius: '50%',
      marginRight: 4,
      backgroundColor: 'var(--dot-color)',
    },
  },
}));

const KIND_LABELS: Record<string, string> = {
  domain: 'Namespace',
  system: 'Project',
  component: 'Component',
  componenttype: 'Component Type',
  deploymentpipeline: 'Pipeline',
  environment: 'Environment',
  dataplane: 'Data Plane',
  buildplane: 'Build Plane',
  observabilityplane: 'Observability Plane',
};

export type GraphLegendProps = {
  kinds: string[];
};

export function GraphLegend({ kinds }: GraphLegendProps) {
  return (
    <Box className={useStyles().root}>
      {kinds.map(kind => (
        <LegendChip key={kind} kind={kind} />
      ))}
    </Box>
  );
}

function LegendChip({ kind }: { kind: string }) {
  const classes = useStyles();
  const theme = useTheme();
  const color = ENTITY_KIND_COLORS[kind.toLowerCase()] ?? DEFAULT_NODE_COLOR;
  const label = KIND_LABELS[kind.toLowerCase()] ?? kind;
  const isDark = theme.palette.type === 'dark';

  return (
    <Chip
      size="small"
      label={label}
      className={classes.chip}
      style={{
        backgroundColor: getNodeTintFill(color, isDark),
        border: `1px solid ${color}B3`,
        ['--dot-color' as string]: color,
      }}
    />
  );
}
