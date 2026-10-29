import { useState, useCallback } from 'react';
import {
  Button,
  Box,
  LinearProgress,
  Tooltip,
  Typography,
} from '@material-ui/core';
import CheckIcon from '@material-ui/icons/Check';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import { Alert } from '@material-ui/lab';
import { useApi } from '@backstage/core-plugin-api';
import { openChoreoFetchApiRef } from '@openchoreo/backstage-plugin-react';
import { useFinopsUpdatePermission } from '@openchoreo/backstage-plugin-react';
import type { FinOpsAgentApi } from '../../api/FinOpsAgentApi';
import type { FinOpsRemediationAction } from '../../types';
import { applyResourceChange } from '../../utils/applyResourceChange';

interface FinOpsApplyChatContext {
  backendBaseUrl?: string;
  namespaceName: string;
  environmentName: string;
  finopsAgentApi: FinOpsAgentApi;
}

interface FinOpsApplyButtonProps {
  reportId: string;
  actionIndex: number;
  action: FinOpsRemediationAction;
  chatContext: FinOpsApplyChatContext;
  /** Component the report is for; the target binding must belong to it. */
  componentName?: string | null;
  /** Release line the report is for; the target binding must be on it. */
  releaseLine?: string | null;
  onApplied?: () => void;
}

type ApplyStatus = 'idle' | 'applying' | 'success' | 'failed';

export const FinOpsApplyButton = ({
  reportId,
  actionIndex,
  action,
  chatContext,
  componentName,
  releaseLine,
  onApplied,
}: FinOpsApplyButtonProps) => {
  const fetchApi = useApi(openChoreoFetchApiRef);
  const {
    canUpdateFinops,
    loading: permissionLoading,
    deniedTooltip,
  } = useFinopsUpdatePermission();

  const initialStatus: ApplyStatus =
    action.status === 'applied' ? 'success' : 'idle';
  const [status, setStatus] = useState<ApplyStatus>(initialStatus);
  const [errorMsg, setErrorMsg] = useState('');

  const handleApply = useCallback(async () => {
    if (!chatContext.backendBaseUrl || !action.change) return;

    setStatus('applying');
    setErrorMsg('');

    try {
      await applyResourceChange({
        backendBaseUrl: chatContext.backendBaseUrl,
        fetchApi,
        namespaceName: chatContext.namespaceName,
        change: action.change,
        expectedOwner: { componentName, releaseLine },
      });

      try {
        await chatContext.finopsAgentApi.updateActionStatuses(
          reportId,
          {
            namespaceName: chatContext.namespaceName,
            environmentName: chatContext.environmentName,
          },
          { appliedIndices: [actionIndex] },
        );
      } catch {
        // Non-fatal: the binding was patched; status recording failed
      }

      setStatus('success');
      onApplied?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to apply recommendation',
      );
      setStatus('failed');
    }
  }, [
    chatContext,
    fetchApi,
    reportId,
    actionIndex,
    action.change,
    componentName,
    releaseLine,
    onApplied,
  ]);

  if (action.status === 'applied' || status === 'success') {
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

  if (action.status === 'dismissed') {
    return (
      <Button variant="outlined" size="small" disabled>
        Dismissed
      </Button>
    );
  }

  if (status === 'applying') {
    return (
      <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
        <Button variant="outlined" size="small" disabled>
          Applying...
        </Button>
        <LinearProgress style={{ borderRadius: 2 }} />
      </Box>
    );
  }

  if (status === 'failed') {
    return (
      <Box display="flex" flexDirection="column" style={{ gap: 8 }}>
        <Button
          variant="outlined"
          color="secondary"
          size="small"
          startIcon={<ErrorOutlineIcon />}
          onClick={handleApply}
        >
          Retry
        </Button>
        <Alert severity="error" style={{ fontSize: '0.8rem' }}>
          {errorMsg}
        </Alert>
      </Box>
    );
  }

  const missingConfig = !chatContext.backendBaseUrl || !action.change;
  const disabled = permissionLoading || !canUpdateFinops || missingConfig;
  const tooltipTitle = missingConfig
    ? 'Apply is unavailable: required configuration is missing'
    : deniedTooltip;

  return (
    <Box>
      <Tooltip title={tooltipTitle}>
        <span>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={handleApply}
            disabled={disabled}
          >
            Apply Recommendation
          </Button>
        </span>
      </Tooltip>
      {action.change && (
        <Typography variant="caption" color="textSecondary" display="block">
          Updates release binding {action.change.release_binding}
          {releaseLine ? ` on release line ${releaseLine}` : ''}
        </Typography>
      )}
    </Box>
  );
};
