import { Box, Chip, Typography } from '@material-ui/core';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import PlayCircleOutlineIcon from '@material-ui/icons/PlayCircleOutline';
import AccessTimeIcon from '@material-ui/icons/AccessTime';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import { CHOREO_ANNOTATIONS } from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';
import {
  PARAMETER_SOURCE_LABELS,
  parameterSource,
  parameterValue,
  readHookSpec,
  workflowEntityRef,
} from './hookSpec';

/**
 * Overview card for Hook / ClusterHook entities: executor, the workflow it
 * runs, the component types it is enabled for, and the parameter mapping.
 */
export const HookOverviewCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();

  const isCluster = entity.kind === 'ClusterHook';
  const annotations = entity.metadata.annotations || {};
  const createdAt = annotations[CHOREO_ANNOTATIONS.CREATED_AT];
  const description = entity.metadata.description;
  const spec = readHookSpec(entity);

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">
          {isCluster ? 'Cluster Hook Details' : 'Hook Details'}
        </Typography>
      </Box>

      <Box className={classes.statusGrid}>
        <Box className={classes.statusItem}>
          <PlayCircleOutlineIcon className={classes.statusIcon} />
          <Box>
            <Typography className={classes.statusLabel}>Executor</Typography>
            <Typography className={classes.statusValue}>
              {spec?.type ?? 'Workflow'}
            </Typography>
          </Box>
        </Box>

        {spec && (
          <Box className={classes.statusItem}>
            <PlayCircleOutlineIcon className={classes.statusIcon} />
            <Box>
              <Typography className={classes.statusLabel}>Runs</Typography>
              <Typography className={classes.statusValue}>
                <EntityRefLink
                  entityRef={workflowEntityRef(entity, spec)}
                  title={`${spec.workflowRef.kind ?? 'ClusterWorkflow'} / ${
                    spec.workflowRef.name
                  }`}
                />
              </Typography>
            </Box>
          </Box>
        )}

        {createdAt && (
          <Box className={classes.statusItem}>
            <AccessTimeIcon className={classes.statusIcon} />
            <Box>
              <Typography className={classes.statusLabel}>Created</Typography>
              <Typography className={classes.statusValue}>
                {formatDate(createdAt)}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {description && (
        <Box mt={2}>
          <Typography className={classes.statusLabel} gutterBottom>
            Description
          </Typography>
          <Typography variant="body2">{description}</Typography>
        </Box>
      )}

      <Box mt={2}>
        <Typography className={classes.statusLabel} gutterBottom>
          Enabled for
        </Typography>
        {spec?.enabledTo && spec.enabledTo.length > 0 ? (
          <Box display="flex" flexWrap="wrap" style={{ gap: 6 }}>
            {spec.enabledTo.map(ref => (
              <Chip
                key={`${ref.kind}/${ref.name}`}
                size="small"
                variant="outlined"
                label={`${ref.kind} / ${ref.name}`}
              />
            ))}
          </Box>
        ) : (
          <Typography variant="body2">
            Every component type (no restriction)
          </Typography>
        )}
      </Box>

      <Box mt={2}>
        <Typography className={classes.statusLabel} gutterBottom>
          Parameter mapping
        </Typography>
        {spec?.parameters && spec.parameters.length > 0 ? (
          <Table size="small" aria-label="Parameter mapping">
            <TableHead>
              <TableRow>
                <TableCell>Input</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {spec.parameters.map(p => (
                <TableRow key={p.name}>
                  <TableCell>
                    <code>{p.name}</code>
                  </TableCell>
                  <TableCell>
                    {PARAMETER_SOURCE_LABELS[parameterSource(p)]}
                  </TableCell>
                  <TableCell>
                    <code>{parameterValue(p)}</code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2">
            No parameters are mapped; the workflow runs with its defaults.
          </Typography>
        )}
      </Box>
    </Card>
  );
};
