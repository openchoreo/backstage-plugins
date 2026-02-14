import { MouseEvent } from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import { makeStyles } from '@material-ui/core/styles';
import {
  Direction,
  EntityNode,
  EntityRelationsGraph,
} from '@backstage/plugin-catalog-graph';
import { CustomGraphNode } from '../CustomGraphNode';
import { GraphLegend } from '../GraphLegend';
import { useAllEntitiesOfKinds } from '../../hooks/useAllEntitiesOfKinds';
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
};

export function PlatformOverviewGraphView({
  view,
  namespace,
  onNodeClick,
}: PlatformOverviewGraphViewProps) {
  const classes = useStyles();
  const { entityRefs, loading, error, entityCount } = useAllEntitiesOfKinds(
    view.kinds,
    namespace,
  );

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
      <EntityRelationsGraph
        rootEntityNames={entityRefs}
        maxDepth={1}
        kinds={view.kinds}
        relations={view.relations}
        relationPairs={view.relationPairs}
        direction={Direction.TOP_BOTTOM}
        renderNode={CustomGraphNode}
        onNodeClick={onNodeClick}
        zoom="enabled"
        mergeRelations
        showArrowHeads
        className={classes.graph}
      />
      <GraphLegend kinds={view.kinds} />
    </Box>
  );
}
