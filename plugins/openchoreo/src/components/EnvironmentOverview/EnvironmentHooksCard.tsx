import { Box, Typography } from '@material-ui/core';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import { makeStyles } from '@material-ui/core/styles';
import { EntityRefLink, useEntity } from '@backstage/plugin-catalog-react';
import { Card } from '@openchoreo/backstage-design-system';
import type { HookBinding, HookSet } from '@openchoreo/backstage-plugin-common';
import {
  effectiveOnFailure,
  type HookGatePhase,
} from '../Environments/hooks/hookModel';
import { useEnvironmentOverviewStyles } from './styles';

/** Catalog namespace cluster-scoped OpenChoreo entities live in. */
const CLUSTER_ENTITY_NAMESPACE = 'openchoreo-cluster';

const useLocalStyles = makeStyles(theme => ({
  phase: {
    marginTop: theme.spacing(2),
    '&:first-of-type': {
      marginTop: 0,
    },
  },
  phaseTitle: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: theme.palette.text.secondary,
  },
  hint: {
    marginBottom: theme.spacing(1),
  },
  mono: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
    fontSize: '0.75rem',
  },
}));

const PHASES: {
  key: HookGatePhase;
  title: string;
  hint: string;
  empty: string;
}[] = [
  {
    key: 'preDeploy',
    title: 'Before deploy',
    hint: 'Run before a release is deployed here; a Sync hook with on failure Block stops the deployment.',
    empty: 'No pre-deploy hooks.',
  },
  {
    key: 'postDeploy',
    title: 'After deploy',
    hint: 'Run once the release is ready; Alert marks the deployment degraded until acknowledged.',
    empty: 'No post-deploy hooks.',
  },
];

function hookEntityRef(binding: HookBinding, namespace: string): string {
  const cluster = binding.hookRef.kind === 'ClusterHook';
  return `${cluster ? 'clusterhook' : 'hook'}:${
    cluster ? CLUSTER_ENTITY_NAMESPACE : namespace
  }/${binding.hookRef.name}`;
}

/** What a failed run of this binding does to the deployment. */
export function failureText(binding: HookBinding, phase: HookGatePhase) {
  if ((binding.mode ?? 'Sync') === 'Async') return 'never blocks';
  return effectiveOnFailure(binding, phase);
}

/**
 * Deployment hooks (alpha) bound on this environment, split into the phase
 * they run in. They run for every component deployed here, whichever
 * pipeline path the release took.
 */
export const EnvironmentHooksCard = () => {
  const classes = useEnvironmentOverviewStyles();
  const local = useLocalStyles();
  const { entity } = useEntity();
  const hooks = (entity.spec as { hooks?: HookSet } | undefined)?.hooks;
  const namespace = entity.metadata.namespace || 'default';

  return (
    <Card padding={24} className={classes.card}>
      <Box className={classes.cardHeader}>
        <Typography variant="h5">Deployment hooks</Typography>
      </Box>
      {PHASES.map(({ key, title, hint, empty }) => {
        const bindings = hooks?.[key] ?? [];
        return (
          <Box
            key={key}
            className={local.phase}
            data-testid={`env-hooks-${key}`}
          >
            <Typography className={local.phaseTitle}>{title}</Typography>
            <Typography
              variant="body2"
              color="textSecondary"
              className={local.hint}
            >
              {hint}
            </Typography>
            {bindings.length === 0 ? (
              <Typography variant="body2" color="textSecondary">
                {empty}
              </Typography>
            ) : (
              <Table size="small" aria-label={`${title} hooks`}>
                <TableHead>
                  <TableRow>
                    <TableCell>Binding</TableCell>
                    <TableCell>Hook</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>On failure</TableCell>
                    <TableCell>Timeout</TableCell>
                    <TableCell>Applies to</TableCell>
                    <TableCell>Parameters</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bindings.map(b => {
                    const sync = (b.mode ?? 'Sync') === 'Sync';
                    const params = Object.entries(b.parameters ?? {});
                    return (
                      <TableRow key={b.name}>
                        <TableCell>{b.name}</TableCell>
                        <TableCell>
                          <EntityRefLink
                            entityRef={hookEntityRef(b, namespace)}
                            title={b.hookRef.name}
                          />
                        </TableCell>
                        <TableCell>{b.mode ?? 'Sync'}</TableCell>
                        <TableCell>{failureText(b, key)}</TableCell>
                        <TableCell>{sync ? b.timeout ?? '30m' : '—'}</TableCell>
                        <TableCell>
                          {b.appliesTo?.length
                            ? b.appliesTo.map(a => a.name).join(', ')
                            : 'all components'}
                        </TableCell>
                        <TableCell className={local.mono}>
                          {params.length
                            ? params.map(([k, v]) => `${k}=${v}`).join(', ')
                            : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        );
      })}
    </Card>
  );
};
