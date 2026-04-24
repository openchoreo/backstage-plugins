import { makeStyles } from '@material-ui/core/styles';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import { useChoreoTokens } from '@openchoreo/backstage-design-system';
import {
  getDeletionWarningColor,
  getNodeColor,
  getNodeTintFill,
  withAlpha,
} from '../../utils/graphUtils';

const useStyles = makeStyles(theme => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1),
    backdropFilter: 'blur(8px)',
    border: `1px solid ${theme.palette.divider}`,
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
  workflowplane: 'Workflow Plane',
  observabilityplane: 'Observability Plane',
  clusterdataplane: 'Cluster Data Plane',
  clusterworkflowplane: 'Cluster Workflow Plane',
  clusterobservabilityplane: 'Cluster Obs Plane',
};

export type GraphLegendProps = {
  kinds: string[];
  showDeletionIndicator?: boolean;
};

export function GraphLegend({
  kinds,
  showDeletionIndicator = true,
}: GraphLegendProps) {
  const classes = useStyles();
  const tokens = useChoreoTokens();
  return (
    <Box
      className={classes.root}
      style={{
        backgroundColor: tokens.graph.minimapMask,
        boxShadow: tokens.shadow.md,
      }}
    >
      {kinds.map(kind => (
        <LegendChip key={kind} kind={kind} />
      ))}
      {showDeletionIndicator && <DeletionLegendChip />}
    </Box>
  );
}

function LegendChip({ kind }: { kind: string }) {
  const classes = useStyles();
  const tokens = useChoreoTokens();
  const color = getNodeColor(kind, tokens);
  const label = KIND_LABELS[kind.toLowerCase()] ?? kind;

  return (
    <Chip
      size="small"
      label={label}
      className={classes.chip}
      style={{
        backgroundColor: getNodeTintFill(kind, tokens),
        border: `1px solid ${withAlpha(color, 0.7)}`,
        ['--dot-color' as string]: color,
      }}
    />
  );
}

function DeletionLegendChip() {
  const classes = useStyles();
  const tokens = useChoreoTokens();
  const deletionColor = getDeletionWarningColor(tokens);

  return (
    <Chip
      size="small"
      label="Marked for Deletion"
      className={classes.chip}
      style={{
        backgroundColor: withAlpha(deletionColor, 0.15),
        border: `1px dashed ${withAlpha(deletionColor, 0.7)}`,
        opacity: 0.6,
        ['--dot-color' as string]: deletionColor,
      }}
    />
  );
}
