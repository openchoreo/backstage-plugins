import { useEffect, useState } from 'react';
import { Box, Typography } from '@material-ui/core';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import LinkIcon from '@material-ui/icons/Link';
import type { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import {
  catalogApiRef,
  EntityRefLink,
  useEntity,
} from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import {
  CHOREO_ANNOTATIONS,
  type HookBinding,
} from '@openchoreo/backstage-plugin-common';
import { useDataplaneOverviewStyles } from '../DataplaneOverview/styles';

export interface HookBindingRow {
  environmentRef: string;
  environmentName: string;
  phase: 'preDeploy' | 'postDeploy';
  binding: HookBinding;
}

/**
 * Walks every Environment entity and collects the bindings that reference the
 * given hook. A namespaced Hook only matches environments in its own
 * OpenChoreo namespace; a ClusterHook matches everywhere.
 */
export function collectBindings(
  hook: Entity,
  environments: Entity[],
): HookBindingRow[] {
  const isCluster = hook.kind === 'ClusterHook';
  const hookNs = hook.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
  const wantKind = isCluster ? 'ClusterHook' : 'Hook';
  const rows: HookBindingRow[] = [];

  for (const env of environments) {
    const envNs = env.metadata.annotations?.[CHOREO_ANNOTATIONS.NAMESPACE];
    if (!isCluster && hookNs && envNs !== hookNs) continue;

    const hooks = (env.spec as { hooks?: Record<string, HookBinding[]> })
      ?.hooks;
    for (const phase of ['preDeploy', 'postDeploy'] as const) {
      for (const binding of hooks?.[phase] ?? []) {
        if ((binding.hookRef?.kind ?? 'Hook') !== wantKind) continue;
        if (binding.hookRef?.name !== hook.metadata.name) continue;
        rows.push({
          environmentRef: `environment:${env.metadata.namespace || 'default'}/${
            env.metadata.name
          }`,
          environmentName: env.metadata.title || env.metadata.name,
          phase,
          binding,
        });
      }
    }
  }
  return rows;
}

/** Lists the environment bindings that reference this hook. */
export const HookBindingsCard = () => {
  const classes = useDataplaneOverviewStyles();
  const { entity } = useEntity();
  const catalogApi = useApi(catalogApiRef);
  const [rows, setRows] = useState<HookBindingRow[] | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    catalogApi
      .getEntities({ filter: { kind: 'Environment' } })
      .then(({ items }) => {
        if (!cancelled) setRows(collectBindings(entity, items));
      })
      .catch(err => {
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [catalogApi, entity]);

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Bindings</Typography>
      </Box>
      {error && (
        <Typography variant="body2" color="error">
          Could not load environments: {error}
        </Typography>
      )}
      {!error && rows === undefined && (
        <Typography variant="body2">Loading bindings…</Typography>
      )}
      {!error && rows && rows.length === 0 && (
        <Box className={classes.statusItem}>
          <LinkIcon className={classes.statusIcon} />
          <Typography variant="body2">
            Not bound by any environment yet
          </Typography>
        </Box>
      )}
      {!error && rows && rows.length > 0 && (
        <Table size="small" aria-label="Hook bindings">
          <TableHead>
            <TableRow>
              <TableCell>Environment</TableCell>
              <TableCell>Phase</TableCell>
              <TableCell>Mode</TableCell>
              <TableCell>On failure</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map(row => (
              <TableRow
                key={`${row.environmentRef}/${row.phase}/${row.binding.name}`}
              >
                <TableCell>
                  <EntityRefLink
                    entityRef={row.environmentRef}
                    title={row.environmentName}
                  />
                </TableCell>
                <TableCell>
                  {row.phase === 'preDeploy' ? 'pre-deploy' : 'post-deploy'} ·{' '}
                  {row.binding.name}
                </TableCell>
                <TableCell>{row.binding.mode ?? 'Sync'}</TableCell>
                <TableCell>
                  {row.binding.onFailure ??
                    (row.phase === 'preDeploy' ? 'Block' : 'Ignore')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
};
