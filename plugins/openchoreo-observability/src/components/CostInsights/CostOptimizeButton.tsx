import { useCallback, useState } from 'react';
import {
  Button,
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tooltip,
  Typography,
} from '@material-ui/core';
import CheckIcon from '@material-ui/icons/Check';
import { Alert, AlertTitle } from '@material-ui/lab';
import { useApi, discoveryApiRef } from '@backstage/core-plugin-api';
import { openChoreoFetchApiRef } from '@openchoreo/backstage-plugin-react';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { stringifyEntityRef } from '@backstage/catalog-model';
import {
  ChangesList,
  useEnvScopedPermission,
  useOpenChoreoQuery,
} from '@openchoreo/backstage-plugin-react';
import {
  CHOREO_ANNOTATIONS,
  MAIN_RELEASE_LINE,
  openchoreoReleaseBindingUpdatePermission,
} from '@openchoreo/backstage-plugin-common';
import { applyResourceChange } from '../../utils/applyResourceChange';
import { useComponentReleaseLineState } from '../../hooks/useComponentReleaseLines';
import { useSelectedReleaseLine } from '../../hooks/useSelectedReleaseLine';
import {
  buildOptimizeChange,
  buildRecommendationChanges,
  resolveReleaseBindingName,
} from './optimizeChange';
import type { CostRowRecommendation, CostScope } from './types';

interface CostOptimizeButtonProps {
  /** Environment name (the component-level row key). */
  env: string;
  recommendation: CostRowRecommendation;
  scope: CostScope;
  /** Called after a successful apply so the page can refetch cost data. */
  onOptimized: () => void;
  /** Disable the button (e.g. when the recommendation makes no change). */
  disabled?: boolean;
}

type ApplyStatus = 'idle' | 'applying' | 'success' | 'failed';

/** Resolve the component's catalog entity ref, for env-scoped permission checks. */
function useComponentEntityRef(scope: CostScope): string | undefined {
  const catalogApi = useApi(catalogApiRef);
  const { data } = useOpenChoreoQuery<string | null>(
    [
      'cost-insights-component-ref',
      scope.namespace ?? '',
      scope.project ?? '',
      scope.component ?? '',
    ],
    async () => {
      const { items } = await catalogApi.getEntities({
        filter: {
          kind: 'Component',
          'metadata.name': scope.component!,
          [`metadata.annotations.${CHOREO_ANNOTATIONS.NAMESPACE}`]:
            scope.namespace!,
          [`metadata.annotations.${CHOREO_ANNOTATIONS.PROJECT}`]:
            scope.project!,
        },
        fields: ['kind', 'metadata.name', 'metadata.namespace'],
      });
      const entity = items[0];
      return entity ? stringifyEntityRef(entity) : null;
    },
    {
      enabled: Boolean(scope.namespace && scope.project && scope.component),
    },
  );
  return data ?? undefined;
}

export const CostOptimizeButton = ({
  env,
  recommendation,
  scope,
  onOptimized,
  disabled: disabledProp,
}: CostOptimizeButtonProps) => {
  const fetchApi = useApi(openChoreoFetchApiRef);
  const discovery = useApi(discoveryApiRef);

  const resourceRef = useComponentEntityRef(scope);
  const { allowed, loading: permissionLoading } = useEnvScopedPermission({
    permission: openchoreoReleaseBindingUpdatePermission,
    resourceRef: resourceRef ?? '',
    environment: env,
  });

  // The recommendation covers the selected line, or every line of the
  // component when none is selected, which no single binding matches.
  const releaseLine = useSelectedReleaseLine();
  const componentLines = useComponentReleaseLineState(
    scope.namespace,
    scope.component,
  );
  const lineRequired = !releaseLine && componentLines.lines.length > 0;

  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ApplyStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleApply = useCallback(async () => {
    setStatus('applying');
    setErrorMsg('');
    try {
      const [observabilityBaseUrl, openchoreoBaseUrl] = await Promise.all([
        discovery.getBaseUrl('openchoreo-observability-backend'),
        discovery.getBaseUrl('openchoreo'),
      ]);

      const releaseBinding = await resolveReleaseBindingName({
        openchoreoBaseUrl,
        fetchApi,
        namespaceName: scope.namespace!,
        projectName: scope.project!,
        componentName: scope.component!,
        environment: env,
        releaseLine,
      });

      await applyResourceChange({
        backendBaseUrl: observabilityBaseUrl,
        fetchApi,
        namespaceName: scope.namespace!,
        change: buildOptimizeChange(releaseBinding, recommendation),
        expectedOwner: {
          componentName: scope.component,
          releaseLine: releaseLine ?? MAIN_RELEASE_LINE,
        },
      });

      setStatus('success');
      setOpen(false);
      onOptimized();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to apply recommendation',
      );
      setStatus('failed');
    }
  }, [
    discovery,
    fetchApi,
    scope,
    env,
    recommendation,
    onOptimized,
    releaseLine,
  ]);

  if (status === 'success') {
    return (
      <Button
        variant="outlined"
        size="small"
        disabled
        startIcon={<CheckIcon />}
      >
        Applied
      </Button>
    );
  }

  const disabled =
    permissionLoading ||
    componentLines.loading ||
    lineRequired ||
    !allowed ||
    !resourceRef ||
    Boolean(disabledProp);
  let tooltipTitle = '';
  if (disabledProp) tooltipTitle = 'No recommendations to apply';
  else if (lineRequired)
    tooltipTitle =
      'Choose a release line to apply its recommendation. With all lines, it covers every line of the component.';
  else if (!allowed)
    tooltipTitle = `You do not have permission to modify the deployment in ${env}`;
  const changes = buildRecommendationChanges(recommendation);

  let confirmLabel = 'Confirm Save';
  if (status === 'applying') confirmLabel = 'Saving...';
  else if (status === 'failed') confirmLabel = 'Retry';

  return (
    <>
      <Tooltip title={tooltipTitle}>
        <span>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={() => {
              setStatus('idle');
              setErrorMsg('');
              setOpen(true);
            }}
            disabled={disabled}
          >
            Apply
          </Button>
        </span>
      </Tooltip>

      <Dialog
        open={open}
        onClose={() => status !== 'applying' && setOpen(false)}
        maxWidth="md"
        fullWidth
        aria-labelledby="cost-optimize-dialog-title"
      >
        <DialogTitle id="cost-optimize-dialog-title">
          Confirm Save Changes ({changes.length}{' '}
          {changes.length === 1 ? 'change' : 'changes'})
        </DialogTitle>
        <DialogContent dividers>
          <Box mb={2}>
            <Alert severity="warning">
              <AlertTitle>Note</AlertTitle>
              These values are recommendations derived from the resource usage
              observed over the selected period. They may not account for
              traffic spikes, periodic jobs or start-up requirements outside
              that window, and under-sizing a workload can lead to CPU
              throttling or out-of-memory restarts. Apply them only if you agree
              they reflect what this component needs.
            </Alert>
          </Box>
          <ChangesList
            sections={[{ title: 'Component Overrides', changes }]}
            emptyMessage="No changes to apply"
          />
          <Typography
            variant="body2"
            color="textSecondary"
            style={{ marginTop: 16 }}
          >
            This will trigger a redeployment of{' '}
            {releaseLine && (
              <>
                release line <strong>{releaseLine}</strong> in{' '}
              </>
            )}
            the <strong>{env}</strong> environment.
          </Typography>
          {status === 'failed' && (
            <Box mt={2}>
              <Alert severity="error">{errorMsg}</Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpen(false)}
            disabled={status === 'applying'}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleApply}
            disabled={status === 'applying'}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
