import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import { ENTITY_KIND_COLORS, DEFAULT_NODE_COLOR } from '../../utils/graphUtils';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: theme.shape.borderRadius,
  },
  chip: {
    height: 24,
    fontSize: '0.75rem',
    color: '#fff',
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
  const color = ENTITY_KIND_COLORS[kind.toLowerCase()] ?? DEFAULT_NODE_COLOR;
  const label = KIND_LABELS[kind.toLowerCase()] ?? kind;

  return (
    <Chip
      size="small"
      label={label}
      className={classes.chip}
      style={{ backgroundColor: color }}
    />
  );
}
