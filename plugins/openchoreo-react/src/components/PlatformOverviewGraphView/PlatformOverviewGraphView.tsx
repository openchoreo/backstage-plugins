import { MouseEvent } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import {
  DependencyGraph,
  DependencyGraphTypes,
} from '@backstage/core-components';
import { EntityNode } from '@backstage/plugin-catalog-graph';
import { CustomGraphNode } from '../CustomGraphNode';
import { GraphLegend } from '../GraphLegend';
import { DefaultRenderLabel } from '../DefaultRenderLabel';
import { useAllEntitiesOfKinds } from '../../hooks/useAllEntitiesOfKinds';
import { useEntityGraphData } from '../../hooks/useEntityGraphData';
import type { GraphViewDefinition } from '../../utils/platformOverviewConstants';

const useStyles = makeStyles(theme => ({
  graphWrapper: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    display: 'flex',
  },
  graph: {
    flex: 1,
    minHeight: 0,
  },
  centered: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
}));

export type PlatformOverviewGraphViewProps = {
  view: GraphViewDefinition;
  namespace?: string;
  onNodeClick?: (node: EntityNode, event: MouseEvent<unknown>) => void;
  direction?: DependencyGraphTypes.Direction;
  nodeMargin?: number;
  rankMargin?: number;
};

export function PlatformOverviewGraphView({
  view,
  namespace,
  onNodeClick,
  direction = DependencyGraphTypes.Direction.LEFT_RIGHT,
  nodeMargin = 100,
  rankMargin = 100,
}: PlatformOverviewGraphViewProps) {
  const classes = useStyles();
  const {
    entityRefs,
    loading: refsLoading,
    error: refsError,
    entityCount,
  } = useAllEntitiesOfKinds(view.kinds, namespace);

  const {
    nodes,
    edges,
    loading: graphLoading,
    error: graphError,
  } = useEntityGraphData(entityRefs, view, onNodeClick);

  const loading = refsLoading || graphLoading;
  const error = refsError || graphError;

  if (loading) {
    return (
      <Box className={classes.centered}>
        <CircularProgress />
        <Typography variant="body2" color="textSecondary">
          Loading entities...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box className={classes.centered}>
        <Typography variant="h6" color="error">
          Failed to load entities
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {error.message}
        </Typography>
      </Box>
    );
  }

  if (entityCount === 0) {
    return (
      <Box className={classes.centered}>
        <Typography variant="h6" color="textSecondary">
          No entities found
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {view.description}
        </Typography>
      </Box>
    );
  }

  return (
    <Box className={classes.graphWrapper}>
      <Box className={classes.graph}>
        <DependencyGraph
          nodes={nodes}
          edges={edges}
          renderNode={CustomGraphNode}
          renderLabel={DefaultRenderLabel}
          direction={direction}
          nodeMargin={nodeMargin}
          rankMargin={rankMargin}
          zoom="enabled"
          showArrowHeads
          curve="curveMonotoneX"
          fit="contain"
          labelPosition={DependencyGraphTypes.LabelPosition.RIGHT}
          labelOffset={8}
        />
      </Box>
      <GraphLegend kinds={view.kinds} />
    </Box>
  );
}
